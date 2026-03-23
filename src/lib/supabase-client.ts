import { createBrowserClient } from '@supabase/ssr'

const isBrowser = typeof window !== 'undefined'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

console.log("Initializing Supabase Client", { url: url ? "Present" : "Missing", key: anonKey ? "Present" : "Missing" });

const isMockMode = !url || url.includes('your-project') || url === '';

// If in mock mode, we export a stubbed version of the Supabase client
// to prevent "Failed to fetch" errors and allow offline testing.
export const supabase = isBrowser
    ? (isMockMode
        ? ({
            auth: {
                getSession: async () => ({ data: { session: null }, error: null }),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
                signInWithPassword: async () => ({ data: { user: null }, error: new Error('Mock mode login handled by hook') }),
                signOut: async () => ({ error: null }),
                getUser: async () => ({ data: { user: null }, error: null }),
            },
            from: () => ({
                select: () => ({
                    eq: () => ({
                        single: async () => ({ data: null, error: null }),
                    }),
                }),
                update: () => ({
                    eq: async () => ({ error: null }),
                }),
            }),
            channel: () => ({
                on: () => ({
                    subscribe: () => ({ })
                })
            }),
            removeChannel: () => { }
        } as any)
        : createBrowserClient(url, anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }))
    : null as any
