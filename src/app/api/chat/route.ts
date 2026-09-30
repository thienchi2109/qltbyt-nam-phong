import { postGoBffChat } from "@/lib/ai/go-bff/GoBffChatPost"

/** Runs production chat on the Node.js runtime for server-only BFF credentials. */
export const runtime = "nodejs"
/** Hard cap for the route execution window. The Go service keeps its own work and cleanup budgets inside this window. */
export const maxDuration = 60

/**
 * Production assistant chat. The browser contract stays `POST /api/chat` with the Vercel AI SDK UI message stream.
 * This route does not import or call the parked Next.js orchestrator.
 */
export async function POST(request: Request): Promise<Response> {
  return postGoBffChat(request)
}
