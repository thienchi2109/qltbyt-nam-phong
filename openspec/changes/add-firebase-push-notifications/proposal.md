## Why
The application currently lacks a real-time notification system. To validate the technical approach and provide immediate value, we will implement a **4-hour MVP** that delivers push notifications for **all new repair requests**. This will allow technicians to respond faster to equipment failures without waiting for full system implementation.

## What Changes
- **MVP Scope**:
    - **Trigger**: All "New Repair Request" events (any priority).
    - **Recipients**: Assigned technicians and managers.
    - **Exclusions**: Transfer approvals, maintenance reminders, and other event types are deferred.
- **Add Firebase SDK**: Install `firebase` package and configure it for the web app.
- **Database Schema**: Create `user_fcm_tokens` table to store user-device mappings.
- **Token Management**: Implement logic to request permissions, generate FCM tokens, and store them in Supabase.
- **Service Worker**: Activate and configure `firebase-messaging-sw.js` for background notification handling.
- **Edge Functions**: Deploy `save-fcm-token` and `send-push-notification` functions.
- **UI Integration**: Add toast notifications for foreground messages.
- **Deployment**: Ship web app changes on Vercel; defer Cloudflare deployment for a later phase.

## Impact
- **Affected Specs**: `notifications` (new capability)
- **Affected Code**: 
    - `package.json` (new dependency)
    - `src/lib/firebase.ts` & `src/lib/firebase-utils.tsx` (activation)
    - `public/firebase-messaging-sw.js` (activation)
    - `supabase/functions/` (new functions)
    - Database schema (new table)
