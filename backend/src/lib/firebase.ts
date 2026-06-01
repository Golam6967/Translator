import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
let isInitialized = false;

const initializeFirebase = () => {
  if (isInitialized || admin.apps.length > 0) {
    console.log("[FIREBASE] Firebase already initialized");
    return;
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountKey) {
    console.warn(
      "[FIREBASE] FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. Firebase authentication will not work until it is configured.",
    );
    return;
  }

  try {
    const credentials = JSON.parse(serviceAccountKey);
    admin.initializeApp({
      credential: admin.credential.cert(credentials),
    });
    isInitialized = true;
    console.log("[FIREBASE] Firebase Admin SDK initialized successfully");
  } catch (error) {
    console.error("[FIREBASE] Failed to initialize Firebase Admin SDK:", error);
    console.warn(
      "[FIREBASE] Firebase authentication will not work until configuration is fixed",
    );
  }
};

// Initialize immediately
initializeFirebase();

export { admin, isInitialized };
export default admin;
