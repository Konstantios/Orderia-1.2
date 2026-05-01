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
        const { recipientUid, title, body, link } = await request.json();

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

        // 2. Fetch FCM Tokens from Firestore
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectID}/databases/(default)/documents/fcmTokens`;
        
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
                    data: { link: link || '/orders/new' },
                    webpush: {
                        fcm_options: {
                            link: link || '/orders/new'
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
