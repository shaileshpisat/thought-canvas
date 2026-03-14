'use client';

import React, { useState, useEffect } from 'react';
import { X, HardDrive, Database, Info, Activity } from 'lucide-react';

interface StorageStatsProps {
    onClose: () => void;
}

export const StorageStats: React.FC<StorageStatsProps> = ({ onClose }) => {
    const [stats, setStats] = useState({
        totalUsed: 0,
        appUsed: 0,
        available: 5 * 1024 * 1024, // Standard 5MB limit
        itemCount: 0
    });

    useEffect(() => {
        const calculateUsage = () => {
            let total = 0;
            let app = 0;
            const APP_KEY = 'thought-canvas-data';

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) {
                    const value = localStorage.getItem(key) || '';
                    const size = (key.length + value.length) * 2; // UTF-16 characters are 2 bytes
                    total += size;
                    if (key === APP_KEY) {
                        app = size;
                    }
                }
            }

            // Estimate item count from app data
            let items = 0;
            const appData = localStorage.getItem(APP_KEY);
            if (appData) {
                try {
                    const parsed = JSON.parse(appData);
                    items = parsed.items?.length || 0;
                } catch (e) {
                    console.error('Failed to parse app data for stats', e);
                }
            }

            setStats(prev => ({
                ...prev,
                totalUsed: total,
                appUsed: app,
                itemCount: items
            }));
        };

        calculateUsage();
    }, []);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const percentage = Math.min((stats.totalUsed / stats.available) * 100, 100);
    const appPercentage = (stats.appUsed / stats.totalUsed) * 100 || 0;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="relative w-full max-w-md glass rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center border border-sky-500/30">
                            <Activity size={20} className="text-sky-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-display font-bold text-white">Storage Statistics</h2>
                            <p className="text-xs text-white/40 font-medium">Local Data Usage</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-8">
                    {/* Progress Bar Container */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <span className="text-sm font-medium text-white/60">Total Capacity Used</span>
                            <span className="text-sm font-bold text-sky-400">{percentage.toFixed(1)}%</span>
                        </div>
                        <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                            <div
                                className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-1000 ease-out rounded-full shadow-[0_0_10px_rgba(56,189,248,0.5)]"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-white/30">
                            <span>0 MB</span>
                            <span>5 MB Limit</span>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                            <div className="flex items-center gap-2 text-white/40">
                                <Database size={14} />
                                <span className="text-[10px] uppercase font-bold tracking-wider">App Data</span>
                            </div>
                            <div className="text-lg font-display font-bold text-white">
                                {formatSize(stats.appUsed)}
                            </div>
                            <div className="text-[10px] text-white/30 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-sky-400"></span>
                                {stats.itemCount} canvas items
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                            <div className="flex items-center gap-2 text-white/40">
                                <HardDrive size={14} />
                                <span className="text-[10px] uppercase font-bold tracking-wider">Total Used</span>
                            </div>
                            <div className="text-lg font-display font-bold text-white">
                                {formatSize(stats.totalUsed)}
                            </div>
                            <div className="text-[10px] text-white/30 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-indigo-400"></span>
                                {appPercentage.toFixed(0)}% from this app
                            </div>
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="flex gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                        <Info size={18} className="text-amber-400 shrink-0" />
                        <p className="text-xs text-amber-200/70 leading-relaxed">
                            Data is stored locally in your browser. Clearing your history or site data may remove your thoughts and images.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-white/5 border-t border-white/10 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all text-sm border border-white/10 hover:border-white/20"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
};
