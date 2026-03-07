// Edge Function: embed-device-name
// Purpose: Generate 384-dim text embeddings using built-in gte-small model
// Input: { texts: string[] } (max 50 per call)
// Output: { embeddings: number[][] }
// Security: verify_jwt = true, zero DB access

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/cors.ts"

const model = new Supabase.ai.Session('gte-small')
const MAX_BATCH_SIZE = 50

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { texts } = await req.json()

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

    // Generate embeddings sequentially to avoid memory pressure
    const embeddings: number[][] = []
    for (const text of texts) {
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
  } catch (err) {
    console.error('Error generating embeddings:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
