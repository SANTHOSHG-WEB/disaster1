"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-client';
import { User, Session } from '@supabase/supabase-js';

interface UserProfile {
    id: string;
    user_id: string;
    full_name: string;
    age?: number;
    birthday?: string;
    school_name?: string;
    class_name?: string;
    created_at: string;
    updated_at: string;
}

interface UserRole {
    role: 'admin' | 'moderator' | 'student';
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;
    userRole: UserRole | null;
    login: (email: string, password: string) => Promise<{ error?: string }>;
    loginWithGoogle: () => Promise<{ error?: string }>;
    signup: (email: string, password: string, profileData: {
        full_name: string;
        age?: number;
        birthday?: string;
        school_name?: string;
        class_name?: string;
        college_name?: string;
        role?: string;
    }) => Promise<{ error?: string }>;
    logout: () => Promise<void>;
    updateProfile: (data: Partial<UserProfile>) => Promise<{ error?: string }>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const initAuth = async () => {
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const isMockMode = !url || url.includes('your-project') || url === '';

            console.log("Auth Initializing...", { isMockMode, url });

            if (isMockMode) {
                const storedSession = localStorage.getItem('dme_mock_session');
                if (storedSession && mounted) {
                    try {
                        const { user, session, profile, role } = JSON.parse(storedSession);
                        setUser(user);
                        setSession(session);
                        setProfile(profile);
                        setUserRole(role);
                    } catch (e) {
                        console.error("Failed to restore mock session", e);
                    }
                }
                setIsLoading(false);
                return () => { }; // return empty cleanup for mock mode
            }

            try {
                // 1. Get initial session
                const { data: { session: initialSession } } = await supabase.auth.getSession();

                if (mounted) {
                    setSession(initialSession);
                    setUser(initialSession?.user ?? null);

                    if (initialSession?.user) {
                        await Promise.all([
                            fetchUserProfile(initialSession.user.id),
                            fetchUserRole(initialSession.user.id, initialSession.user.email)
                        ]);
                    }
                }
            } catch (error) {
                console.error("Error during initial session fetch", error);
            } finally {
                if (mounted) setIsLoading(false);
            }

            // 2. Setup listener for future changes
            const { data: { subscription } } = supabase.auth.onAuthStateChange(
                async (event: string, session: any) => {
                    console.log("Auth Event:", event, session?.user?.email);

                    if (!mounted) return;

                    // Skip the INITIAL_SESSION event if we already handled getSession reliably
                    // Actually, onAuthStateChange is better for handling the 'SIGNED_IN' event after OAuth
                    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                        setSession(session);
                        setUser(session?.user ?? null);
                        if (session?.user) {
                            await Promise.all([
                                fetchUserProfile(session.user.id),
                                fetchUserRole(session.user.id, session.user.email),
                                updateProfileActivity(session.user.id)
                            ]);
                        }
                    } else if (event === 'SIGNED_OUT') {
                        setSession(null);
                        setUser(null);
                        setProfile(null);
                        setUserRole(null);
                    }
                }
            );

            return () => {
                subscription.unsubscribe();
            };
        };

        const cleanupPromise = initAuth();

        return () => {
            mounted = false;
            // Unsubscribe is handled inside internal cleanup if we keep the subscription ref
        };
    }, []);

    const fetchUserProfile = async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (data && !error) {
            setProfile(data);
        }
    };

    const fetchUserRole = async (userId: string, userEmail?: string) => {
        const { data, error } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .single();

        if (data && !error) {
            setUserRole({ role: data.role as 'admin' | 'moderator' | 'student' });
        } else {
            // Fallback for system administrator email if role is missing in DB
            if (userEmail === 'admin@dme.com') {
                setUserRole({ role: 'admin' });
            } else {
                setUserRole({ role: 'student' });
            }
        }
    };

    const updateProfileActivity = async (userId: string) => {
        const isMockMode = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('your-project');
        if (isMockMode) return;
        
        await supabase
            .from('profiles')
            .update({ updated_at: new Date().toISOString() })
            .eq('user_id', userId);
    };

    const login = async (email: string, password: string) => {
        setIsLoading(true);
        try {
            // Aggressive Rescue Mode: Trigger mock if email is @test.com OR url is placeholder
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const isMockEmail = email.toLowerCase().endsWith('@test.com');
            const isMockUrl = !url || url.includes('your-project') || url === '';
            const isMockMode = isMockEmail || isMockUrl;

            console.log("Login Mode Check", { isMockMode, isMockEmail, isMockUrl });

            if (isMockMode) {
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 500));

                // Create mock session
                // Use deterministic ID based on email to persist mock progress across logins
                const mockUserId = `mock-user-${btoa(email).replace(/=/g, '').substring(0, 12)}`;

                const mockUser: User = {
                    id: mockUserId,
                    email: email,
                    app_metadata: {},
                    user_metadata: {},
                    aud: 'authenticated',
                    created_at: new Date().toISOString()
                };

                const mockSession: Session = {
                    access_token: 'mock-token',
                    refresh_token: 'mock-refresh',
                    expires_in: 3600,
                    token_type: 'bearer',
                    user: mockUser
                };

                const mockProfile: UserProfile = {
                    id: 'mock-profile-id',
                    user_id: mockUser.id,
                    full_name: 'Test Student',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    school_name: 'Demo School',
                    class_name: '10th Grade'
                };

                setSession(mockSession);
                setUser(mockUser);
                setProfile(mockProfile);

                const role = email.toLowerCase().startsWith('admin') ? 'admin' : 'student';
                setUserRole({ role: role as 'admin' | 'student' });

                localStorage.setItem('dme_mock_session', JSON.stringify({
                    user: mockUser,
                    session: mockSession,
                    profile: mockProfile,
                    role: { role }
                }));

                return {};
            }

            const { data: { user: signedInUser }, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                return { error: error.message };
            }

            if (signedInUser) {
                // Fetch and update state BEFORE returning, so the next page has the data
                await Promise.all([
                    fetchUserProfile(signedInUser.id),
                    fetchUserRole(signedInUser.id, signedInUser.email),
                    updateProfileActivity(signedInUser.id)
                ]);
            }

            return {};
        } catch (error) {
            return { error: 'Login failed' };
        } finally {
            setIsLoading(false);
        }
    };

    const loginWithGoogle = async () => {
        return { error: 'Google auth disabled' };
    };

    const signup = async (email: string, password: string, profileData: any) => {
        setIsLoading(true);
        console.log("Signup Request", { email, profileData });
        try {
            // Aggressive Rescue Mode
            const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const isMockEmail = email.toLowerCase().endsWith('@test.com');
            const isMockUrl = !url || url.includes('your-project') || url === '';
            const isMockMode = isMockEmail || isMockUrl;

            console.log("Signup Mode check", { isMockMode, isMockEmail, isMockUrl });

            if (isMockMode) {
                // Simulate network delay
                await new Promise(resolve => setTimeout(resolve, 800));

                // Create mock session & profile
                // Use deterministic ID even for signup to match login logic
                const mockUserId = `mock-user-${btoa(email).replace(/=/g, '').substring(0, 12)}`;

                const mockUser: User = {
                    id: mockUserId,
                    email: email,
                    app_metadata: {},
                    user_metadata: {},
                    aud: 'authenticated',
                    created_at: new Date().toISOString()
                };

                const mockSession: Session = {
                    access_token: 'mock-token',
                    refresh_token: 'mock-refresh',
                    expires_in: 3600,
                    token_type: 'bearer',
                    user: mockUser
                };

                const mockProfile: UserProfile = {
                    ...profileData,
                    id: 'mock-profile-id',
                    user_id: mockUser.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };

                setSession(mockSession);
                setUser(mockUser);
                setProfile(mockProfile);

                const role = email.toLowerCase().startsWith('admin') ? 'admin' : 'student';
                setUserRole({ role: role as 'admin' | 'student' });

                localStorage.setItem('dme_mock_session', JSON.stringify({
                    user: mockUser,
                    session: mockSession,
                    profile: mockProfile,
                    role: { role }
                }));

                return {};
            }

            const { data: { user: signedUpUser }, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: profileData
                }
            });

            if (error) {
                return { error: error.message };
            }

            if (signedUpUser) {
                // Ensure profile/role are fetched (or created via trigger) before moving on
                await Promise.all([
                    fetchUserProfile(signedUpUser.id),
                    fetchUserRole(signedUpUser.id, signedUpUser.email),
                    updateProfileActivity(signedUpUser.id)
                ]);
            }

            return {};
        } catch (error) {
            return { error: 'Signup failed' };
        } finally {
            setIsLoading(false);
        }
    };

    const updateProfile = async (data: Partial<UserProfile>) => {
        if (!user) return { error: 'Not authenticated' };

        try {
            const { error } = await supabase
                .from('profiles')
                .update(data)
                .eq('user_id', user.id);

            if (error) return { error: error.message };

            await fetchUserProfile(user.id);
            return {};
        } catch (error) {
            return { error: 'Update failed' };
        }
    };

    const logout = async () => {
        const isMockMode = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('your-project');
        if (isMockMode) {
            localStorage.removeItem('dme_mock_session');
            setUser(null);
            setSession(null);
            setProfile(null);
            setUserRole(null);
            return;
        }
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{
            user,
            session,
            profile,
            userRole,
            login,
            loginWithGoogle,
            signup,
            logout,
            updateProfile,
            isLoading
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
