import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  type UIMessage,
  validateUIMessages,
} from 'ai'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/auth/config'
import { chatRequestSchema } from '@/lib/ai/chat-request-schema'
import {
  AI_MAX_INPUT_CHARS,
  AI_MAX_MESSAGES,
  AI_MAX_OUTPUT_TOKENS,
  AI_MAX_TOOL_STEPS,
} from '@/lib/ai/limits'
import { getChatModel } from '@/lib/ai/provider'
import { buildSystemPrompt } from '@/lib/ai/prompts/system'
import type { SystemPromptContext } from '@/lib/ai/prompts/types'
import { checkUsageLimits, confirmUsage, recordUsage } from '@/lib/ai/usage-metering'
import { ROLES } from '@/lib/rbac'

export const runtime = 'nodejs'
export const maxDuration = 30

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function tooManyRequests(message: string) {
  return NextResponse.json({ error: message }, { status: 429 })
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = session.user as Record<string, unknown>
  if (!hasAllowedChatRole(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payload = await request.json().catch(() => null)
  const parsedRequest = chatRequestSchema.safeParse(payload)
  if (!parsedRequest.success) {
    return badRequest('Invalid request payload')
  }
  if (parsedRequest.data.messages.length > AI_MAX_MESSAGES) {
    return badRequest('Request exceeds message limit')
  }

  const inputChars = calculateInputChars(parsedRequest.data.messages)
  if (inputChars > AI_MAX_INPUT_CHARS) {
    return badRequest('Request exceeds input size limit')
  }

  let validatedMessages: UIMessage[]
  try {
    validatedMessages = await validateUIMessages({
      messages: parsedRequest.data.messages as UIMessage[],
    })
  } catch {
    return badRequest('Invalid messages payload')
  }

  const selectedFacilityId = toFacilityId(user.don_vi)
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
    return tooManyRequests(usageLimit.message ?? 'AI usage limit exceeded.')
  }

  const promptContext: SystemPromptContext = {
    role: typeof user.role === 'string' ? user.role : undefined,
    userId: promptUserId,
    selectedFacilityId,
  }
  const systemPrompt = buildSystemPrompt(promptContext)

  const usageContext = { userId: usageUserId, tenantId: selectedFacilityId }

  // Record in rate-limit sliding window upfront (anti-abuse).
  recordUsage(usageContext)

  const result = streamText({
    model: getChatModel(),
    system: systemPrompt,
    maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    stopWhen: stepCountIs(AI_MAX_TOOL_STEPS),
    messages: await convertToModelMessages(validatedMessages),
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

  return result.toUIMessageStreamResponse()
}
