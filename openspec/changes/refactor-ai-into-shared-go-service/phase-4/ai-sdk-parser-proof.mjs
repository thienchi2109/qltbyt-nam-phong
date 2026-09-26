import { createParser } from "eventsource-parser"
import { readUIMessageStream } from "ai"

const chunks = [
  { type: "start", messageId: "req-parser-proof" },
  { type: "start-step" },
  { type: "text-start", id: "text-1" },
  { type: "text-delta", id: "text-1", delta: "hello" },
  { type: "text-end", id: "text-1" },
  { type: "data-artifact", data: { name: "repairRequestDraft", payload: { draftOnly: true } } },
  { type: "finish-step" },
  { type: "finish", finishReason: "stop" },
]

const encoded =
  chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n"
const parsed = []
const parser = createParser({
  onEvent(event) {
    if (event.data !== "[DONE]") parsed.push(JSON.parse(event.data))
  },
})
parser.feed(encoded)

const stream = new ReadableStream({
  start(controller) {
    for (const chunk of parsed) controller.enqueue(chunk)
    controller.close()
  },
})

let latest
for await (const message of readUIMessageStream({ stream })) latest = message

if (!latest?.parts?.some((part) => part.type === "text" && part.text === "hello")) {
  throw new Error("AI SDK parser did not reconstruct text")
}
if (!latest?.parts?.some((part) => part.type === "data-artifact")) {
  throw new Error("AI SDK parser did not preserve artifact data")
}
console.log("AI SDK UI Message Stream v1 parser accepted text, artifact, finish and DONE ordering")
