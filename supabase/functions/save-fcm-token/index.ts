import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // This is needed if you're planning to invoke your function from cross-origin browser contexts.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', // Use anon key for user context
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get the session or user from the authorization header
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { fcmToken } = await req.json()
    if (!fcmToken) {
      return new Response(JSON.stringify({ error: 'Missing fcmToken' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Upsert the token: if token for user exists, update updated_at, else insert.
    const { data, error } = await supabaseClient
      .from('user_fcm_tokens')
      .upsert(
        { user_id: user.id, fcm_token: fcmToken, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,fcm_token' } // Assumes unique constraint on (user_id, fcm_token)
      )
      .select()

    if (error) {
      console.error('Error saving FCM token:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    console.error('General error in save-fcm-token function:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
