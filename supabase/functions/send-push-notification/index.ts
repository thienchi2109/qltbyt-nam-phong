import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { getAccessToken } from '../_shared/google-auth.ts' // We'll create this helper

// Helper to send notification via FCM HTTP v1 API
async function sendFcmMessage(accessToken: string, projectId: string, fcmToken: string, notificationPayload: any) {
  const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const message = {
    message: {
      token: fcmToken,
      notification: {
        title: notificationPayload.title,
        body: notificationPayload.body,
        // image: notificationPayload.image, // Optional
      },
      data: notificationPayload.data, // Custom data for click_action, etc.
      webpush: { // Specific Webpush options
        notification: {
            icon: notificationPayload.icon || '/icons/icon-192x192.png',
            // ... other webpush specific notification fields if needed
        },
        fcm_options: {
            link: notificationPayload.data?.url // This will be used for click_action
        }
      }
    },
  };

  try {
    const response = await fetch(fcmEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Error sending FCM message to ${fcmToken}: ${response.status}`, errorData);
      return { success: false, error: errorData };
    }
    const responseData = await response.json();
    console.log(`Successfully sent FCM message to ${fcmToken}:`, responseData);
    return { success: true, responseData };
  } catch (error) {
    console.error(`Exception sending FCM message to ${fcmToken}:`, error);
    return { success: false, error: error.message };
  }
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const providedSecret = req.headers.get('x-internal-secret') ?? '';

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdminClient = createClient(
      supabaseUrl,
      supabaseServiceRoleKey
    );

    // Shared-secret check for internal callers (e.g., DB trigger via pg_net)
    let internalSecret = Deno.env.get('INTERNAL_FUNCTION_SECRET') ?? '';

    if (!internalSecret && supabaseUrl && supabaseServiceRoleKey) {
      const { data: secretRow, error: secretError } = await supabaseAdminClient
        .from('internal_settings')
        .select('value')
        .ilike('key', 'internal_function_secret') // handle uppercase/lowercase keys
        .single();

      if (secretRow?.value) {
        internalSecret = secretRow.value as string;
      } else {
        console.error('INTERNAL_FUNCTION_SECRET not set and internal_settings lookup failed', secretError?.message);
      }
    }

    if (!internalSecret) {
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (providedSecret !== internalSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const { userIds, notificationPayload } = await req.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing or invalid userIds' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    if (!notificationPayload || !notificationPayload.title || !notificationPayload.body) {
      return new Response(JSON.stringify({ error: 'Missing notificationPayload title or body' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Fetch FCM tokens for the given userIds
    const { data: tokensData, error: tokensError } = await supabaseAdminClient
      .from('user_fcm_tokens')
      .select('fcm_token')
      .in('user_id', userIds);

    if (tokensError) {
      console.error('Error fetching FCM tokens:', tokensError);
      return new Response(JSON.stringify({ error: tokensError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!tokensData || tokensData.length === 0) {
      console.log('No FCM tokens found for the given userIds.');
      return new Response(JSON.stringify({ message: 'No FCM tokens found for users.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Not an error, just no one to notify
      });
    }

    const projectId = Deno.env.get('FIREBASE_PROJECT_ID');
    if (!projectId) {
        console.error('FIREBASE_PROJECT_ID environment variable not set.');
        throw new Error('Firebase Project ID not configured for sending notifications.');
    }

    const accessToken = await getAccessToken(); // Helper to get Google OAuth2 token

    const results = [];
    for (const record of tokensData) {
      const result = await sendFcmMessage(accessToken, projectId, record.fcm_token, notificationPayload);
      results.push({ token: record.fcm_token, ...result });
    }

    // TODO: Handle invalid/stale tokens based on FCM response and remove them from user_fcm_tokens table

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error('General error in send-push-notification function:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
