import { SignJWT } from "https://deno.land/x/jose@v4.14.4/jwt/sign.ts"; // Using jose for JWT

const GOOGLE_TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_SCOPE = "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase.messaging";

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

async function createSignedJwt(serviceAccount: ServiceAccount): Promise<string> {
  const privateKeyText = serviceAccount.private_key.replace(/\\n/g, '\n');

  // Import private key
  // The jose library expects the key in a specific format (CryptoKey).
  // We need to convert the PEM string to a CryptoKey.
  // This is a simplified version; proper PEM parsing might be more robust.
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  let pemContents = privateKeyText.substring(pemHeader.length, privateKeyText.length - pemFooter.length -1 ); // -1 for the last \n before footer
  pemContents = pemContents.replace(/\s+/g, ''); // remove all whitespace

  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const algorithm = {
    name: "RSASSA-PKCS1-v1_5",
    hash: "SHA-256",
  };

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    algorithm,
    true, // extractable
    ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  const
   jwt = await new SignJWT({
    scope: GOOGLE_AUTH_SCOPE,
    // aud: GOOGLE_TOKEN_AUDIENCE, // aud is typically part of the assertion for exchanging the token
    // iss: serviceAccount.client_email,
    // sub: serviceAccount.client_email,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: serviceAccount.private_key_id })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600) // 1 hour
    .setIssuer(serviceAccount.client_email)
    .setSubject(serviceAccount.client_email)
    .setAudience(GOOGLE_TOKEN_AUDIENCE) // Audience for the OAuth token endpoint
    .sign(privateKey);
  return jwt;
}

export async function getAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL');
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY');
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID'); // Also part of service account

  if (!clientEmail || !privateKey || !projectId) {
    throw new Error('Missing Firebase service account credentials in environment variables.');
  }

  const serviceAccount: ServiceAccount = {
    type: "service_account",
    project_id: projectId,
    private_key_id: Deno.env.get('FIREBASE_PRIVATE_KEY_ID') || "", // Optional, but good for JWT header
    private_key: privateKey,
    client_email: clientEmail,
    client_id: Deno.env.get('FIREBASE_CLIENT_ID') || "", // Optional
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: GOOGLE_TOKEN_AUDIENCE,
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`
  };

  const signedJwt = await createSignedJwt(serviceAccount);

  const tokenResponse = await fetch(GOOGLE_TOKEN_AUDIENCE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text();
    throw new Error(`Failed to fetch access token: ${tokenResponse.status} ${errorData}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}
