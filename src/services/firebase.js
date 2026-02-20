const admin = require("firebase-admin");

let firebaseApp = null;

async function initializeFirebase() {
    if (firebaseApp) {
        return firebaseApp;
    }

    try {
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
            ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
            : null;

        if (serviceAccount) {
            firebaseApp = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log("Firebase initialized successfully");
        } else {
            console.warn("Firebase service account not configured. Push notifications will be disabled.");
        }

        return firebaseApp;
    } catch (error) {
        console.error("Firebase initialization error:", error);
        return null;
    }
}

async function sendPushNotification(title, message, fcmTokens, data = {}) {
    if (!firebaseApp) {
        console.warn("Firebase not initialized. Skipping push notification.");
        return { success: 0, failure: fcmTokens.length };
    }

    try {
        if (!Array.isArray(fcmTokens) || fcmTokens.length === 0) {
            return { success: 0, failure: 0 };
        }

        const validTokens = fcmTokens.filter(token => token && typeof token === 'string');

        if (validTokens.length === 0) {
            return { success: 0, failure: 0 };
        }

        const notificationMessage = {
            notification: {
                title: title,
                body: message,
            },
            data: {
                ...data,
                timestamp: new Date().toISOString(),
            },
            tokens: validTokens,
        };

        const response = await admin.messaging().sendEachForMulticast(notificationMessage);

        console.log(`Push notifications sent: ${response.successCount} success, ${response.failureCount} failed`);

        return {
            success: response.successCount,
            failure: response.failureCount,
            responses: response.responses,
        };
    } catch (error) {
        console.error("Error sending push notification:", error);
        return { success: 0, failure: fcmTokens.length, error: error.message };
    }
}

async function sendPushNotificationInBatches(title, message, fcmTokens, data = {}, batchSize = 500) {
    const results = {
        totalSuccess: 0,
        totalFailure: 0,
    };

    for (let i = 0; i < fcmTokens.length; i += batchSize) {
        const batchTokens = fcmTokens.slice(i, i + batchSize);
        const result = await sendPushNotification(title, message, batchTokens, data);

        results.totalSuccess += result.success;
        results.totalFailure += result.failure;
    }

    return results;
}

module.exports = {
    initializeFirebase,
    sendPushNotification,
    sendPushNotificationInBatches,
};
