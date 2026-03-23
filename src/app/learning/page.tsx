"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useProgress } from '@/hooks/useProgress';
import { modules } from '@/data/modules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Lock, CheckCircle, Play, Star, BookOpen, Clock, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AIAdvisor from '@/components/features/AIAdvisor';

export default function Learning() {
    const router = useRouter();
    const { user, profile } = useAuth();
    const { progress, canAccessModule, getModuleProgress, isLoaded } = useProgress();
    const { t } = useTranslation();

    if (!isLoaded && user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-muted-foreground animate-pulse">Syncing your progress...</p>
            </div>
        );
    }

    const handleModuleClick = (moduleId: string) => {
        if (canAccessModule(moduleId)) {
            router.push(`/learning/${moduleId}`);
        }
    };

    const completedCount = Object.values(progress.modules).filter(m => m.completedAt).length;
    const progressPercentage = (completedCount / modules.length) * 100;

    return (
        <div className="container mx-auto max-w-6xl px-4 py-8">
            {user && (
                <div className="mb-8 text-center bg-glass/30 p-4 rounded-2xl border border-glass-border">
                    <p className="text-lg text-glass-foreground">
                        Welcome back, <span className="font-bold">
                            {profile?.full_name || user.user_metadata?.full_name || user.email}
                        </span>
                    </p>
                </div>
            )}

            {user && (
                <AIAdvisor modules={modules} progress={progress} />
            )}

            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-glass-foreground mb-4">Learning Path</h1>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                    Master 10 essential modules to become disaster-ready. Each includes a video, game, and quiz.
                </p>
            </div>

            {user && (
                <Card className="glass border-glass-border max-w-2xl mx-auto mb-12">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2">
                            <BookOpen className="h-6 w-6 text-primary" />
                            Your Progress
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Course Completion</span>
                                <span className="font-bold">{completedCount} / {modules.length}</span>
                            </div>
                            <Progress value={progressPercentage} className="h-3 bg-glass/50" />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-3 neumorphic rounded-xl">
                                <div className="text-2xl font-bold text-primary">{progress.points}</div>
                                <div className="text-xs text-muted-foreground">Points</div>
                            </div>
                            <div className="text-center p-3 neumorphic rounded-xl">
                                <div className="text-2xl font-bold text-accent">{progress.badges.length}</div>
                                <div className="text-xs text-muted-foreground">Badges</div>
                            </div>
                            <Link href="/certificate" className="block">
                                <div className="text-center p-3 neumorphic rounded-xl hover:scale-105 transition-transform cursor-pointer border-2 border-transparent hover:border-primary/20">
                                    <div className="text-2xl font-bold text-success">{progress.certificateEarned ? '1' : '0'}</div>
                                    <div className="text-xs text-muted-foreground">Certificate</div>
                                </div>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {modules.map((module) => {
                    const modProgress = getModuleProgress(module.id);
                    const isAccessible = canAccessModule(module.id);
                    const isCompleted = !!modProgress?.completedAt;

                    return (
                        <Card
                            key={module.id}
                            onClick={() => handleModuleClick(module.id)}
                            className={`glass border-glass-border transition-all cursor-pointer ${isAccessible ? 'glass-hover hover:scale-[1.02]' : 'opacity-60 grayscale cursor-not-allowed'
                                }`}
                        >
                            <CardHeader>
                                <div className="flex justify-between items-start mb-2">
                                    <Badge variant="outline" className="glass">Module {module.id}</Badge>
                                    {isCompleted ? (
                                        <CheckCircle className="h-5 w-5 text-success" />
                                    ) : !isAccessible ? (
                                        <Lock className="h-5 w-5 text-muted-foreground" />
                                    ) : null}
                                </div>
                                <CardTitle className="text-xl">{module.title}</CardTitle>
                                <CardDescription className="line-clamp-2">{module.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> {module.duration}</div>
                                    <div className="flex items-center gap-1"><Video className="h-3 w-3" /> Video + Quiz</div>
                                    {isCompleted && modProgress?.score !== undefined && (
                                        <div className="flex items-center gap-1 text-emerald-400 font-bold ml-auto">
                                            <Star className="h-3 w-3 fill-emerald-400" /> Score: {modProgress.score}%
                                        </div>
                                    )}
                                </div>

                                {isAccessible && (
                                    <div className="flex gap-1 h-1.5">
                                        <div className={`flex-1 rounded-full ${modProgress?.videoWatched ? 'bg-primary' : 'bg-muted'}`} />
                                        <div className={`flex-1 rounded-full ${modProgress?.gameCompleted ? 'bg-accent' : 'bg-muted'}`} />
                                        <div className={`flex-1 rounded-full ${modProgress?.quizCompleted ? 'bg-success' : 'bg-muted'}`} />
                                    </div>
                                )}

                                <Button
                                    disabled={!isAccessible}
                                    variant={isCompleted ? "secondary" : "default"}
                                    className="w-full"
                                >
                                    {isCompleted ? "Review Module" : isAccessible ? "Start Learning" : "Locked"}
                                    {!isCompleted && isAccessible && <Play className="ml-2 h-4 w-4" />}
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
