import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  streamText,
  stepCountIs,
  type UIMessage,
  validateUIMessages,
} from 'ai'
import type { GoogleLanguageModelOptions } from '@ai-sdk/google'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/auth/config'
import { chatRequestSchema } from '@/lib/ai/chat-request-schema'
import {
  AI_MAX_INPUT_CHARS,
  AI_MAX_MESSAGES,
  AI_MAX_OUTPUT_TOKENS,
  AI_MAX_TOOL_STEPS,
} from '@/lib/ai/limits'
import { getChatModel, getKeyPoolSize, handleProviderQuotaError } from '@/lib/ai/provider'
import { buildSystemPrompt } from '@/lib/ai/prompts/system'
import type { SystemPromptContext } from '@/lib/ai/prompts/types'
import { routeChatIntent } from '@/lib/ai/intent-routing'
import { extractEquipmentLookupHints } from '@/lib/ai/tools/equipment-lookup-identifiers'
import { buildToolRegistry, validateRequestedTools } from '@/lib/ai/tools/registry'
import { checkUsageLimits, confirmUsage, recordUsage } from '@/lib/ai/usage-metering'
import { isProviderQuotaError, sanitizeErrorForClient } from '@/lib/ai/errors'
import { isPrivilegedRole, ROLES } from '@/lib/rbac'

export const runtime = 'nodejs'
export const maxDuration = 30

function plainError(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

function clarificationResponse(message: string, originalMessages: UIMessage[]) {
  const stream = createUIMessageStream({
    originalMessages,
    execute: ({ writer }) => {
      const textId = 'assistant-clarification'
      writer.write({ type: 'text-start', id: textId })
      writer.write({ type: 'text-delta', id: textId, delta: message })
      writer.write({ type: 'text-end', id: textId })
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

function toFacilityId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return undefined
    }

    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

function calculateInputChars(messages: unknown[]): number {
  try {
    return JSON.stringify(messages).length
  } catch {
    return Number.MAX_SAFE_INTEGER
  }
}

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

  const role = typeof user.role === 'string' ? user.role : undefined
  const sessionFacilityId = toFacilityId(user.don_vi)
  const requestedFacilityId = parsedRequest.data.selectedFacilityId
  let selectedFacilityId = sessionFacilityId

  if (isPrivilegedRole(role)) {
    if (effectiveRequestedTools.length > 0 && requestedFacilityId === undefined) {
      return plainError(
        'Anh/chị vui lòng chọn cơ sở y tế tại bộ lọc đơn vị trên thanh điều hướng (phía trên bên trái màn hình) trước khi sử dụng trợ lý tra cứu.',
        400,
      )
    }
    if (requestedFacilityId !== undefined) {
      selectedFacilityId = requestedFacilityId
    }
  }

  if (effectiveRequestedTools.length > 0 && selectedFacilityId === undefined) {
    return plainError('Unable to resolve facility context for tool execution.', 400)
  }
  const promptUserId =
    typeof user.id === 'string' || typeof user.id === 'number'
      ? String(user.id)
      : undefined
  const usageUserId = promptUserId ?? 'unknown-session'
  const usageLimit = checkUsageLimits({
    userId: usageUserId,
    tenantId: selectedFacilityId,
  })
  if (!usageLimit.allowed) {
    return plainError(usageLimit.message ?? 'AI usage limit exceeded.', 429)
  }

  const promptContext: SystemPromptContext = {
    role,
    userId: promptUserId,
    selectedFacilityId,
    selectedFacilityName: parsedRequest.data.selectedFacilityName ?? undefined,
  }
  const systemPrompt = buildSystemPrompt(promptContext)
  const equipmentLookupHints = extractEquipmentLookupHints(validatedMessages)

  const usageContext = { userId: usageUserId, tenantId: selectedFacilityId }
  const tools =
    effectiveRequestedTools.length > 0 && selectedFacilityId !== undefined
      ? buildToolRegistry({
          request,
          tenantId: selectedFacilityId,
          userId: usageUserId,
          requestedTools: effectiveRequestedTools,
          equipmentLookupHints,
        })
      : undefined

  // Record in rate-limit sliding window upfront (anti-abuse).
  recordUsage(usageContext)

  let modelMessages: Awaited<ReturnType<typeof convertToModelMessages>>
  try {
    modelMessages = await convertToModelMessages(validatedMessages)
  } catch (error) {
    console.error('[chat] Message conversion error:', error)
    return plainError(sanitizeErrorForClient(error), 500)
  }

  const maxAttempts = getKeyPoolSize()

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let keyIndex = 0

    try {
      const chatModel = getChatModel()
      keyIndex = chatModel.keyIndex

      const result = streamText({
        model: chatModel.model,
        system: systemPrompt,
        maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
        stopWhen: stepCountIs(AI_MAX_TOOL_STEPS),
        messages: modelMessages,
        tools,
        providerOptions: {
          google: {
            thinkingConfig: { thinkingLevel: 'medium' },
          } satisfies GoogleLanguageModelOptions,
        },
        onFinish({ usage, finishReason }) {
          // Only increment daily quotas after a successful completion.
          if (finishReason !== 'error') {
            confirmUsage(usageContext, {
              inputTokens: usage.inputTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
            })
          }
        },
      })

      return result.toUIMessageStreamResponse({
        onError: (error) => {
          // Mid-stream quota errors can't be retried (response already in-flight),
          // but rotate the key for future requests so they don't hit the same quota.
          if (isProviderQuotaError(error)) {
            handleProviderQuotaError(keyIndex)
          }
          return sanitizeErrorForClient(error)
        },
      })
    } catch (error) {
      // On quota error, silently rotate to next API key and retry.
      if (isProviderQuotaError(error) && handleProviderQuotaError(keyIndex) && attempt < maxAttempts) {
        console.warn(
          `[chat] API key #${attempt} quota exceeded — rotating to next key (attempt ${attempt + 1}/${maxAttempts})`,
        )
        continue
      }

      console.error('[chat] Pre-stream error:', error)
      return plainError(sanitizeErrorForClient(error), 500)
    }
  }

  // Should be unreachable, but guard defensively.
  return plainError(sanitizeErrorForClient('All API keys exhausted.'), 500)
}
