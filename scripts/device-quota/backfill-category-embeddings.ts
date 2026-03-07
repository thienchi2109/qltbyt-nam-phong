// One-time backfill script: populate embeddings for all existing categories
// Run: npx tsx scripts/device-quota/backfill-category-embeddings.ts
//
// Required env vars (from .env.local):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

// Small batch size to avoid Edge Function timeout (gte-small model is slow)
const BATCH_SIZE = 5
const DELAY_BETWEEN_BATCHES_MS = 1000
const FETCH_TIMEOUT_MS = 120_000

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Fetch categories missing embeddings
  const { data: categories, error: fetchError } = await supabase
    .from('nhom_thiet_bi')
    .select('id, ten_nhom')
    .is('embedding', null)
    .order('id')

  if (fetchError) {
    console.error('Failed to fetch categories:', fetchError)
    process.exit(1)
  }

  if (!categories || categories.length === 0) {
    console.log('All categories already have embeddings. Nothing to do.')
    return
  }

  console.log(`Found ${categories.length} categories without embeddings`)
  console.log(`Processing in batches of ${BATCH_SIZE}...`)

  const totalBatches = Math.ceil(categories.length / BATCH_SIZE)
  let totalRefreshed = 0
  let totalFailed = 0

  for (let i = 0; i < categories.length; i += BATCH_SIZE) {
    const batchIndex = Math.floor(i / BATCH_SIZE) + 1
    const batch = categories.slice(i, i + BATCH_SIZE)
    const texts = batch.map(c => c.ten_nhom || '')

    process.stdout.write(`Batch ${batchIndex}/${totalBatches} (${batch.length} items)... `)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

      const embedResponse = await fetch(
        `${supabaseUrl}/functions/v1/embed-device-name`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ texts }),
          signal: controller.signal,
        }
      )

      clearTimeout(timeout)

      if (!embedResponse.ok) {
        const errorBody = await embedResponse.text()
        console.error(`FAILED: ${embedResponse.status} ${errorBody}`)
        totalFailed += batch.length
        continue
      }

      const { embeddings } = await embedResponse.json()

      // Update each category
      let batchOk = 0
      for (let j = 0; j < batch.length; j++) {
        const { error: updateError } = await supabase
          .from('nhom_thiet_bi')
          .update({ embedding: JSON.stringify(embeddings[j]) })
          .eq('id', batch[j].id)

        if (updateError) {
          console.error(`  Update failed for id=${batch[j].id}:`, updateError.message)
          totalFailed++
        } else {
          totalRefreshed++
          batchOk++
        }
      }

      console.log(`OK (${batchOk}/${batch.length})`)
    } catch (batchError: unknown) {
      if (batchError instanceof Error && batchError.name === 'AbortError') {
        console.error(`TIMEOUT after ${FETCH_TIMEOUT_MS / 1000}s`)
      } else {
        const msg = batchError instanceof Error ? batchError.message : String(batchError)
        console.error(`ERROR: ${msg}`)
      }
      totalFailed += batch.length
    }

    // Delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < categories.length) {
      await delay(DELAY_BETWEEN_BATCHES_MS)
    }
  }

  console.log(`\nBackfill complete: ${totalRefreshed} refreshed, ${totalFailed} failed out of ${categories.length} total`)

  if (totalFailed > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
