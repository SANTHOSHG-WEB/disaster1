"use client";

import React, { useState, useEffect } from 'react';
 
export const dynamic = 'force-dynamic';
 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Phone, MapPin, Search, Shield, Heart, Users, Download, Flame, Wind, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { db } from '@/lib/firebase-client';
import { ref, onValue } from 'firebase/database';
import { motion, AnimatePresence } from 'framer-motion';

interface EmergencyContact {
    id: string;
    name: string;
    phone: string;
    category: string;
    description?: string;
    location?: string;
}

const FALLBACK_CONTACTS: EmergencyContact[] = [
    { id: '1', name: 'Police', phone: '100', category: 'emergency', description: 'Immediate police assistance' },
    { id: '2', name: 'Fire Department', phone: '101', category: 'emergency', description: 'Fire and rescue services' },
    { id: '3', name: 'Ambulance', phone: '102', category: 'medical', description: 'Emergency medical services' },
    { id: '4', name: 'Disaster Management', phone: '108', category: 'emergency', description: 'Disaster response helpline' },
    { id: '5', name: 'Women Helpline', phone: '1091', category: 'support', description: 'Safety and support for women' },
    { id: '6', name: 'Child Helpline', phone: '1098', category: 'support', description: 'Emergency support for children' }
];

export default function EmergencyPage() {
    const [contacts, setContacts] = useState<EmergencyContact[]>(FALLBACK_CONTACTS);
    const [hardwareAlerts, setHardwareAlerts] = useState({ fire: false, smoke: false, vibration: 0 });
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchContacts() {
            try {
                const { data, error } = await supabase.from('emergency_contacts').select('*');
                if (data && data.length > 0) setContacts(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchContacts();

        // Firebase Realtime Hardware Alerts
        const alertsRef = ref(db, 'hardware/sensors');
        const unsubscribe = onValue(alertsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setHardwareAlerts({
                    fire: !!data.isFire,
                    smoke: !!data.isSmoke,
                    vibration: data.vibrationCount || 0
                });
            }
        });

        return () => unsubscribe();
    }, []);

    const filtered = contacts.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.category.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="container mx-auto max-w-4xl px-4 py-12">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold mb-4">Emergency Contacts</h1>
                <p className="text-muted-foreground">Quick access to essential services across India</p>
            </div>

            <Card className="mb-8 border-destructive/50 bg-destructive/10">
                <CardContent className="p-6 flex items-center gap-4">
                    <Shield className="h-10 w-10 text-destructive" />
                    <div>
                        <h3 className="text-xl font-bold text-destructive">Stay Safe. Stay Calm.</h3>
                        <p className="text-sm opacity-80">Call the appropriate number immediately in case of emergency.</p>
                    </div>
                </CardContent>
            </Card>

            <AnimatePresence>
                {(hardwareAlerts.fire || hardwareAlerts.smoke || hardwareAlerts.vibration > 5) && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mb-8 space-y-4 overflow-hidden"
                    >
                        {hardwareAlerts.fire && (
                            <Card className="border-red-500 bg-red-500/10 animate-pulse">
                                <CardContent className="p-4 flex items-center gap-4 text-red-500">
                                    <Flame className="h-8 w-8" />
                                    <div>
                                        <h3 className="font-black text-lg">CRITICAL: FIRE DETECTED</h3>
                                        <p className="text-sm opacity-90">Evacuate immediately! All relays have been automatic shut down.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                        {hardwareAlerts.smoke && (
                            <Card className="border-orange-500 bg-orange-500/10">
                                <CardContent className="p-4 flex items-center gap-4 text-orange-500">
                                    <Wind className="h-8 w-8" />
                                    <div>
                                        <h3 className="font-black text-lg">ALERT: SMOKE DETECTED</h3>
                                        <p className="text-sm opacity-90">Immediate ventilation active. Check for source of smoke.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                        {hardwareAlerts.vibration > 5 && (
                            <Card className="border-purple-500 bg-purple-500/10">
                                <CardContent className="p-4 flex items-center gap-4 text-purple-500">
                                    <AlertTriangle className="h-8 w-8" />
                                    <div>
                                        <h3 className="font-black text-lg">ALERT: SEISMIC ACTIVITY</h3>
                                        <p className="text-sm opacity-90">Significant vibration detected ({hardwareAlerts.vibration} events). Move to safety zone.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative mb-8">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    className="glass pl-10 h-12 text-lg"
                    placeholder="Search by name or category (e.g. Police, Medical)..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {filtered.map(contact => (
                    <Card key={contact.id} className="glass border-glass-border hover:scale-[1.02] transition-transform">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-xl">{contact.name}</CardTitle>
                                    <Badge variant="secondary" className="mt-1 bg-glass/50">{contact.category}</Badge>
                                </div>
                                <div className="bg-primary/20 p-2 rounded-full">
                                    {contact.category === 'medical' ? <Heart className="h-5 w-5 text-accent" /> : <Phone className="h-5 w-5 text-primary" />}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">{contact.description}</p>
                            <div className="flex items-center justify-between">
                                <span className="text-2xl font-mono font-bold tracking-tighter">{contact.phone}</span>
                                <Button size="sm" onClick={() => window.open(`tel:${contact.phone}`)} className="bg-destructive hover:bg-destructive/90 text-white">Call Now</Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
