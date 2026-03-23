"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase-client';

interface ModuleProgress {
    moduleId: string;
    videoWatched: boolean;
    gameCompleted: boolean;
    quizCompleted: boolean;
    score: number;
    completedAt?: string;
}

interface UserProgress {
    modules: Record<string, ModuleProgress>;
    points: number;
    badges: string[];
    certificateEarned: boolean;
}

interface ProgressContextType {
    progress: UserProgress;
    updateModuleProgress: (moduleId: string, updates: Partial<ModuleProgress>) => void;
    getModuleProgress: (moduleId: string) => ModuleProgress | null;
    canAccessModule: (moduleId: string) => boolean;
    isLoaded: boolean;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
    forceRefresh: () => Promise<void>;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const ProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [progress, setProgress] = useState<UserProgress>({
        modules: {},
        points: 0,
        badges: [],
        certificateEarned: false
    });
    const [isLoaded, setIsLoaded] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

    // 0. Clean start on user change (Important for cross-device & logout/login)
    useEffect(() => {
        if (user?.id) {
            console.log("Progress Sync: New user detected, resetting local state for loading.");
            setIsLoaded(false);
            setProgress({
                modules: {},
                points: 0,
                badges: [],
                certificateEarned: false
            });
        }
    }, [user?.id]);

    // DB Sync & Reconciliation
    useEffect(() => {
        const reconcileProgress = async () => {
            // 1. Load what we have in LocalStorage as a baseline
            let currentLocal: UserProgress = { modules: {}, points: 0, badges: [], certificateEarned: false };
            if (user?.id) {
                const savedProgress = localStorage.getItem(`dme_progress_${user.id}`);
                if (savedProgress) {
                    try {
                        currentLocal = JSON.parse(savedProgress);
                        console.log("Progress Sync: Baseline loaded from LocalStorage.");
                    } catch (e) {
                        console.error("Progress Sync: Failed to parse LocalStorage baseline", e);
                    }
                }
            }

            const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const isMockMode = !url || url.includes('your-project') || url === '';

            if (isMockMode) {
                console.log("Progress Sync: Mock mode detected, skipping API reconciliation.");
                setProgress(currentLocal);
                setIsLoaded(true);
                return;
            }

            try {
                // 2. Fetch from DB
                const response = await fetch('/api/progress');
                if (!response.ok) {
                    throw new Error(`API Fetch failed: ${response.statusText}`);
                }
                const dbData = await response.json();
                console.log("Progress Sync: DB data received:", dbData);

                // 3. Merge Logic (Reconciliation)
                const mergedModules = { ...currentLocal.modules };
                let localHasUnsyncedData = false;

                if (dbData && dbData.length > 0) {
                    dbData.forEach((row: any) => {
                        const dbMod: ModuleProgress = {
                            moduleId: row.module_id,
                            videoWatched: row.video_watched || false,
                            gameCompleted: row.game_completed || false,
                            quizCompleted: row.quiz_completed || false,
                            score: row.quiz_score || 0,
                            completedAt: (row.quiz_completed && row.video_watched && row.game_completed) ? row.updated_at : undefined
                        };

                        const localMod = mergedModules[row.module_id];

                        // Merge: DB wins on completion OR if local is behind
                        if (!localMod || dbMod.completedAt || dbMod.score > localMod.score) {
                            mergedModules[row.module_id] = dbMod;
                        } else if (localMod.completedAt && !dbMod.completedAt) {
                            // Local has more progress! Flag for Sync-Up
                            localHasUnsyncedData = true;
                        }
                    });
                } else if (Object.keys(mergedModules).length > 0) {
                    // DB is empty but local has data -> Flag for Sync-Up
                    console.log("Progress Sync: DB is empty, local data detected. Will sync up.");
                    localHasUnsyncedData = true;
                }

                // 4. Update state with merged data
                const finalProgress = recalculateStats(mergedModules);
                setProgress(finalProgress);

                // 5. Sync-Up Side Effect: Push local-only progress to DB
                if (localHasUnsyncedData) {
                    console.log("Progress Sync: Triggering sync-up for local-only data...");
                    Object.values(mergedModules).forEach(mod => {
                        // Only sync modules that have at least some progress
                        if (mod.videoWatched || mod.gameCompleted || mod.quizCompleted) {
                            syncToDb(mod);
                        }
                    });
                }

                console.log("Progress Sync: Reconciliation complete.");
                setSyncStatus('synced');
            } catch (error) {
                console.error("Progress Sync: Error during reconciliation:", error);
                setSyncStatus('error');
                // On failure, we at least have LocalStorage (from step 1)
                setProgress(currentLocal);
            } finally {
                setIsLoaded(true);
            }
        };

        reconcileProgress();
    }, [user?.id]);

    const forceRefresh = async () => {
        setIsLoaded(false);
        setSyncStatus('syncing');

        if (!user?.id) {
            setIsLoaded(true);
            setSyncStatus('idle');
            return;
        }

        try {
            const response = await fetch('/api/progress');
            if (!response.ok) throw new Error("Fetch failed");
            const dbData = await response.json();

            const mergedModules = { ...progress.modules };
            if (dbData && dbData.length > 0) {
                dbData.forEach((row: any) => {
                    const dbMod: ModuleProgress = {
                        moduleId: row.module_id,
                        videoWatched: row.video_watched || false,
                        gameCompleted: row.game_completed || false,
                        quizCompleted: row.quiz_completed || false,
                        score: row.quiz_score || 0,
                    };
                    mergedModules[row.module_id] = dbMod;
                });
            }

            const finalProgress = recalculateStats(mergedModules);
            setProgress(finalProgress);
            setSyncStatus('synced');
            console.log("Progress Sync: Force refresh complete.");
        } catch (error) {
            console.error("Progress Sync: Force refresh failed", error);
            setSyncStatus('error');
        } finally {
            setIsLoaded(true);
        }
    };

    const recalculateStats = (modules: Record<string, ModuleProgress>): UserProgress => {
        let totalPoints = 0;
        let completedModules = 0;
        const earnedBadges: string[] = [];

        Object.values(modules).forEach(m => {
            const isDone = m.quizCompleted && m.videoWatched && m.gameCompleted;
            if (isDone) {
                completedModules++;
                totalPoints += 100 + m.score;
                earnedBadges.push(`badge-module-${m.moduleId}`);
            }
        });

        if (completedModules >= 10) {
            earnedBadges.push('badge-master-disaster-manager');
        }

        return {
            modules,
            points: totalPoints,
            badges: earnedBadges,
            certificateEarned: completedModules >= 10,
        };
    };

    const syncToDb = async (module: ModuleProgress) => {
        try {
            await fetch('/api/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    moduleId: module.moduleId,
                    videoWatched: module.videoWatched,
                    gameCompleted: module.gameCompleted,
                    quizCompleted: module.quizCompleted,
                    score: module.score,
                    status: (module.quizCompleted && module.videoWatched && module.gameCompleted) ? 'completed' : 'in-progress',
                }),
            });
        } catch (e) {
            console.error("Progress Sync: Sync-up failed for module", module.moduleId, e);
        }
    };

    // 3. Save to LocalStorage ONLY after initial load is complete
    useEffect(() => {
        if (user && isLoaded) {
            console.log("Progress Sync: Saving to LocalStorage...");
            localStorage.setItem(`dme_progress_${user.id}`, JSON.stringify(progress));
        }
    }, [progress, user, isLoaded]);

    const updateModuleProgress = (moduleId: string, updates: Partial<ModuleProgress>) => {
        // internal check for mock mode
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const isMockMode = url?.includes('your-project');

        setProgress(prev => {
            const moduleProgress = prev.modules[moduleId] || {
                moduleId,
                videoWatched: false,
                gameCompleted: false,
                quizCompleted: false,
                score: 0
            };

            const updatedModule = { ...moduleProgress, ...updates };

            const isDone = updatedModule.videoWatched &&
                updatedModule.gameCompleted &&
                updatedModule.quizCompleted;

            if (isDone && !moduleProgress.completedAt) {
                updatedModule.completedAt = new Date().toISOString();
            }

            // Create new modules object
            const newModules = {
                ...prev.modules,
                [moduleId]: updatedModule
            };

            // Recalculate derived state
            let totalPoints = 0;
            let completedModules = 0;
            const earnedBadges: string[] = [];

            Object.values(newModules).forEach(m => {
                if (m.quizCompleted) {
                    completedModules++;
                    totalPoints += 100 + m.score;
                    earnedBadges.push(`badge-module-${m.moduleId}`);
                }
            });

            if (completedModules >= 10) {
                earnedBadges.push('badge-master-disaster-manager');
            }

            // Async DB Sync (performed as a side effect outside of functional update)
            setTimeout(async () => {
                const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
                const isMockMode = !url || url.includes('your-project') || url === '';
                
                const canSave = user?.id && isLoaded && !isMockMode;
                if (canSave) {
                    setSyncStatus('syncing');
                    console.log("Progress Sync: Saving to API...", { moduleId, updates });
                    try {
                        const response = await fetch('/api/progress', {
                            // ... (wait I need to provide more lines to match exactly)
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                moduleId,
                                videoWatched: updatedModule.videoWatched,
                                gameCompleted: updatedModule.gameCompleted,
                                quizCompleted: updatedModule.quizCompleted,
                                score: updatedModule.score,
                                status: isDone ? 'completed' : 'in-progress',
                            }),
                        });

                        if (!response.ok) {
                            throw new Error(`Failed to save progress: ${response.statusText}`);
                        }

                        const result = await response.json();
                        console.log("Progress Sync: Successfully saved to API:", result);
                        setSyncStatus('synced');
                    } catch (error) {
                        console.error("Progress Sync: Error saving through API:", error);
                        setSyncStatus('error');
                    }
                } else {
                    console.log("Progress Sync: Save skipped", { hasUser: !!user, isLoaded });
                }
            }, 0);

            return {
                ...prev,
                modules: newModules,
                points: totalPoints,
                badges: earnedBadges,
                certificateEarned: completedModules >= 10,
            };
        });
    };

    const getModuleProgress = (moduleId: string) => progress.modules[moduleId] || null;

    const canAccessModule = (moduleId: string) => {
        if (moduleId === '1') return true;

        // Debug hack for testing (optional): allow access if prev module ID is lower
        // But logic: need prev ID completed
        const prevId = (parseInt(moduleId) - 1).toString();
        const prevProgress = getModuleProgress(prevId);

        return !!prevProgress?.completedAt;
    };

    return (
        <ProgressContext.Provider value={{
            progress,
            updateModuleProgress,
            getModuleProgress,
            canAccessModule,
            isLoaded,
            syncStatus,
            forceRefresh
        }}>
            {children}
        </ProgressContext.Provider>
    );
};

export const useProgressContext = () => {
    const context = useContext(ProgressContext);
    if (context === undefined) {
        throw new Error('useProgressContext must be used within a ProgressProvider');
    }
    return context;
};
