'use client';

import React, { useRef, useState } from 'react';
import { AlertTriangle, Upload, X, CheckCircle, Loader2 } from 'lucide-react';
import { restoreFromBackup } from '@/utils/imageBackup';

interface Props {
    brokenIds: string[];
    onRestored: () => void;
    onDismiss: () => void;
}

export const ImageRestoreBanner: React.FC<Props> = ({ brokenIds, onRestored, onDismiss }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStatus('loading');
        setMessage('');

        try {
            const restored = await restoreFromBackup(file, brokenIds);
            if (restored === 0) {
                setStatus('error');
                setMessage('No matching images found in this backup file. Try a different backup.');
            } else {
                setStatus('success');
                setMessage(`${restored} of ${brokenIds.length} image${brokenIds.length !== 1 ? 's' : ''} restored. Reload the page to see them.`);
                setTimeout(() => onRestored(), 2000);
            }
        } catch (err) {
            setStatus('error');
            setMessage(err instanceof Error ? err.message : 'Restore failed.');
        }

        // Reset input so the same file can be re-selected if needed
        e.target.value = '';
    };

    return (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[500] w-[480px] max-w-[92vw] rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-white/10 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
            style={{ background: 'rgba(20, 10, 10, 0.97)', backdropFilter: 'blur(20px)' }}
        >
            <div className="px-4 py-3 flex items-start gap-3">
                {status === 'success' ? (
                    <CheckCircle size={18} className="text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                    <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                    {status === 'success' ? (
                        <p className="text-sm font-semibold text-emerald-300">Images restored</p>
                    ) : (
                        <p className="text-sm font-semibold text-amber-300">
                            {brokenIds.length} image{brokenIds.length !== 1 ? 's' : ''} could not be loaded
                        </p>
                    )}

                    <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                        {status === 'success'
                            ? message
                            : status === 'error'
                            ? message
                            : 'Their data was cleared by the browser. Upload a backup file to restore them.'}
                    </p>

                    {status !== 'success' && (
                        <div className="mt-2.5 flex items-center gap-2">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={status === 'loading'}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {status === 'loading' ? (
                                    <Loader2 size={13} className="animate-spin" />
                                ) : (
                                    <Upload size={13} />
                                )}
                                {status === 'loading' ? 'Restoring…' : 'Upload backup file'}
                            </button>
                            <span className="text-[10px] text-white/25">
                                thought-canvas-images-YYYY-MM-DD.json
                            </span>
                        </div>
                    )}
                </div>

                <button
                    onClick={onDismiss}
                    className="p-1 text-white/30 hover:text-white/70 transition-colors shrink-0"
                >
                    <X size={14} />
                </button>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileChange}
            />
        </div>
    );
};
