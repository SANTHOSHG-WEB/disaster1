"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase-client';
import { db } from '@/lib/firebase-client';
import { ref, onValue } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, BookOpen, AlertTriangle, Activity, Loader2, Download, Table as TableIcon } from 'lucide-react';
import { modules } from '@/data/modules';
 
export const dynamic = 'force-dynamic';
 
interface StudentData {
    id: string;
    name: string;
    school: string;
    progress: number;
    email: string;
    scores: Record<string, number>;
    last_active: string;
}

interface ModuleStats {
    id: string;
    title: string;
    avgScore: number;
    completions: number;
}

export default function AdminDashboard() {
    const { user, userRole, logout, isLoading: authLoading } = useAuth();
    const [stats, setStats] = useState({
        totalStudents: 0,
        activeModules: modules.length,
        emergencyAlerts: 0,
        systemStatus: 'Healthy'
    });
    const [students, setStudents] = useState<StudentData[]>([]);
    const [loading, setLoading] = useState(true);

    const modulePerformance = useMemo(() => {
        return modules.map(m => {
            const moduleScores = students
                .map(s => s.scores[m.id])
                .filter(score => score !== undefined);
            
            const completions = students.filter(s => s.scores[m.id] !== undefined).length;
            const avgScore = moduleScores.length > 0 
                ? Math.round(moduleScores.reduce((a, b) => a + b, 0) / moduleScores.length) 
                : 0;

            return {
                id: m.id,
                title: m.title,
                avgScore,
                completions
            };
        });
    }, [students]);

    const fetchAdminData = async () => {
        if (!user || userRole?.role !== 'admin') return;

        try {
            // 1. Fetch Students (Profiles)
            const { data: profiles, error: pError } = await supabase
                .from('profiles')
                .select('full_name, school_name, id, updated_at');

            // 2. Fetch Progress/Scores for all
            const { data: progress, error: prError } = await supabase
                .from('module_progress')
                .select('user_id, module_id, status, quiz_score');

            if (profiles && profiles.length > 0) {
                const studentList = profiles.map((p: any) => {
                    const userProgress = progress?.filter((pr: any) => pr.user_id === p.id) || [];
                    const completedCount = userProgress.filter((pr: any) => pr.status === 'completed').length;
                    const progressPercent = Math.round((completedCount / modules.length) * 100);
                    
                    const scores: Record<string, number> = {};
                    userProgress.forEach((pr: any) => {
                        if (pr.quiz_score !== undefined) {
                            scores[pr.module_id] = pr.quiz_score;
                        }
                    });

                    return {
                        id: p.id,
                        name: p.full_name || 'Anonymous',
                        school: p.school_name || 'Unknown',
                        progress: progressPercent,
                        email: '',
                        scores,
                        last_active: p.updated_at
                    };
                });

                setStudents(studentList);
                setStats(prev => ({
                    ...prev,
                    totalStudents: studentList.length
                }));
            } else {
                // Fallback Mock Data for demo purposes if DB is empty
                const mockStudents: StudentData[] = [
                    { id: '1', name: 'Arun Kumar', school: 'IIT Madras', progress: 85, email: 'arun@test.com', scores: { '1': 90, '2': 80 }, last_active: new Date().toISOString() },
                    { id: '2', name: 'Sanjana Rao', school: 'NIT Trichy', progress: 45, email: 'sanjana@test.com', scores: { '1': 75 }, last_active: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
                    { id: '3', name: 'Karthik S', school: 'Anna University', progress: 10, email: 'karthik@test.com', scores: {}, last_active: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() }
                ];
                setStudents(mockStudents);
                setStats(prev => ({ ...prev, totalStudents: mockStudents.length }));
            }

        } catch (err) {
            console.error("Admin fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!user || userRole?.role !== 'admin') return;

        fetchAdminData();

        // Real-time Supabase Subscriptions
        const profileChannel = supabase
            .channel('admin-profiles-changes')
            .on('postgres_changes', { event: '*', table: 'profiles', schema: 'public' }, () => fetchAdminData())
            .subscribe();

        const progressChannel = supabase
            .channel('admin-progress-changes')
            .on('postgres_changes', { event: '*', table: 'module_progress', schema: 'public' }, () => fetchAdminData())
            .subscribe();

        // Real-time Firebase Incidents
        const statusRef = ref(db, 'hardware');
        const unsubscribeFirebase = onValue(statusRef, (snapshot) => {
            const data = snapshot.val();
            if (data && data.sensors) {
                let incidentCount = 0;
                if (data.sensors.isFire) incidentCount++;
                if (data.sensors.isSmoke) incidentCount++;
                if (data.sensors.vibrationCount > 5) incidentCount++;
                
                setStats(prev => ({
                    ...prev,
                    emergencyAlerts: incidentCount,
                    systemStatus: incidentCount > 0 ? 'Critical' : 'Healthy'
                }));
            }
        });

        return () => {
            supabase.removeChannel(profileChannel);
            supabase.removeChannel(progressChannel);
            unsubscribeFirebase();
        };
    }, [user, userRole]);

    const exportToCSV = () => {
        const headers = ['Name', 'Institution', 'Last Active', 'Overall Progress (%)', ...modules.map(m => `${m.title} Score`)];
        const rows = students.map(s => [
            s.name,
            s.school,
            new Date(s.last_active).toLocaleString(),
            s.progress,
            ...modules.map(m => s.scores[m.id] ?? 'N/A')
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `student_analytics_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (authLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <div className="h-16 w-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-primary animate-pulse font-bold">Verifying Authentication...</p>
            </div>
        );
    }

    if (!user || userRole?.role !== 'admin') {
        return (
            <div className="flex items-center justify-center min-h-screen px-4">
                <Card className="glass border-destructive/20 max-w-md w-full overflow-hidden">
                    <CardHeader>
                        <CardTitle className="text-destructive">Access Denied</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-slate-300">You must be an administrator to view this page.</p>
                        <div className="flex gap-4 mt-6">
                            <Button variant="outline" onClick={() => window.location.href = '/'}>Home</Button>
                            <Button variant="destructive" onClick={() => logout()}>Logout</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen text-slate-900 selection:bg-primary/20">
            <div className="container mx-auto px-4 py-8 space-y-8 animate-fade-in max-w-7xl">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-200 pb-8 gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
                                <Activity className="h-6 w-6 text-primary" />
                            </div>
                            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Admin Command Center</h1>
                        </div>
                        <p className="text-slate-500 font-medium md:ml-12">Real-time activity and modular safety analytics</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <Button 
                            variant="outline" 
                            className="flex-1 md:flex-none glass border-slate-200 hover:bg-slate-50 text-slate-700 h-11" 
                            onClick={exportToCSV}
                        >
                            <Download className="mr-2 h-4 w-4" /> Export Data
                        </Button>
                        <Button 
                            variant="destructive" 
                            className="flex-1 md:flex-none h-11" 
                            onClick={() => logout()}
                        >
                            Sign Out
                        </Button>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatsCard title="Total Students" value={loading ? "..." : stats.totalStudents.toString()} icon={Users} color="text-blue-400" />
                    <StatsCard title="Learning Modules" value={stats.activeModules.toString()} icon={BookOpen} color="text-emerald-400" />
                    <StatsCard 
                        title="Active Incidents" 
                        value={stats.emergencyAlerts.toString()} 
                        icon={AlertTriangle} 
                        color={stats.emergencyAlerts > 0 ? "text-red-500 animate-pulse" : "text-amber-400"} 
                    />
                    <StatsCard title="System Status" value={stats.systemStatus} icon={Activity} color={stats.systemStatus === 'Healthy' ? "text-indigo-400" : "text-red-500"} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Student List */}
                    <Card className="lg:col-span-2 glass border-slate-200 shadow-xl overflow-hidden">
                        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4 px-6">
                            <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-800">
                                <Users className="h-5 w-5 text-primary" /> Student Roster
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {loading ? (
                                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-left border-b border-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest bg-slate-50/30">
                                                <th className="py-5 px-6">Student</th>
                                                <th className="py-5 px-6 hidden sm:table-cell">Institution</th>
                                                <th className="py-5 px-6 hidden md:table-cell">Last Active</th>
                                                <th className="py-5 px-6 text-right">Progress</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm divide-y divide-slate-100">
                                            {students.length > 0 ? students.map((student, i) => (
                                                <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="py-4 px-6">
                                                        <div className="font-bold text-slate-800">{student.name}</div>
                                                        <div className="text-[10px] text-slate-400 sm:hidden">{student.school}</div>
                                                    </td>
                                                    <td className="py-4 px-6 text-slate-500 hidden sm:table-cell">{student.school}</td>
                                                    <td className="py-4 px-6 text-xs text-slate-400 hidden md:table-cell">
                                                        {new Date(student.last_active).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-3 justify-end">
                                                            <span className="text-xs font-black tabular-nums text-slate-700">{student.progress}%</span>
                                                            <div className="h-1.5 w-16 sm:w-20 bg-slate-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full transition-all duration-1000 ${student.progress > 70 ? 'bg-success' : student.progress > 30 ? 'bg-primary' : 'bg-red-400'}`}
                                                                    style={{ width: `${student.progress}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr><td colSpan={3} className="py-10 text-center text-slate-500">No student deployment data detected.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick Tools */}
                    <div className="space-y-6">
                        <Card className="glass border-slate-200 shadow-lg">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-xl font-bold text-slate-800">Command Center Tools</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button className="w-full justify-start glass border-slate-100 hover:bg-slate-50 text-slate-600 h-12" variant="outline">
                                    <AlertTriangle className="mr-3 h-4 w-4 text-amber-500" /> Dispatch Safety Alert
                                </Button>
                                <Button className="w-full justify-start glass border-slate-100 hover:bg-slate-50 text-slate-600 h-12" variant="outline">
                                    <BookOpen className="mr-3 h-4 w-4 text-primary" /> Syllabus Updates
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="glass border-primary/10 shadow-lg px-6 py-8">
                            <h4 className="font-bold text-primary flex items-center gap-2 mb-4 uppercase text-[10px] tracking-widest">
                                <Activity className="h-4 w-4" /> System Telemetry
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Supabase Node:</span>
                                    <span className="font-black text-success">ONLINE</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Firebase Edge:</span>
                                    <span className="font-black text-success">CONNECTED</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Base Latency:</span>
                                    <span className="font-black text-slate-700"> 42ms</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Module Performance Section */}
                <div className="space-y-6">
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-lg">
                            <TableIcon className="h-5 w-5 text-primary" />
                        </div>
                        Curriculum Performance Matrix
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-slate-800">
                        {modulePerformance.map((item) => (
                            <Card key={item.id} className="glass border-slate-200 hover:border-primary/30 transition-all group overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary/20 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <CardContent className="p-5">
                                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1 truncate">
                                        Module {item.id}
                                    </p>
                                    <h4 className="font-bold text-slate-200 line-clamp-1 mb-4 text-sm group-hover:text-emerald-400 transition-colors">
                                        {item.title}
                                    </h4>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Avg. Quiz Score</p>
                                            <div className="text-2xl font-black text-primary">
                                                {item.avgScore}<span className="text-xs text-slate-400">%</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Completions</p>
                                            <div className="text-lg font-black text-slate-700">{item.completions}</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

const StatsCard = ({ title, value, icon: Icon, color }: any) => (
    <Card className="glass border-slate-200 shadow-xl group hover:border-primary/20 transition-all overflow-hidden relative border-none">
        <div className={`absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity ${color}`}>
            <Icon size={80} />
        </div>
        <CardContent className="p-6 flex items-center justify-between relative z-10">
            <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{title}</p>
                <h3 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">{value}</h3>
            </div>
            <div className={`p-3 rounded-xl bg-slate-50 border border-slate-100 group-hover:scale-110 transition-transform ${color}`}>
                <Icon size={24} />
            </div>
        </CardContent>
    </Card>
);
