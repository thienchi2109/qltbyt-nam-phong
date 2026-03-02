import { z } from 'zod'

export const chatRequestSchema = z.object({
  messages: z.array(z.unknown()).min(1),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>
