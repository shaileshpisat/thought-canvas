'use client';

import React, { useEffect } from 'react';
import { X, HardDrive, Database, Info, Activity } from 'lucide-react';
import { useStorageMonitor } from '@/hooks/useStorageMonitor';
import { STORAGE_LIMIT_BYTES, STORAGE_WARN_THRESHOLD } from '@/config/storageConfig';

interface StorageStatsProps {
    onClose: () => void;
    onClearCanvas: () => void;
}

export const StorageStats: React.FC<StorageStatsProps> = ({ onClose, onClearCanvas }) => {
    const { usage, quota, fraction, loading, refresh } = useStorageMonitor();

    // Re-fetch when the modal is opened so data is always current
    useEffect(() => { refresh(); }, [refresh]);

    // Item count from localStorage canvas data
    let itemCount = 0;
    try {
        const raw = localStorage.getItem('black-board-data');
        if (raw) itemCount = JSON.parse(raw)?.items?.length ?? 0;
    } catch { /* ignore */ }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const percentage = (fraction * 100).toFixed(1);
    const isWarning = fraction >= STORAGE_WARN_THRESHOLD;
    const barColor = isWarning
        ? 'bg-gradient-to-r from-amber-500 to-red-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
        : 'bg-gradient-to-r from-sky-500 to-indigo-500 shadow-[0_0_10px_rgba(56,189,248,0.5)]';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="relative w-full max-w-md glass rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center border border-sky-500/30">
                            <Activity size={20} className="text-sky-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-display font-bold text-white">Storage Statistics</h2>
                            <p className="text-xs text-white/40 font-medium">
                                {STORAGE_LIMIT_BYTES !== null
                                    ? `App limit: ${formatSize(STORAGE_LIMIT_BYTES)}`
                                    : 'Using browser quota'}
                            </p>
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
                <div className="p-8 space-y-8 overflow-y-auto flex-1">
                    {/* Progress Bar */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-end">
                            <span className="text-sm font-medium text-white/60">Storage Used</span>
                            <span className={`text-sm font-bold ${isWarning ? 'text-amber-400' : 'text-sky-400'}`}>
                                {loading ? '…' : `${percentage}%`}
                            </span>
                        </div>
                        <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                            <div
                                className={`h-full transition-all duration-1000 ease-out rounded-full ${barColor}`}
                                style={{ width: loading ? '0%' : `${fraction * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-white/30">
                            <span>0</span>
                            <span>{formatSize(quota)} Limit</span>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                            <div className="flex items-center gap-2 text-white/40">
                                <Database size={14} />
                                <span className="text-[10px] uppercase font-bold tracking-wider">Total Used</span>
                            </div>
                            <div className="text-lg font-display font-bold text-white">
                                {loading ? '…' : formatSize(usage)}
                            </div>
                            <div className="text-[10px] text-white/30 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-sky-400"></span>
                                All storage for this app
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                            <div className="flex items-center gap-2 text-white/40">
                                <HardDrive size={14} />
                                <span className="text-[10px] uppercase font-bold tracking-wider">Canvas Items</span>
                            </div>
                            <div className="text-lg font-display font-bold text-white">
                                {itemCount}
                            </div>
                            <div className="text-[10px] text-white/30 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-indigo-400"></span>
                                {formatSize(quota - usage)} remaining
                            </div>
                        </div>
                    </div>


                    {/* Info / Warning Box */}
                    {isWarning ? (
                        <div className="flex gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
                            <Info size={18} className="text-red-400 shrink-0" />
                            <p className="text-xs text-red-200/70 leading-relaxed">
                                Storage is almost full ({percentage}% used). Delete large image items or clear the canvas to free up space.
                            </p>
                        </div>
                    ) : (
                        <div className="flex gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                            <Info size={18} className="text-amber-400 shrink-0" />
                            <p className="text-xs text-amber-200/70 leading-relaxed">
                                Data is stored locally in your browser. Clearing your browser history or site data may remove your thoughts and images.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-white/5 border-t border-white/10 flex justify-between items-center">
                    <button
                        onClick={() => { onClearCanvas(); onClose(); }}
                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-xl transition-all text-sm border border-red-500/20 hover:border-red-500/40"
                    >
                        Clear Canvas
                    </button>
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
