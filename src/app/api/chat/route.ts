import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  streamText,
  stepCountIs,
  type UIMessage,
  validateUIMessages,
} from 'ai'
import { getServerSession } from 'next-auth'
import { after } from 'next/server'

import { authOptions } from '@/auth/config'
import { chatRequestSchema } from '@/lib/ai/chat-request-schema'
import { createChatUIStreamResponse, waitForStreamReady } from './chat-ui-stream'
import { compactValidatedMessages } from './compact-validated-messages'
import { maybeBuildRepairRequestDraftArtifact } from '@/lib/ai/draft/repair-request-draft-orchestrator'
import { writeRepairRequestDraftToolResult } from '@/lib/ai/draft/repair-request-draft-ui-stream'
import {
  AI_MAX_COMPACTED_INPUT_CHARS,
  AI_MAX_INPUT_CHARS,
  AI_MAX_MESSAGES,
  AI_MAX_OUTPUT_TOKENS,
  AI_MAX_TOOL_STEPS,
  calculateInputChars,
} from '@/lib/ai/limits'
import { getChatModel, getKeyPoolSize, handleProviderQuotaError } from '@/lib/ai/provider'
import { buildSystemPrompt } from '@/lib/ai/prompts/system'
import type { SystemPromptContext } from '@/lib/ai/prompts/types'
import { routeChatIntent } from '@/lib/ai/intent-routing'
import { resolveAssistantScope } from '@/lib/ai/sql/scope'
import { extractEquipmentLookupHints } from '@/lib/ai/tools/equipment-lookup-identifiers'
import { buildToolRegistry, validateRequestedTools } from '@/lib/ai/tools/registry'
import {
  classifyStreamFailure,
  finalizeUsage,
  reserveUsage,
  type UsageContext,
  type UsageFinalizeStatus,
} from '@/lib/ai/usage-metering'
import { isProviderQuotaError, sanitizeErrorForClient } from '@/lib/ai/errors'
import { ROLES } from '@/lib/rbac'

/** Run chat streaming on the Node.js runtime because provider SDKs and server RPCs need Node APIs. */
export const runtime = 'nodejs'
/** Hard cap for the route execution window; quota reservation TTL must exceed this. */
export const maxDuration = 60

function plainError(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

function clarificationResponse(message: string, originalMessages: UIMessage[]) {
  const stream = createUIMessageStream({
    originalMessages,
    onError: () => 'Unable to build clarification response.',
    execute: ({ writer }) => {
      const textId = 'assistant-clarification'

      writer.write({ type: 'start' })
      writer.write({ type: 'text-start', id: textId })
      writer.write({ type: 'text-delta', id: textId, delta: message })
      writer.write({ type: 'text-end', id: textId })
      writer.write({ type: 'finish', finishReason: 'stop' })
    },
  })

  return createUIMessageStreamResponse({ stream })
}

const ALLOWED_CHAT_ROLES = new Set<string>(Object.values(ROLES))

function hasAllowedChatRole(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false
  }

  return ALLOWED_CHAT_ROLES.has(value.trim().toLowerCase())
}

function numberOrStringClaim(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') {
    return value
  }
  return null
}

/** Handles authenticated AI chat requests with quota reservation and stream finalization. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return plainError('Unauthorized', 401)
  }

  const user = session.user as Record<string, unknown>
  if (!hasAllowedChatRole(user.role)) {
    return plainError('Forbidden', 403)
  }

  const payload = await request.json().catch(() => null)
  const parsedRequest = chatRequestSchema.safeParse(payload)
  if (!parsedRequest.success) {
    return plainError('Invalid request payload', 400)
  }
  const requestedToolsValidation = validateRequestedTools(
    parsedRequest.data.requestedTools ?? [],
  )
  if (!requestedToolsValidation.ok) {
    return plainError(requestedToolsValidation.message, 400)
  }
  const requestedTools = requestedToolsValidation.requestedTools

  if (parsedRequest.data.messages.length > AI_MAX_MESSAGES) {
    return plainError('Request exceeds message limit', 400)
  }

  const inputChars = calculateInputChars(parsedRequest.data.messages)
  if (inputChars > AI_MAX_INPUT_CHARS) {
    return plainError('Request exceeds input size limit', 400)
  }

  let validatedMessages: UIMessage[]
  try {
    validatedMessages = await validateUIMessages({
      messages: parsedRequest.data.messages as UIMessage[],
    })
  } catch {
    return plainError('Invalid messages payload', 400)
  }

  const routedIntent = routeChatIntent({
    messages: validatedMessages,
    requestedTools,
  })
  if (routedIntent.kind === 'clarify') {
    return clarificationResponse(routedIntent.message, validatedMessages)
  }
  const effectiveRequestedTools = routedIntent.requestedTools

  // Compact migrated read-only / RPC tool outputs only on the model-execution path.
  // Clarification responses above should bypass this budget gate entirely.
  const { compactedMessages, compactedChars } = compactValidatedMessages(validatedMessages)
  if (compactedChars > AI_MAX_COMPACTED_INPUT_CHARS) {
    return plainError('Request exceeds compacted context limit', 400)
  }

  const role = typeof user.role === 'string' ? user.role : undefined
  const scopeResolution = resolveAssistantScope({
    user,
    requestedFacilityId: parsedRequest.data.selectedFacilityId,
    requireFacilityScope: effectiveRequestedTools.length > 0,
  })
  if (!scopeResolution.ok) {
    return plainError(scopeResolution.message, 400)
  }
  const {
    assistantSqlScope,
    promptUserId,
    selectedFacilityId,
    usageUserId,
  } = scopeResolution

  const usageContext: UsageContext = {
    userId: usageUserId,
    tenantId: selectedFacilityId,
    role,
    diaBanId: numberOrStringClaim(user.dia_ban_id),
    khoaPhong: typeof user.khoa_phong === 'string' ? user.khoa_phong : null,
  }
  const usageReservation = await reserveUsage(usageContext)
  if (!usageReservation.allowed) {
    return plainError(usageReservation.message ?? 'AI usage limit exceeded.', 429)
  }

  let finalized = false
  let finalizePromise: Promise<void> | null = null
  const finalizeOnce = async (details: {
    status: UsageFinalizeStatus
    inputTokens?: number
    outputTokens?: number
    costUsd?: number
  }) => {
    if (finalized || finalizePromise) {
      return finalizePromise
    }
    finalizePromise = (async () => {
      try {
        await finalizeUsage({
          ...usageContext,
          reservationId: usageReservation.reservationId,
          ...details,
        })
        finalized = true
      } catch (error) {
        console.error('[chat] Usage finalize error:', error)
      } finally {
        finalizePromise = null
      }
    })()
    return finalizePromise
  }

  const promptContext: SystemPromptContext = {
    role,
    userId: promptUserId,
    selectedFacilityId,
    selectedFacilityName: parsedRequest.data.selectedFacilityName ?? undefined,
  }
  const systemPrompt = buildSystemPrompt(promptContext)
  const equipmentLookupHints = extractEquipmentLookupHints(validatedMessages)

  const shouldAttemptRepairRequestDraft =
    effectiveRequestedTools.includes('generateRepairRequestDraft')
  const tools =
    effectiveRequestedTools.length > 0 && selectedFacilityId !== undefined
      ? buildToolRegistry({
          assistantSqlScope,
          request,
          tenantId: selectedFacilityId,
          userId: usageUserId,
          requestedTools: effectiveRequestedTools,
          equipmentLookupHints,
        })
      : undefined
  let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>
  try {
    modelMessages = await convertToModelMessages(compactedMessages)
  } catch (error) {
    console.error('[chat] Message conversion error:', error)
    await finalizeOnce({
      status: 'error_no_usage',
      inputTokens: 0,
      outputTokens: 0,
    })
    return plainError(sanitizeErrorForClient(error), 500)
  }

  const maxAttempts = getKeyPoolSize()

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let keyIndex = 0
    let configuredModel = 'unknown'
    let streamStarted = false

    try {
      const chatModel = getChatModel()
      keyIndex = chatModel.keyIndex
      configuredModel = chatModel.config.model
      console.info('[chat] Model attempt start', {
        attempt,
        maxAttempts,
        keyIndex,
        model: configuredModel,
      })

      const result = streamText({
        model: chatModel.model,
        system: systemPrompt,
        maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
        stopWhen: stepCountIs(AI_MAX_TOOL_STEPS),
        messages: modelMessages,
        tools,
        providerOptions: chatModel.providerOptions,
        onFinish({ usage, finishReason }) {
          const failureUsage = classifyStreamFailure({ providerUsage: usage })
          after(() => finalizeOnce(finishReason === 'error'
            ? failureUsage
            : {
                status: 'success',
                inputTokens: usage.inputTokens ?? 0,
                outputTokens: usage.outputTokens ?? 0,
              }))
        },
      })

      await waitForStreamReady(result, isProviderQuotaError)
      streamStarted = true

      const handleStreamError = (error: unknown) => {
        after(() => finalizeOnce(classifyStreamFailure({ providerUsage: undefined })))
        // Mid-stream quota errors can't be retried (response already in-flight),
        // but rotate the key for future requests so they don't hit the same quota.
        if (isProviderQuotaError(error)) {
          console.warn('[chat] Stream quota error', {
            attempt,
            maxAttempts,
            keyIndex,
            model: configuredModel,
          })
          handleProviderQuotaError(keyIndex)
        } else {
          console.error('[chat] Stream error', {
            attempt,
            maxAttempts,
            keyIndex,
            model: configuredModel,
          }, error)
        }
        return sanitizeErrorForClient(error)
      }

      return createChatUIStreamResponse({
        result,
        originalMessages: validatedMessages,
        onError: handleStreamError,
        onAfterBaseStream: async writer => {
          if (!shouldAttemptRepairRequestDraft) {
            return
          }

          try {
            const steps = await result.steps
            const repairDraftArtifact = await maybeBuildRepairRequestDraftArtifact({
              model: chatModel.model,
              messages: validatedMessages,
              steps: steps.map(step => ({
                toolResults: step.toolResults.map(toolResult => ({
                  toolName: toolResult.toolName,
                  output: toolResult.output,
                })),
              })),
              providerOptions: chatModel.providerOptions,
            })

            if (repairDraftArtifact) {
              writeRepairRequestDraftToolResult(writer, repairDraftArtifact)
            }
          } catch (error) {
            console.error('[chat] Repair draft orchestration skipped', {
              attempt,
              maxAttempts,
              keyIndex,
              model: configuredModel,
            }, error)
          }
        },
      })
    } catch (error) {
      // On quota error, silently rotate to next API key and retry.
      if (isProviderQuotaError(error) && handleProviderQuotaError(keyIndex) && attempt < maxAttempts) {
        console.warn(
          '[chat] Pre-stream quota error — rotating to next key',
          {
            attempt,
            maxAttempts,
            keyIndex,
            model: configuredModel,
            nextAttempt: attempt + 1,
          },
        )
        continue
      }

      await finalizeOnce({
        status: streamStarted ? 'error_with_usage' : 'error_no_usage',
        inputTokens: 0,
        outputTokens: 0,
      })

      console.error(
        '[chat] Pre-stream error',
        {
          attempt,
          maxAttempts,
          keyIndex,
          model: configuredModel,
          quotaError: isProviderQuotaError(error),
        },
        error,
      )
      return plainError(sanitizeErrorForClient(error), 500)
    }
  }

  // Should be unreachable, but guard defensively.
  return plainError(sanitizeErrorForClient('All API keys exhausted.'), 500)
}
