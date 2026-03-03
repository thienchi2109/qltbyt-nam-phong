import { z } from 'zod'

const selectedFacilityIdSchema = z.preprocess(value => {
  if (value === null || value === undefined) {
    return undefined
  }

  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return undefined
    }

    return Number(trimmed)
  }

  return undefined
}, z.number().int().positive().safe().optional())

export const chatRequestSchema = z.object({
  messages: z.array(z.unknown()).min(1),
  requestedTools: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  selectedFacilityId: selectedFacilityIdSchema,
})

export type ChatRequest = z.infer<typeof chatRequestSchema>
