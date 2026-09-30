import { postGoBffChat } from "@/lib/ai/go-bff/GoBffChatPost"

/** Runs the chat BFF on the Node.js runtime for server-only credentials. */
export const runtime = "nodejs"
/** Matches the production chat request execution budget. */
export const maxDuration = 60

/** Dark path uses the same Go BFF handler as production `/api/chat`. */
export async function POST(request: Request): Promise<Response> {
  return postGoBffChat(request)
}
