import {
  convertToModelMessages,
  streamText,
  type UIMessage,
  validateUIMessages,
} from 'ai'
import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'

import { authOptions } from '@/auth/config'
import { chatRequestSchema } from '@/lib/ai/chat-request-schema'
import { getChatModel } from '@/lib/ai/provider'
import { buildSystemPrompt } from '@/lib/ai/prompts/system'
import { ROLES } from '@/lib/rbac'

export const runtime = 'nodejs'
export const maxDuration = 30

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
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

  let validatedMessages: UIMessage[]
  try {
    validatedMessages = await validateUIMessages({
      messages: parsedRequest.data.messages as UIMessage[],
    })
  } catch {
    return badRequest('Invalid messages payload')
  }

  const systemPrompt = buildSystemPrompt({
    role: typeof user.role === 'string' ? user.role : undefined,
    userId:
      typeof user.id === 'string' || typeof user.id === 'number'
        ? String(user.id)
        : undefined,
    selectedFacilityId: toFacilityId(user.don_vi),
  })

  const result = streamText({
    model: getChatModel(),
    system: systemPrompt,
    messages: await convertToModelMessages(validatedMessages),
  })

  return result.toUIMessageStreamResponse()
}
