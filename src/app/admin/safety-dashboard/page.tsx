"use client";

import React, { useState, useEffect } from 'react';
 
export const dynamic = 'force-dynamic';
 
import { db } from '@/lib/firebase-client';
import { ref, onValue, set } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
    Zap,
    Droplets,
    Flame,
    Wind,
    CloudRain,
    Activity,
    Eye,
    Power,
    Bell,
    Settings,
    AlertTriangle,
    Waves
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// Define the shape of our hardware data
interface HardwareStatus {
    relays: {
        relay1: boolean;
        relay2: boolean;
        relay3: boolean;
        relay4: boolean;
    };
    sensors: {
        temperature: number;
        humidity: number;
        waterLevel: number;
        isRaining: boolean;
        isMotion: boolean;
        isSmoke: boolean;
        isFire: boolean;
        vibrationCount: number;
    };
    modes: {
        motorAuto: boolean;
    };
}

const INITIAL_STATUS: HardwareStatus = {
    relays: { relay1: false, relay2: false, relay3: false, relay4: false },
    sensors: {
        temperature: 0,
        humidity: 0,
        waterLevel: 0,
        isRaining: false,
        isMotion: false,
        isSmoke: false,
        isFire: false,
        vibrationCount: 0
    },
    modes: { motorAuto: true }
};

export default function SafetyDashboard() {
    const [status, setStatus] = useState<HardwareStatus>(INITIAL_STATUS);
    const [loading, setLoading] = useState(true);
    const [isDemoMode, setIsDemoMode] = useState(false);

    useEffect(() => {
        if (isDemoMode) {
            setLoading(false);
            const interval = setInterval(() => {
                setStatus(prev => ({
                    ...prev,
                    sensors: {
                        ...prev.sensors,
                        temperature: Math.floor(20 + Math.random() * 10),
                        humidity: Math.floor(40 + Math.random() * 30),
                        waterLevel: (prev.sensors.waterLevel + 1) % 100,
                        vibrationCount: Math.random() > 0.8 ? Math.floor(Math.random() * 10) : prev.sensors.vibrationCount
                    }
                }));
            }, 2000);
            return () => clearInterval(interval);
        }

        const statusRef = ref(db, 'hardware');
        const unsubscribe = onValue(statusRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setStatus(data);

                // Critical Alerts
                if (data.sensors.isFire) toast.error("FIRE DETECTED! All systems shutdown.", { duration: 10000 });
                if (data.sensors.isSmoke) toast.warning("SMOKE DETECTED! Fan activated.", { duration: 5000 });
                if (data.sensors.vibrationCount > 5) toast.error("EXCESSIVE VIBRATION! Potential Earthquake Alert.", { duration: 10000 });
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isDemoMode]);

    const toggleRelay = (relayKey: string, currentValue: boolean) => {
        if (isDemoMode) {
            setStatus(prev => ({
                ...prev,
                relays: { ...prev.relays, [relayKey]: !currentValue }
            }));
            return;
        }
        set(ref(db, `hardware/relays/${relayKey}`), !currentValue);
    };

    const toggleAutoMode = (modeKey: string, currentValue: boolean) => {
        if (isDemoMode) {
            setStatus(prev => ({
                ...prev,
                modes: { ...prev.modes, [modeKey]: !currentValue }
            }));
            return;
        }
        set(ref(db, `hardware/modes/${modeKey}`), !currentValue);
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-4"
                >
                    <Activity className="h-10 w-10 text-primary animate-pulse" />
                    <p className="text-slate-400 font-medium">Syncing Campus Safety Data...</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 p-6 md:p-10 font-sans">
            <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <motion.h1
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500"
                    >
                        Sentinel Campus Safety
                    </motion.h1>
                    <p className="text-slate-400 mt-1">Real-time hardware integration & emergency monitoring.</p>
                </div>
                <div className="flex items-center gap-4">
                    <Button
                        variant={isDemoMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIsDemoMode(!isDemoMode)}
                        className={isDemoMode ? "bg-blue-600 hover:bg-blue-700" : "border-slate-800"}
                    >
                        {isDemoMode ? "Demo Mode: ON" : "Real-time: OFF"}
                    </Button>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={status.sensors.isFire ? "fire" : "safe"}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                        >
                            <Badge
                                variant={status.sensors.isFire ? "destructive" : "outline"}
                                className={`px-4 py-1.5 rounded-full text-sm font-bold border-2 ${status.sensors.isFire ? 'animate-bounce shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'border-slate-800'}`}
                            >
                                {status.sensors.isFire ? "CRITICAL: FIRE DETECTED" : "SYSTEM STABLE"}
                            </Badge>
                        </motion.div>
                    </AnimatePresence>
                    <Button variant="outline" size="icon" className="rounded-full border-slate-800 bg-slate-900/50 hover:bg-slate-800">
                        <Settings className="h-4 w-4" />
                    </Button>
                </div>
            </header>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-12 auto-rows-max">

                {/* Environment - 4 columns */}
                <Card className="lg:col-span-4 bg-slate-900/40 border-slate-800/60 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Activity className="h-5 w-5 text-blue-400" />
                            Environment Metrics
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/40">
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Temperature</p>
                                <div className="flex items-baseline gap-1 mt-1">
                                    <span className="text-3xl font-black">{status.sensors.temperature}</span>
                                    <span className="text-slate-400">°C</span>
                                </div>
                            </div>
                            <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800/40">
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Humidity</p>
                                <div className="flex items-baseline gap-1 mt-1">
                                    <span className="text-3xl font-black">{status.sensors.humidity}</span>
                                    <span className="text-slate-400">%</span>
                                </div>
                            </div>
                        </div>

                        <motion.div
                            animate={{ backgroundColor: status.sensors.isRaining ? 'rgba(59, 130, 246, 0.1)' : 'rgba(15, 23, 42, 0.4)' }}
                            className="flex items-center justify-between p-4 rounded-2xl border border-slate-800/40"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${status.sensors.isRaining ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                                    <CloudRain className={`h-6 w-6 ${status.sensors.isRaining ? 'animate-bounce' : ''}`} />
                                </div>
                                <div>
                                    <p className="text-sm font-bold">{status.sensors.isRaining ? "Rain Detected" : "Clear Skies"}</p>
                                    <p className="text-xs text-slate-500">{status.sensors.isRaining ? "Automatic rain protocols active" : "Normal conditions"}</p>
                                </div>
                            </div>
                        </motion.div>
                    </CardContent>
                </Card>

                {/* Water Control - 4 columns */}
                <Card className="lg:col-span-4 bg-slate-900/40 border-slate-800/60 backdrop-blur-xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4">
                        <Waves className="h-20 w-20 text-blue-500/5 rotate-12" />
                    </div>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Droplets className="h-5 w-5 text-blue-500" />
                            Smart Water Motor
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-10">
                        <div className="space-y-3">
                            <div className="flex justify-between items-end">
                                <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Storage Tank Level</span>
                                <span className="text-2xl font-black text-blue-400">{status.sensors.waterLevel}%</span>
                            </div>
                            <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${status.sensors.waterLevel}%` }}
                                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-600 font-bold uppercase">
                                <span>0% Empty</span>
                                <span>Refill Checkpoint (20%)</span>
                                <span>90% Max</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-blue-500/5 rounded-2xl border border-blue-500/20">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${status.modes.motorAuto ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                                    <Power className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold">Auto-Mode</p>
                                    <p className="text-xs text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px]">
                                        {status.modes.motorAuto ? "Monitoring 20%-90%" : "Manual Control Only"}
                                    </p>
                                </div>
                            </div>
                            <Switch
                                checked={status.modes.motorAuto}
                                onCheckedChange={() => toggleAutoMode('motorAuto', status.modes.motorAuto)}
                                className="data-[state=checked]:bg-green-500"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Devices - 4 columns */}
                <Card className="lg:col-span-4 bg-slate-900/40 border-slate-800/60 backdrop-blur-xl">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Zap className="h-5 w-5 text-yellow-500" />
                            Device Controls
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map((i) => {
                            const key = `relay${i}` as keyof typeof status.relays;
                            const isOn = status.relays[key];
                            return (
                                <motion.button
                                    key={key}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => toggleRelay(key, isOn)}
                                    className={`flex flex-col items-center justify-center h-28 p-4 rounded-2xl transition-all border ${isOn
                                        ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                                        : 'bg-slate-950/40 border-slate-800 text-slate-500'
                                        }`}
                                >
                                    <Power className={`h-6 w-6 mb-2 ${isOn ? 'animate-pulse' : ''}`} />
                                    <span className="text-xs font-bold uppercase tracking-widest">Device {i}</span>
                                    <span className="text-[10px] mt-1 font-black">{isOn ? 'CONNECTED' : 'STANDBY'}</span>
                                </motion.button>
                            );
                        })}
                    </CardContent>
                </Card>

                {/* Alerts & Critical Systems - 12 columns */}
                <Card className="lg:col-span-12 bg-slate-900/40 border-slate-800/60 backdrop-blur-xl mt-4">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2 text-red-500">
                            <Bell className="h-6 w-6" />
                            Emergency Response Systems
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

                        {/* Fire Alert */}
                        <motion.div
                            animate={{ borderColor: status.sensors.isFire ? 'rgb(239, 68, 68)' : 'rgba(30, 41, 59, 1)' }}
                            className={`p-5 rounded-2xl flex items-center gap-5 border-2 transition-colors ${status.sensors.isFire ? 'bg-red-500/10' : 'bg-slate-950/40'}`}
                        >
                            <div className={`p-4 rounded-xl ${status.sensors.isFire ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-500'}`}>
                                <Flame className="h-8 w-8" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-black text-slate-300">Fire Detection</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className={`h-2 w-2 rounded-full ${status.sensors.isFire ? 'bg-red-500 animate-ping' : 'bg-green-500'}`} />
                                    <span className={`text-xs font-bold ${status.sensors.isFire ? 'text-red-500' : 'text-green-500 uppercase'}`}>
                                        {status.sensors.isFire ? "DANGER: Fire Detected" : "All Clear"}
                                    </span>
                                </div>
                            </div>
                        </motion.div>

                        {/* Smoke Alert */}
                        <motion.div
                            animate={{ borderColor: status.sensors.isSmoke ? 'rgb(249, 115, 22)' : 'rgba(30, 41, 59, 1)' }}
                            className={`p-5 rounded-2xl flex items-center gap-5 border-2 transition-colors ${status.sensors.isSmoke ? 'bg-orange-500/10' : 'bg-slate-950/40'}`}
                        >
                            <div className={`p-4 rounded-xl ${status.sensors.isSmoke ? 'bg-orange-500 text-white animate-pulse' : 'bg-slate-800 text-slate-500'}`}>
                                <Wind className="h-8 w-8" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-black text-slate-300">Smoke Monitor</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className={`h-2 w-2 rounded-full ${status.sensors.isSmoke ? 'bg-orange-500 animate-ping' : 'bg-green-500'}`} />
                                    <span className={`text-xs font-bold ${status.sensors.isSmoke ? 'text-orange-500' : 'text-green-500 uppercase'}`}>
                                        {status.sensors.isSmoke ? "Alert: Smoke Detected" : "Safety Normal"}
                                    </span>
                                </div>
                            </div>
                        </motion.div>

                        {/* Vibration/Earthquake */}
                        <motion.div
                            animate={{ borderColor: status.sensors.vibrationCount > 5 ? 'rgb(168, 85, 247)' : 'rgba(30, 41, 59, 1)' }}
                            className={`p-5 rounded-2xl flex items-center gap-5 border-2 transition-colors ${status.sensors.vibrationCount > 5 ? 'bg-purple-500/10' : 'bg-slate-950/40'}`}
                        >
                            <div className={`p-4 rounded-xl ${status.sensors.vibrationCount > 5 ? 'bg-purple-500 text-white animate-shake' : 'bg-slate-800 text-slate-500'}`}>
                                <AlertTriangle className="h-8 w-8" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-black text-slate-300">Vibration (Seismic)</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-2xl font-black ${status.sensors.vibrationCount > 5 ? 'text-purple-500' : 'text-slate-200'}`}>
                                        {status.sensors.vibrationCount}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase leading-tight">Events /<br />10s window</span>
                                </div>
                            </div>
                        </motion.div>

                        {/* PIR Motion */}
                        <div className={`p-5 rounded-2xl flex items-center gap-5 border-2 border-slate-800 bg-slate-950/40 overflow-hidden relative`}>
                            <div className={`p-4 rounded-xl ${status.sensors.isMotion ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                                <Eye className={`h-8 w-8 ${status.sensors.isMotion ? 'animate-[pulse_1s_infinite]' : ''}`} />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-black text-slate-300">Intruder/PIR</p>
                                <p className={`text-xs font-bold mt-1 ${status.sensors.isMotion ? 'text-green-500' : 'text-slate-500 uppercase'}`}>
                                    {status.sensors.isMotion ? "Motion Detected" : "Area Secure"}
                                </p>
                            </div>
                            {status.sensors.isMotion && (
                                <motion.div
                                    layoutId="motion-indicator"
                                    className="absolute top-0 right-0 w-1 h-full bg-green-500"
                                />
                            )}
                        </div>

                    </CardContent>
                </Card>

            </div>

            {/* Footer Branding */}
            <footer className="mt-12 pt-8 border-t border-slate-900 text-center text-slate-600">
                <p className="text-xs font-bold uppercase tracking-[0.2em]">Sentinel System v1.0.4 • Edge Computing & Firebase Synced</p>
            </footer>

            {/* Shake animation styles */}
            <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both infinite;
        }
      `}</style>
        </div>
    );
}
