import { z } from 'zod'

export const chatRequestSchema = z.object({
  messages: z.array(z.unknown()),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>
