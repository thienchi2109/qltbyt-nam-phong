# Firebase Push Notifications Integration Flow

## Overview

This document describes the complete push notification flow for the Vietnamese Medical Equipment Management System, from user registration to notification delivery.

**Status:** ⚠️ Prepared but NOT currently active (requires Firebase configuration and package installation)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PUSH NOTIFICATION FLOW                            │
└─────────────────────────────────────────────────────────────────────────┘

1. USER REGISTRATION PHASE
   ┌──────────────┐
   │   Browser    │
   │   (Client)   │
   └──────┬───────┘
          │
          │ (1) Request notification permission
          │     via firebase-utils.tsx
          ▼
   ┌──────────────┐
   │   Firebase   │
   │   SDK        │
   └──────┬───────┘
          │
          │ (2) Generate FCM token
          │
          ▼
   ┌──────────────┐
   │ Supabase     │
   │ Edge Fn:     │
   │ save-fcm-    │
   │ token        │
   └──────┬───────┘
          │
          │ (3) Store token in database
          ▼
   ┌──────────────┐
   │ user_fcm_    │
   │ tokens table │
   └──────────────┘

2. NOTIFICATION TRIGGER PHASE
   ┌──────────────┐
   │ Application  │
   │ Event        │
   │ (e.g., new   │
   │ repair req)  │
   └──────┬───────┘
          │
          │ (4) Trigger notification
          ▼
   ┌──────────────┐
   │ Supabase     │
   │ Edge Fn:     │
   │ send-push-   │
   │ notification │
   └──────┬───────┘
          │
          │ (5) Fetch user FCM tokens
          │
   ┌──────┴───────┐
   │ user_fcm_    │
   │ tokens table │
   └──────┬───────┘
          │
          │ (6) Get OAuth2 token
          ▼
   ┌──────────────┐
   │ Google Auth  │
   │ (_shared/    │
   │ google-      │
   │ auth.ts)     │
   └──────┬───────┘
          │
          │ (7) Send to FCM
          ▼
   ┌──────────────┐
   │ Firebase     │
   │ Cloud        │
   │ Messaging    │
   │ (FCM)        │
   └──────┬───────┘
          │
          │ (8) Deliver notification
          │
          ├─────────────────┬──────────────────┐
          │                 │                  │
          ▼                 ▼                  ▼
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │ Browser  │      │ Browser  │      │ Browser  │
   │ (App     │      │ (Back-   │      │ (Closed) │
   │ Active)  │      │ ground)  │      │          │
   └──────────┘      └──────────┘      └──────────┘
   Foreground        Service Worker    Service Worker
   Handler           + Notification    + Notification
```

---

## Phase 1: User Registration & Token Generation

### Step 1: Request Notification Permission

**When:** User first visits the app or explicitly enables notifications

**File:** `src/lib/firebase-utils.tsx`

```typescript
import { requestNotificationPermissionAndGetToken } from '@/lib/firebase-utils'

// Request permission and get FCM token
const token = await requestNotificationPermissionAndGetToken(
  firebaseConfig,
  vapidKey
)
```

**What happens:**
1. Browser displays native permission dialog: "Allow notifications?"
2. If user grants permission → proceed to get token
3. If user denies → return null, no further action

**Browser Compatibility:**
- ✅ Chrome/Edge: Full support
- ✅ Firefox: Full support
- ✅ Safari: iOS 16.4+ (limited support)
- ❌ Safari < 16.4: No support

---

### Step 2: Generate FCM Token

**Library:** `firebase/messaging` (dynamic import)

**Process:**
1. Firebase SDK communicates with FCM servers
2. FCM generates unique token for this browser/device
3. Token is device-specific and tied to:
   - Browser instance
   - Device
   - Firebase project
   - VAPID public key

**Token Format:** ~150-character string
```
Example: cXYZ123abc...def456 (actual tokens are longer)
```

**Token Lifetime:**
- Tokens can become invalid when:
  - User clears browser data
  - User revokes notification permission
  - App is uninstalled (mobile)
  - Firebase detects token is no longer valid
- Tokens should be refreshed periodically

---

### Step 3: Store Token in Database

**API Endpoint:** `supabase/functions/save-fcm-token/index.ts`

**HTTP Request:**
```typescript
POST /functions/v1/save-fcm-token
Authorization: Bearer <supabase-auth-token>
Content-Type: application/json

{
  "fcmToken": "cXYZ123abc...def456"
}
```

**Process:**
1. Edge Function validates user authentication via Supabase Auth
2. Extracts `user_id` from authenticated session
3. Upserts token to `user_fcm_tokens` table:
   ```sql
   INSERT INTO user_fcm_tokens (user_id, fcm_token, updated_at)
   VALUES ($1, $2, NOW())
   ON CONFLICT (user_id, fcm_token)
   DO UPDATE SET updated_at = NOW()
   ```

**Why UPSERT?**
- Users may have multiple devices/browsers
- Same token shouldn't be stored multiple times
- Updates `updated_at` to track active tokens

**Database Schema:**
```sql
CREATE TABLE public.user_fcm_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  fcm_token TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fcm_token)
);
```

**Security:**
- ✅ User can only save their own token (enforced by auth)
- ✅ No cross-user token access
- ✅ Tokens stored securely in database

---

## Phase 2: Sending Push Notifications

### Step 4: Trigger Notification

**Trigger Points in Application:**

1. **New Repair Request** (High Priority)
   ```typescript
   // After creating repair request
   await callRpc({ fn: 'send_push_notification', args: {
     userIds: [technician_id, to_qltb_id],
     notificationPayload: {
       title: 'Yêu cầu sửa chữa mới',
       body: `Thiết bị: ${equipment_name}`,
       data: {
         url: '/repair-requests',
         requestId: request_id
       }
     }
   }})
   ```

2. **Transfer Approval Required**
   ```typescript
   await callRpc({ fn: 'send_push_notification', args: {
     userIds: [manager_id],
     notificationPayload: {
       title: 'Chờ phê duyệt luân chuyển',
       body: `${equipment_count} thiết bị cần phê duyệt`,
       data: {
         url: '/transfers',
         status: 'pending_approval'
       }
     }
   }})
   ```

3. **Maintenance Reminder** (Scheduled)
   ```typescript
   // Via scheduled job or database trigger
   await callRpc({ fn: 'send_push_notification', args: {
     userIds: [technician_ids],
     notificationPayload: {
       title: 'Nhắc nhở bảo trì',
       body: `${task_count} nhiệm vụ bảo trì hôm nay`,
       data: {
         url: '/maintenance',
         date: today
       }
     }
   }})
   ```

4. **Equipment Status Change**
   ```typescript
   await callRpc({ fn: 'send_push_notification', args: {
     userIds: [department_users],
     notificationPayload: {
       title: 'Cập nhật thiết bị',
       body: `${equipment_name} đã ${new_status}`,
       data: {
         url: `/equipment?id=${equipment_id}`,
         equipmentId: equipment_id
       }
     }
   }})
   ```

---

### Step 5: Fetch User FCM Tokens

**File:** `supabase/functions/send-push-notification/index.ts`

**Process:**
1. Receive `userIds` array (who should receive notification)
2. Query database for all FCM tokens:
   ```typescript
   const { data: tokensData } = await supabaseAdminClient
     .from('user_fcm_tokens')
     .select('fcm_token')
     .in('user_id', userIds)
   ```

**Result:**
```typescript
[
  { fcm_token: "token1_for_user1_chrome" },
  { fcm_token: "token2_for_user1_mobile" },
  { fcm_token: "token3_for_user2_firefox" },
]
```

**Multi-Device Support:**
- Single user can have multiple tokens (desktop + mobile)
- Notification sent to ALL tokens = ALL devices get notified
- User sees notification on whichever device they're using

**No Tokens Found:**
- Returns 200 OK with message "No FCM tokens found"
- Not an error - user simply hasn't enabled notifications
- Graceful degradation (app still works without notifications)

---

### Step 6: Get OAuth2 Access Token

**File:** `supabase/functions/_shared/google-auth.ts`

**Why needed:**
- FCM HTTP v1 API requires **OAuth 2.0 access token** (not API key)
- Old legacy API used server keys (deprecated)
- New API uses service account authentication

**Process:**

1. **Load Service Account Credentials** (from environment):
   ```typescript
   const serviceAccount = {
     project_id: Deno.env.get('FIREBASE_PROJECT_ID'),
     client_email: Deno.env.get('FIREBASE_CLIENT_EMAIL'),
     private_key: Deno.env.get('FIREBASE_PRIVATE_KEY'),
   }
   ```

2. **Create Signed JWT** (using RSA-SHA256):
   ```typescript
   const jwt = await new SignJWT({
     scope: 'https://www.googleapis.com/auth/firebase.messaging',
   })
     .setIssuer(serviceAccount.client_email)
     .setSubject(serviceAccount.client_email)
     .setAudience('https://oauth2.googleapis.com/token')
     .setExpirationTime(now + 3600) // 1 hour
     .sign(privateKey)
   ```

3. **Exchange JWT for Access Token**:
   ```typescript
   const response = await fetch('https://oauth2.googleapis.com/token', {
     method: 'POST',
     body: new URLSearchParams({
       grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
       assertion: signedJwt,
     }),
   })

   const { access_token } = await response.json()
   ```

4. **Use Access Token** for FCM API calls

**Token Caching:**
- Access tokens expire after 1 hour
- Should implement caching to avoid regenerating for every notification
- Current implementation: regenerates each time (acceptable for low volume)

**Security:**
- Private key never leaves server
- JWT signed server-side only
- Access token has limited scope (only FCM)

---

### Step 7: Send to Firebase Cloud Messaging

**File:** `supabase/functions/send-push-notification/index.ts`

**API Endpoint:**
```
POST https://fcm.googleapis.com/v1/projects/{project-id}/messages:send
```

**Request Format:**
```typescript
{
  "message": {
    "token": "user_fcm_token",
    "notification": {
      "title": "Yêu cầu sửa chữa mới",
      "body": "Thiết bị: Máy X-quang"
    },
    "data": {
      "url": "/repair-requests",
      "requestId": "123"
    },
    "webpush": {
      "notification": {
        "icon": "/icons/icon-192x192.png",
        "badge": "/icons/badge-72x72.png",
        "requireInteraction": false
      },
      "fcm_options": {
        "link": "https://yourdomain.com/repair-requests"
      }
    }
  }
}
```

**Headers:**
```typescript
Authorization: Bearer <oauth2-access-token>
Content-Type: application/json
```

**Response Handling:**

✅ **Success (200 OK):**
```json
{
  "name": "projects/your-project/messages/0:1234567890"
}
```

❌ **Error (400/404):**
```json
{
  "error": {
    "code": 404,
    "message": "Requested entity was not found.",
    "status": "NOT_FOUND",
    "details": [
      {
        "@type": "type.googleapis.com/google.firebase.fcm.v1.FcmError",
        "errorCode": "UNREGISTERED"
      }
    ]
  }
}
```

**Common Error Codes:**
- `UNREGISTERED` - Token is invalid/expired → Remove from database
- `INVALID_ARGUMENT` - Malformed request → Check payload format
- `SENDER_ID_MISMATCH` - Token not for this project → User registered with different project
- `QUOTA_EXCEEDED` - Rate limit hit → Implement backoff

**Current Implementation:**
```typescript
for (const record of tokensData) {
  const result = await sendFcmMessage(
    accessToken,
    projectId,
    record.fcm_token,
    notificationPayload
  )
  results.push({ token: record.fcm_token, ...result })
}
```

**TODO:** Handle invalid tokens and remove from database

---

### Step 8: Notification Delivery

#### **Scenario A: App is Active (Foreground)**

**Handler:** `src/lib/firebase.ts` - `onForegroundMessage()`

**Process:**
1. FCM delivers message to browser
2. Firebase SDK triggers `onMessage` callback
3. Custom handler receives payload:
   ```typescript
   {
     notification: {
       title: "Yêu cầu sửa chữa mới",
       body: "Thiết bị: Máy X-quang"
     },
     data: {
       url: "/repair-requests",
       requestId: "123"
     }
   }
   ```

4. **Custom UI handling** (NOT browser notification):
   - Display toast notification
   - Update UI state (e.g., increment badge count)
   - Play notification sound
   - Optionally auto-navigate to relevant page

**Why not show browser notification?**
- User is already in the app
- Better UX to show in-app notification
- Avoids notification spam

**Example Implementation:**
```typescript
import { toast } from '@/components/ui/use-toast'

onForegroundMessage(config, (payload) => {
  toast({
    title: payload.notification.title,
    description: payload.notification.body,
    action: payload.data?.url ? {
      label: 'Xem',
      onClick: () => router.push(payload.data.url)
    } : undefined
  })
})
```

---

#### **Scenario B: App is in Background**

**Handler:** `public/firebase-messaging-sw.js` - Service Worker

**Process:**
1. FCM delivers message to service worker
2. Service worker triggers `onBackgroundMessage` event:
   ```javascript
   messaging.onBackgroundMessage((payload) => {
     const notificationTitle = payload.notification?.title || 'Thông báo mới'
     const notificationOptions = {
       body: payload.notification?.body || 'Bạn có tin nhắn mới.',
       icon: '/icons/icon-192x192.png',
       badge: '/icons/badge-72x72.png',
       data: payload.data
     }

     return self.registration.showNotification(notificationTitle, notificationOptions)
   })
   ```

3. **Browser shows notification** (system notification)
4. User clicks notification → `notificationclick` event:
   ```javascript
   self.addEventListener('notificationclick', (event) => {
     event.notification.close()
     const urlToOpen = event.notification.data?.url || '/'

     // Focus existing tab or open new one
     clients.matchAll({ type: 'window' }).then((clientList) => {
       const existingClient = clientList.find(client =>
         client.url === self.location.origin + urlToOpen
       )
       if (existingClient) {
         return existingClient.focus()
       }
       return clients.openWindow(urlToOpen)
     })
   })
   ```

**Notification Appearance:**
- Uses system notification UI (varies by OS/browser)
- Chrome: Rich notifications with actions
- Firefox: Standard notifications
- Safari: Basic notifications (iOS 16.4+)

---

#### **Scenario C: App is Closed**

**Same as Scenario B** - Service Worker handles everything

**Key Difference:**
- Service worker runs even when app is closed
- Clicking notification opens app to specified URL
- First interaction after device restart may require user gesture

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPLETE DATA FLOW                           │
└─────────────────────────────────────────────────────────────────┘

[User Opens App]
      │
      │ 1. Request permission via firebase-utils.tsx
      ▼
[Firebase SDK] ──► [FCM Servers]
      │               │
      │ 2. Generate   │
      │    token      │
      ▼               │
[Client gets token]   │
      │               │
      │ 3. POST /functions/v1/save-fcm-token
      ▼
[Supabase Edge Function: save-fcm-token]
      │
      │ 4. Authenticate user
      ▼
[Supabase Auth]
      │
      │ 5. Get user_id
      ▼
[user_fcm_tokens table]
      │
      │ INSERT/UPDATE token
      ▼
[Token Stored] ✓

... Later, when event occurs ...

[Application Event] (e.g., new repair request)
      │
      │ 6. Trigger notification
      ▼
[Supabase Edge Function: send-push-notification]
      │
      ├─► 7. SELECT tokens WHERE user_id IN (...)
      │   [user_fcm_tokens table]
      │
      ├─► 8. Get OAuth2 token
      │   [google-auth.ts]
      │   │
      │   ├─► Load service account
      │   ├─► Sign JWT
      │   └─► Exchange for access token
      │
      └─► 9. For each token:
          POST https://fcm.googleapis.com/v1/projects/{id}/messages:send
          [Firebase Cloud Messaging]
                │
                ├─────────────────┬──────────────────┐
                │                 │                  │
                ▼                 ▼                  ▼
          [User Device 1]   [User Device 2]   [User Device 3]
                │                 │                  │
          [onMessage]       [Service Worker]  [Service Worker]
                │                 │                  │
          [Toast UI]      [Notification]     [Notification]
```

---

## Multi-Tenant Considerations

### User Targeting by Role

**Global Users:**
```typescript
// Notify all global admins
const globalUsers = await callRpc({ fn: 'users_by_role', args: { p_role: 'global' } })
const globalUserIds = globalUsers.map(u => u.id)
await sendNotification(globalUserIds, payload)
```

**Tenant-Specific Users:**
```typescript
// Notify all technicians in specific tenant
const technicianIds = await callRpc({
  fn: 'users_by_role_and_tenant',
  args: {
    p_role: 'technician',
    p_don_vi: 'BVDKAG'
  }
})
await sendNotification(technicianIds, payload)
```

**Regional Leaders:**
```typescript
// Notify regional leaders responsible for this area
const regionalLeaderIds = await callRpc({
  fn: 'users_by_region',
  args: { p_dia_ban_id: region_id }
})
await sendNotification(regionalLeaderIds, payload)
```

### Notification Content Personalization

```typescript
// Include tenant context in notification
const notificationPayload = {
  title: `[${tenantName}] Yêu cầu sửa chữa mới`,
  body: `Thiết bị: ${equipmentName} - ${departmentName}`,
  data: {
    url: '/repair-requests',
    tenantId: tenant_id,
    requestId: request_id
  }
}
```

---

## Security Considerations

### Token Management

✅ **Secure:**
- Tokens stored in database (not localStorage)
- Server-side validation on all operations
- No direct token access from client

❌ **Risks:**
- Stale tokens accumulate → Implement cleanup job
- User changes device → Multiple tokens per user (expected)
- Token theft → Limited damage (only notification access)

### Authorization

✅ **Enforced:**
- Users can only save their own tokens (via Supabase Auth)
- Only server can send notifications (service account)
- Notification triggers require proper role permissions

### Data Privacy

✅ **Protected:**
- Notification content should not include sensitive data
- Use generic titles, specific content only when user opens
- Example:
  ```typescript
  // ✓ Good
  { title: "Thông báo mới", body: "Bạn có 1 yêu cau mới" }

  // ✗ Bad (includes patient data)
  { title: "Bệnh nhân Nguyễn Văn A", body: "Ca mổ lúc 10:00" }
  ```

---

## Performance Optimization

### Token Cleanup Job

**Problem:** Stale tokens accumulate over time

**Solution:** Scheduled cleanup (run daily)
```sql
-- Delete tokens not updated in 90 days
DELETE FROM user_fcm_tokens
WHERE updated_at < NOW() - INTERVAL '90 days';
```

### Batch Notifications

**Problem:** Sending 100+ notifications serially is slow

**Solution:** Batch requests or use multicast
```typescript
// Current: Serial (slow for many users)
for (const token of tokens) {
  await sendFcmMessage(token, payload)
}

// Better: Parallel with rate limiting
const chunks = chunkArray(tokens, 10) // 10 concurrent
for (const chunk of chunks) {
  await Promise.all(
    chunk.map(token => sendFcmMessage(token, payload))
  )
}

// Best: Use FCM multicast (up to 500 tokens)
await fcm.sendMulticast({
  tokens: tokens.slice(0, 500),
  notification: payload
})
```

### OAuth Token Caching

**Problem:** Regenerating OAuth token for every notification

**Solution:** Cache token for 50 minutes (expires at 60)
```typescript
let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  const token = await generateOAuthToken()
  cachedToken = {
    token,
    expiresAt: Date.now() + 50 * 60 * 1000 // 50 minutes
  }
  return token
}
```

---

## Testing

### Local Development

1. **Test Token Generation:**
   ```bash
   # In browser console
   const token = await requestNotificationPermissionAndGetToken(config, vapidKey)
   console.log('FCM Token:', token)
   ```

2. **Test Token Storage:**
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/save-fcm-token \
     -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"fcmToken": "YOUR_FCM_TOKEN"}'
   ```

3. **Test Notification Sending:**
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/send-push-notification \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "userIds": ["user123"],
       "notificationPayload": {
         "title": "Test",
         "body": "This is a test notification",
         "data": { "url": "/" }
       }
     }'
   ```

### Production Testing

1. **Canary Users:** Test with small group first
2. **Monitor Errors:** Check Supabase Edge Function logs
3. **Track Delivery:** Monitor FCM console for delivery rates
4. **User Feedback:** Survey users on notification helpfulness

---

## Troubleshooting

### "No registration token available"

**Cause:** User denied notification permission

**Fix:** Provide UI to re-request permission
```typescript
if (Notification.permission === 'denied') {
  // Show instruction to re-enable in browser settings
}
```

### "Token has been unregistered"

**Cause:** User cleared browser data or token expired

**Fix:** Remove token from database, prompt user to re-register
```typescript
if (error.code === 'UNREGISTERED') {
  await supabase
    .from('user_fcm_tokens')
    .delete()
    .eq('fcm_token', token)
}
```

### "Service worker not registered"

**Cause:** HTTPS required for service workers

**Fix:** Use `npm run dev-https` or deploy to HTTPS domain

### Notifications not appearing

**Checklist:**
- [ ] Browser notification permission granted?
- [ ] Service worker registered? (check DevTools > Application)
- [ ] Token saved in database? (check `user_fcm_tokens` table)
- [ ] FCM configuration correct? (check Firebase Console)
- [ ] Do Not Disturb mode disabled? (OS-level)
- [ ] Browser notifications enabled in OS settings?

---

## Future Enhancements

1. **Notification Preferences:**
   - User settings to control which notifications they receive
   - Quiet hours configuration
   - Notification channel categories

2. **Rich Notifications:**
   - Action buttons (Approve/Reject directly from notification)
   - Images in notifications
   - Custom sounds per notification type

3. **Analytics:**
   - Track notification open rates
   - Measure engagement
   - A/B test notification content

4. **Smart Batching:**
   - Combine multiple similar notifications into one
   - "You have 5 new repair requests" instead of 5 separate notifications

5. **Priority Levels:**
   - High priority: Immediate delivery
   - Normal: Batched delivery
   - Low: Delivered during off-peak hours

---

## Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Web Push Notifications Guide](https://web.dev/push-notifications-overview/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)

---

## Quick Start Checklist

- [ ] Install Firebase package: `npm install firebase`
- [ ] Create Firebase project and enable FCM
- [ ] Generate VAPID key in Firebase Console
- [ ] Download service account JSON
- [ ] Add Firebase config to environment variables
- [ ] Update `firebase.ts` and `firebase-messaging-sw.js` with real config
- [ ] Create `user_fcm_tokens` database table
- [ ] Add Supabase Edge Function environment variables
- [ ] Deploy Edge Functions
- [ ] Test token registration in browser
- [ ] Test notification sending
- [ ] Integrate notification triggers in application events
- [ ] Monitor FCM console for delivery metrics
