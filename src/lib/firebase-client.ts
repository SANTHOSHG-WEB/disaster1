import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isBrowser = typeof window !== 'undefined';
const hasConfig = firebaseConfig.projectId && firebaseConfig.databaseURL;

let db: any;

if (isBrowser && hasConfig) {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getDatabase(app);
} else {
    // Return a proxy/mock for SSR or missing config to prevent build crashes
    db = {
        ref: () => ({
            onValue: () => () => {},
            off: () => {},
            once: async () => ({ val: () => null }),
            set: async () => {},
            update: async () => {},
            push: () => ({ key: 'mock-key' }),
        })
    };
}

export { db };
