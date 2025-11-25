## 1. Configuration & Setup
- [ ] 1.1 Install Firebase SDK: `npm install firebase`
- [ ] 1.2 Create `user_fcm_tokens` table in Supabase
- [ ] 1.3 Configure Firebase Project (Get VAPID Key, Config object)
- [ ] 1.4 Set Supabase Secrets (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
- [ ] 1.5 Deployment scope: ship web app changes on Vercel; defer Cloudflare deployment

## 2. Client-Side Implementation
- [ ] 2.1 Update `src/lib/firebase.ts` with actual Firebase Config
- [ ] 2.2 Update `public/firebase-messaging-sw.js` with actual Firebase Config
- [ ] 2.3 Implement `requestNotificationPermissionAndGetToken` in `src/lib/firebase-utils.tsx`
- [ ] 2.4 Implement `onForegroundMessage` handler with UI Toasts

## 3. Server-Side Implementation
- [ ] 3.1 Deploy `save-fcm-token` Edge Function
- [ ] 3.2 Deploy `send-push-notification` Edge Function
- [ ] 3.3 Verify `google-auth.ts` shared module
- [ ] 3.4 Integrate notification trigger in `create_repair_request` flow for all new repair requests (any priority) (Database Trigger or RPC)

## 4. Verification
- [ ] 4.1 Verify token generation and storage in `user_fcm_tokens`
- [ ] 4.2 Test foreground notification reception
- [ ] 4.3 Test background notification reception
