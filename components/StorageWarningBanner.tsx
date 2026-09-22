'use client';

import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useStorageMonitor } from '@/hooks/useStorageMonitor';

interface StorageWarningBannerProps {
    onOpenStats: () => void;
}

export const StorageWarningBanner: React.FC<StorageWarningBannerProps> = ({ onOpenStats }) => {
    const { isNearLimit, fraction, loading } = useStorageMonitor();
    const [dismissed, setDismissed] = useState(false);

    if (loading || !isNearLimit || dismissed) return null;

    const percentage = (fraction * 100).toFixed(0);

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[150] w-full max-w-lg px-4 animate-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 backdrop-blur-md shadow-lg">
                <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                <p className="flex-1 text-sm text-amber-200/90 font-medium">
                    Storage is {percentage}% full. Consider deleting images or clearing unused items.
                </p>
                <button
                    onClick={onOpenStats}
                    className="text-xs font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2 shrink-0"
                >
                    Details
                </button>
                <button
                    onClick={() => setDismissed(true)}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors text-amber-400/60 hover:text-amber-400"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};
