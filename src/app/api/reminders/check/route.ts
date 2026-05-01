import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Reuse the same helper to get access token
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

export async function GET() {
    try {
        const projectID = process.env.FIREBASE_PROJECT_ID;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

        if (!projectID || !clientEmail || !privateKey) {
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const accessToken = await getAccessToken(clientEmail, privateKey);

        // 1. Fetch all reminders using Collection Group Query (via REST API)
        // Note: Collection group queries in REST are a bit complex, 
        // for simplicity and performance we'll fetch all documents from the 'reminders' collection group
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectID}/databases/(default)/documents:runQuery`;
        
        // Get current time in Greece (Europe/Athens)
        const now = new Date();
        const greeceTime = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Europe/Athens',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            weekday: 'long',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).formatToParts(now);

        const getPart = (type: string) => greeceTime.find(p => p.type === type)?.value || '';
        
        // Map English weekday to Greek for the database
        const dayMap: Record<string, string> = {
            'Monday': 'Δευτέρα',
            'Tuesday': 'Τρίτη',
            'Wednesday': 'Τετάρτη',
            'Thursday': 'Πέμπτη',
            'Friday': 'Παρασκευή',
            'Saturday': 'Σάββατο',
            'Sunday': 'Κυριακή'
        };

        const currentDayEn = getPart('weekday');
        const currentDay = dayMap[currentDayEn] || 'Δευτέρα';
        const currentTime = `${getPart('hour')}:${getPart('minute')}`;
        const currentMinuteKey = `${getPart('year')}-${getPart('month')}-${getPart('day')}T${currentTime}`;

        const queryBody = {
            structuredQuery: {
                from: [{ collectionId: 'reminders', allDescendants: true }],
                where: {
                    fieldFilter: {
                        field: { fieldPath: 'isActive' },
                        op: 'EQUAL',
                        value: { booleanValue: true }
                    }
                }
            }
        };

        // Look back 5 minutes to see if any reminder was missed
        const checkWindows = [];
        for (let i = 0; i < 5; i++) {
            const windowTime = new Date(now.getTime() - i * 60000);
            const gTime = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Europe/Athens',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                weekday: 'long',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).formatToParts(windowTime);

            const getP = (type: string) => gTime.find(p => p.type === type)?.value || '';
            
            const dEn = getP('weekday');
            const dGr = dayMap[dEn] || 'Δευτέρα';
            const t = `${getP('hour')}:${getP('minute')}`;
            const key = `${getP('year')}-${getP('month')}-${getP('day')}T${t}`;
            
            checkWindows.push({ day: dGr, time: t, key });
        }

        // Re-use queryBody or simply remove the duplicate const declaration
        // We already have queryBody defined above at line 90.

        const queryResponse = await fetch(firestoreUrl, {
            method: 'POST',
            headers: { 
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(queryBody)
        });

        const queryResults = await queryResponse.json();
        
        if (!Array.isArray(queryResults)) {
             return NextResponse.json({ success: true, message: 'No reminders found' });
        }

        const triggeredResults = [];

        for (const result of queryResults) {
            const doc = result.document;
            if (!doc) continue;

            const fields = doc.fields;
            const schedules = fields.schedules?.arrayValue?.values || [];
            const lastTriggered = fields.lastTriggered?.stringValue;
            const ownerId = fields.ownerId?.stringValue;
            const businessName = fields.businessName?.stringValue || 'Orderia';

            // Check if ANY of the minutes in our 5-minute window matches a schedule
            let match = null;
            for (const window of checkWindows) {
                const found = schedules.find((s: any) => {
                    const mapValue = s.mapValue?.fields;
                    return mapValue?.day?.stringValue === window.day && mapValue?.time?.stringValue === window.time;
                });
                
                if (found && lastTriggered !== window.key) {
                    match = window;
                    break;
                }
            }

            if (match && ownerId) {
                console.log(`[Cron] Triggering alarm for user ${ownerId} at ${match.time}`);

                // 1. Update lastTriggered in Firestore to avoid double firing
                const docPath = doc.name; // Full path
                await fetch(`https://firestore.googleapis.com/v1/${docPath}?updateMask.fieldPaths=lastTriggered`, {
                    method: 'PATCH',
                    headers: { 
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fields: {
                            ...fields,
                            lastTriggered: { stringValue: match.key }
                        }
                    })
                });

                // 2. Fetch FCM Tokens for this user specifically using a query
                let tokens: string[] = [];
                try {
                    const tokensQueryUrl = `https://firestore.googleapis.com/v1/projects/${projectID}/databases/(default)/documents:runQuery`;
                    const tokensQueryResponse = await fetch(tokensQueryUrl, {
                        method: 'POST',
                        headers: { 
                            Authorization: `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            structuredQuery: {
                                from: [{ collectionId: 'fcmTokens' }],
                                where: {
                                    fieldFilter: {
                                        field: { fieldPath: 'userId' },
                                        op: 'EQUAL',
                                        value: { stringValue: ownerId }
                                    }
                                }
                            }
                        })
                    });
                    
                    const tokensQueryResult = await tokensQueryResponse.json();
                    if (Array.isArray(tokensQueryResult)) {
                        tokens = tokensQueryResult
                            .filter(r => r.document)
                            .map(r => r.document.fields.token?.stringValue)
                            .filter(t => !!t);
                    }
                } catch (tokenError) {
                    console.error(`[Cron] Error fetching tokens for ${ownerId}:`, tokenError);
                }

                // 3. Send Push Notifications if tokens found
                if (tokens.length > 0) {
                    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectID}/messages:send`;
                    for (const token of tokens) {
                        try {
                            await fetch(fcmUrl, {
                                method: 'POST',
                                headers: {
                                    Authorization: `Bearer ${accessToken}`,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    message: {
                                        token,
                                        notification: {
                                            title: '⏰ ΥΠΕΝΘΥΜΙΣΗ ΠΑΡΑΓΓΕΛΙΑΣ',
                                            body: `Ήρθε η ώρα για την παραγγελία σας στο κατάστημα ${businessName}!`
                                        },
                                        android: {
                                            priority: 'high',
                                            notification: {
                                                sound: 'default',
                                                click_action: 'OPEN_ALARM',
                                                tag: 'order_reminder'
                                            }
                                        },
                                        webpush: {
                                            headers: { Urgency: 'high' },
                                            notification: {
                                                requireInteraction: true,
                                                vibrate: [200, 100, 200, 100, 200, 100, 200],
                                                icon: '/icons/icon-192x192.png',
                                                tag: 'order_reminder'
                                            },
                                            fcm_options: { link: '/orders/new?alarm=true' }
                                        },
                                        data: {
                                            type: 'ALARM',
                                            storeName: businessName,
                                            link: '/orders/new?alarm=true'
                                        }
                                    }
                                })
                            });
                        } catch (fcmError) {
                            console.error(`[Cron] Error sending FCM to token:`, fcmError);
                        }
                    }
                }

                // 4. Create a notification record in Firestore for the UI list
                try {
                    const notificationUrl = `https://firestore.googleapis.com/v1/projects/${projectID}/databases/(default)/documents/notifications`;
                    await fetch(notificationUrl, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            fields: {
                                 title: { stringValue: '⏰ ΥΠΕΝΘΥΜΙΣΗ ΠΑΡΑΓΓΕΛΙΑΣ' },
                                 description: { stringValue: `Ήρθε η ώρα για την παραγγελία σας στο κατάστημα ${businessName}!` },
                                 createdAt: { timestampValue: new Date().toISOString() },
                                 date: { stringValue: new Date().toISOString() },
                                 read: { booleanValue: false },
                                 recipientUid: { stringValue: ownerId },
                                 type: { stringValue: 'order_reminder' },
                                 storeId: { stringValue: fields.storeId?.stringValue || '' },
                                 storeName: { stringValue: businessName },
                                 wholesalerId: { stringValue: 'system' },
                                 wholesalerName: { stringValue: 'Υπενθύμιση' }
                            }
                        })
                    });
                } catch (notifError) {
                    console.error(`[Cron] Error creating notification record:`, notifError);
                }

                triggeredResults.push({ ownerId, status: 'processed' });
            }
        }

        return NextResponse.json({ 
            success: true, 
            checkedAt: currentMinuteKey,
            triggered: triggeredResults 
        });

    } catch (error: any) {
        console.error('[Cron] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
