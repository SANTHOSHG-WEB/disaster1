import { 
    initializeApp, 
    getApps, 
    getApp 
} from "firebase/app";
import { 
    getDatabase, 
    ref as firebaseRef, 
    onValue as firebaseOnValue, 
    set as firebaseSet 
} from "firebase/database";

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
const hasConfig = !!firebaseConfig.projectId && !!firebaseConfig.databaseURL;

let database: any = null;

if (isBrowser && hasConfig) {
    try {
        const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        database = getDatabase(app);
    } catch (e) {
        console.error("Firebase Initialization Error:", e);
    }
}

// Wrapper for ref
export const ref = (db: any, path: string) => {
    if (db && hasConfig) return firebaseRef(db, path);
    return { _isMock: true, path };
};

// Wrapper for onValue
export const onValue = (ref: any, callback: (snapshot: any) => void) => {
    if (ref && !ref._isMock) return firebaseOnValue(ref, callback);
    
    // Mock snapshot
    callback({
        val: () => null,
        exists: () => false
    });
    return () => {}; // No-op unsubscribe
};

// Wrapper for set (if used)
export const set = (ref: any, value: any) => {
    if (ref && !ref._isMock) return firebaseSet(ref, value);
    console.warn("Firebase: Skipping 'set' operation in Mock Mode (Missing Config)");
    return Promise.resolve();
};

export { database as db };
