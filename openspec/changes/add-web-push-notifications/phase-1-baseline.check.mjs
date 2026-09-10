import assert from "node:assert/strict"
import { createHash, createHmac } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
const migrationRoot = join(root, "supabase/migrations")
const definitions = []

function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      collect(path)
    } else if (entry.name.endsWith(".sql")) {
      const source = readFileSync(path, "utf8")
      const definition = source.match(
        /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.repair_request_create\s*\([\s\S]*?AS\s+(\$\w*\$)([\s\S]*?)\1\s*;/i
      )
      if (definition) definitions.push({ name: entry.name, body: definition[2] })
    }
  }
}

collect(migrationRoot)
definitions.sort((a, b) => a.name.localeCompare(b.name))
const latest = definitions.at(-1)
assert.ok(latest, "repair_request_create source must exist")
const body = latest.body.replace(/--[^\n]*/g, "")
const enqueue = body.match(
  /INSERT INTO public\.zbs_notification_outbox\s*\([\s\S]*?ON CONFLICT[^;]+;/i
)
assert.ok(enqueue, "latest create function must retain ZBS enqueue")

// ponytail: source contract only; add DB transaction assertions in Phase 3.
const digest = createHash("sha256").update(enqueue[0].replace(/\s+/g, " ").trim()).digest("hex")
assert.equal(
  digest,
  "046a823ef33d8467a5c57a6ffd5154c2b7b592490b609b7d67f0810d439d58da",
  "ZBS tenant/phone/snapshot/filter/uniqueness contract changed; review, do not blindly rebaseline"
)
assert.doesNotMatch(body, /\b(priority|uu_tien|muc_do_uu_tien)\b/i)
assert.doesNotMatch(body, /\b(http_post|http_get|dblink|COMMIT|ROLLBACK)\b|\bnet\s*\./i)
assert.doesNotMatch(body, /\bEXCEPTION\s+WHEN\b/i, "create must not swallow transactional errors")
for (const statement of [
  "INSERT INTO public.yeu_cau_sua_chua",
  "PERFORM public.repair_request_sync_equipment_status",
  "INSERT INTO public.lich_su_thiet_bi",
  "IF NOT public.audit_log",
]) {
  const position = body.indexOf(statement)
  assert.ok(position >= 0 && position < enqueue.index, `${statement} must precede ZBS enqueue`)
}
assert.match(body, /RAISE EXCEPTION 'audit_log failed/)
assert.match(body.slice(enqueue.index + enqueue[0].length), /RETURN v_id;/)
console.log(`PASS: ZBS source baseline (${latest.name}); DB rollback not executed`)

const contract = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "phase-1-contract.md"),
  "utf8"
)
const vectorBody = contract.match(/```json\n([^\n]+)\n```/)?.[1]
assert.ok(vectorBody, "wire vector must preserve raw one-line JSON bytes")
const vectorDigest = createHash("sha256").update(vectorBody).digest("hex")
assert.equal(vectorDigest, "1495e63cd1255de20c6c4062a1eae98f1ff47743cca455a08dc43cd42600c3ce")
const canonical = [
  "web-push-v1",
  "test-key-1",
  "POST",
  "/api/internal/web-push/v1/claim",
  "1789056000",
  "000102030405060708090a0b0c0d0e0f",
  vectorDigest,
].join("\n")
assert.equal(
  createHmac("sha256", Buffer.alloc(32, 1)).update(canonical).digest("hex"),
  "fed0aa5536eec355be4295c446f3615e90e575315eb4a2abc0c24230e6992a28"
)
console.log("PASS: public HMAC wire fixture bytes/digest/signature")
