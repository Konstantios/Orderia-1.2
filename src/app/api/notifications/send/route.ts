import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Helper to get access token from Google using Service Account without firebase-admin
async function getAccessToken(clientEmail: string, privateKey: string) {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;

    const header = { alg: 'RS256', typ: 'JWT' };
    const payload = {
        iss: clientEmail,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        exp,
        iat,
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(privateKey, 'base64url');

    const jwt = `${signatureInput}.${signature}`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt,
        }),
    });

    const data = await response.json();
    return data.access_token;
}

export async function POST(request: Request) {
    try {
        const { recipientUid, title, body } = await request.json();

        if (!recipientUid) {
            return NextResponse.json({ error: 'Missing recipientUid' }, { status: 400 });
        }

        const projectID = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!projectID || !clientEmail || !privateKey) {
            console.error('[API] Missing environment variables');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // 1. Get Access Token
        const accessToken = await getAccessToken(clientEmail, privateKey);

        // 2. Fetch FCM Tokens from Firestore (we can't easily use firestore SDK in API route WITHOUT firebase-admin 
        // if we want to bypass the 50 docs limit and complex rules, but since this is a Next.js route, 
        // we should ideally use the REST API for Firestore too or check if we can use the regular firebase SDK).
        
        // Actually, let's use the FCM tokens collection from Firestore. 
        // Since we are on the server, we can use the Firestore REST API to get tokens.
        
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectID}/databases/(default)/documents/fcmTokens`;
        // Note: This requires the Firestore to be accessible or use the same access token.
        
        const tokensResponse = await fetch(`${firestoreUrl}?mask.fieldPaths=token&where.fieldFilter.field.fieldPath=userId&where.fieldFilter.op=EQUAL&where.fieldFilter.value.stringValue=${recipientUid}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        // Simplified approach for now: Get tokens via a simpler list call and filter
        const listResponse = await fetch(firestoreUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const listData = await listResponse.json();
        const tokens = Array.from(new Set(
            (listData.documents || [])
                .filter((doc: any) => doc.fields.userId?.stringValue === recipientUid)
                .map((doc: any) => doc.fields.token?.stringValue)
        ));

        if (tokens.length === 0) {
            return NextResponse.json({ success: true, message: 'No tokens found for user' });
        }

        // 3. Send Notifications
        const sendResults = await Promise.all(tokens.map(async (token: string) => {
            const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectID}/messages:send`;
            const messagePayload = {
                message: {
                    token,
                    notification: { title, body },
                    webpush: {
                        fcm_options: {
                            link: '/orders/new'
                        }
                    }
                }
            };

            return fetch(fcmUrl, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(messagePayload)
            });
        }));

        const results = await Promise.all(sendResults.map(r => r.json()));
        console.log('[API] FCM Send Results:', results);

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error('[API] Send Notification Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
