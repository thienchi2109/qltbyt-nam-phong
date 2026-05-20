import crypto from "node:crypto"

import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config({ path: ".env.local" })

const DEFAULT_BATCH_SIZE = 16
const DEFAULT_MODEL_NAME = "dangvantuan/vietnamese-embedding"
const DIMENSION = 768

type CategoryRow = {
  id: number
  ma_nhom: string | null
  ten_nhom: string | null
  phan_loai: string | null
  tu_khoa: string[] | null
}

type EmbeddingResponse = {
  embeddings?: unknown
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]
  if (value === undefined) return fallback
  return value.toLowerCase() === "true"
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name])
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

function categoryContent(category: CategoryRow): string {
  return [
    category.ma_nhom ?? "",
    category.ten_nhom ?? "",
    category.phan_loai ?? "",
    ...(category.tu_khoa ?? []),
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n")
}

function contentHash(category: CategoryRow, modelName: string): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ dimension: DIMENSION, modelName, text: categoryContent(category) }))
    .digest("hex")
}

function assertEmbeddings(value: unknown, expectedCount: number): number[][] {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    throw new Error(`Embedding response count mismatch: expected ${expectedCount}`)
  }

  return value.map((embedding, index) => {
    if (!Array.isArray(embedding) || embedding.length !== DIMENSION) {
      throw new Error(`Embedding ${index} must have ${DIMENSION} dimensions`)
    }
    return embedding.map((item) => {
      if (typeof item !== "number" || !Number.isFinite(item)) {
        throw new Error(`Embedding ${index} contains a non-finite value`)
      }
      return item
    })
  })
}

async function fetchEmbeddings({
  endpoint,
  modelName,
  texts,
}: {
  endpoint: string
  modelName: string
  texts: string[]
}): Promise<number[][]> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dimension: 768, model: modelName, texts }),
  })

  if (!response.ok) {
    throw new Error(`Embedding endpoint returned ${response.status}: ${await response.text()}`)
  }

  const body = (await response.json()) as EmbeddingResponse
  return assertEmbeddings(body.embeddings, texts.length)
}

async function main(): Promise<void> {
  const dryRun = readBooleanEnv("DEVICE_QUOTA_768_REFRESH_DRY_RUN", true)
  const batchSize = readPositiveIntegerEnv("DEVICE_QUOTA_768_REFRESH_BATCH_SIZE", DEFAULT_BATCH_SIZE)
  const modelName = process.env.DEVICE_QUOTA_768_MODEL_NAME ?? DEFAULT_MODEL_NAME
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY")
  const embeddingEndpoint = dryRun ? "" : requiredEnv("DEVICE_QUOTA_768_EMBEDDING_URL")

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await supabase
    .from("nhom_thiet_bi")
    .select("id, ma_nhom, ten_nhom, phan_loai, tu_khoa")
    .order("id", { ascending: true })

  if (error) throw new Error(`Failed to load categories: ${error.message}`)

  const categories = (data ?? []) as CategoryRow[]
  console.log(
    `${dryRun ? "DRY RUN" : "WRITE"} 768 category embedding refresh: ${categories.length} categories, model=${modelName}`,
  )

  if (dryRun) {
    console.log("Set DEVICE_QUOTA_768_REFRESH_DRY_RUN=false to write rows.")
    console.log("Target table: public.device_quota_category_embeddings")
    return
  }

  let refreshed = 0
  for (let start = 0; start < categories.length; start += batchSize) {
    const batch = categories.slice(start, start + batchSize)
    const texts = batch.map(categoryContent)
    const embeddings = await fetchEmbeddings({ endpoint: embeddingEndpoint, modelName, texts })
    const rows = batch.map((category, index) => ({
      category_id: category.id,
      content_hash: contentHash(category, modelName),
      dimension: 768,
      embedding: JSON.stringify(embeddings[index]),
      model_name: modelName,
    }))

    const { error: upsertError } = await supabase
      .from("device_quota_category_embeddings")
      .upsert(rows, { onConflict: "category_id,model_name,dimension,content_hash" })

    if (upsertError) throw new Error(`Failed to upsert batch ${start}: ${upsertError.message}`)
    refreshed += rows.length
    console.log(`Refreshed ${refreshed}/${categories.length}`)
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
})
