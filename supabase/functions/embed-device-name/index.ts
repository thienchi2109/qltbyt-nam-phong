// Edge Function: embed-device-name
// Purpose: Generate 384-dim text embeddings using built-in gte-small model
// Input: { texts: string[] } (max 10 per call — Free tier 512MB RAM limit)
// Output: { embeddings: number[][] }
// Security: verify_jwt = true, zero DB access

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/cors.ts"

const model = new Supabase.ai.Session('gte-small')
// Free tier: 512MB RAM limit per execution. Tested: batch=10 OK, batch=20 → 546
const MAX_BATCH_SIZE = 10

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let texts: unknown
    try {
      const body = await req.json()
      texts = body.texts
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'texts must be a non-empty array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (texts.length > MAX_BATCH_SIZE) {
      return new Response(
        JSON.stringify({ error: `Max batch size is ${MAX_BATCH_SIZE}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate each element is a non-empty string
    const sanitized = texts.map((t: unknown) =>
      typeof t === 'string' && t.trim().length > 0 ? t.trim() : ''
    )
    const invalidCount = sanitized.filter((t: string) => t === '').length
    if (invalidCount === sanitized.length) {
      return new Response(
        JSON.stringify({ error: 'All texts are empty or invalid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate embeddings sequentially to avoid memory pressure
    // Empty strings get a zero-vector placeholder
    const embeddings: number[][] = []
    for (const text of sanitized) {
      if (text === '') {
        embeddings.push(new Array(384).fill(0))
        continue
      }
      const embedding = await model.run(text, {
        mean_pool: true,
        normalize: true,
      })
      embeddings.push(embedding)
    }

    return new Response(
      JSON.stringify({ embeddings }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Connection': 'keep-alive' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Error generating embeddings:', message)
    return new Response(
      JSON.stringify({ error: 'Internal error generating embeddings' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
