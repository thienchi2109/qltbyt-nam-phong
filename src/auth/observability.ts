import {
  buildAuthLifecycleLog,
  emitAuthLifecyclePayload,
  type AuthLifecycleLogInput,
} from "@/auth/logging"
import { persistAuthLifecycleLog } from "@/auth/persistence"

export async function recordAuthLifecycleEvent(input: AuthLifecycleLogInput): Promise<void> {
  const payload = buildAuthLifecycleLog(input)
  emitAuthLifecyclePayload(payload)
  await persistAuthLifecycleLog(payload)
}
