'use client';

import React from 'react';
import { Trash2, RotateCcw, X, FileText, Image as ImageIcon, Link as LinkIcon, Layers, AlertTriangle } from 'lucide-react';
import { RecycleBinItem } from '@/types/canvas';

interface RecycleBinProps {
  items: RecycleBinItem[];
  onRestore: (id: string) => void;
  onDeletePermanently: (id: string) => void;
  onEmptyBin: () => void;
  onClose: () => void;
  daysRemaining: (item: RecycleBinItem) => number;
}

function getTypeIcon(type: RecycleBinItem['type']) {
  switch (type) {
    case 'image':   return <ImageIcon size={14} className="text-purple-400 shrink-0" />;
    case 'link':    return <LinkIcon size={14} className="text-sky-400 shrink-0" />;
    case 'canvas':  return <Layers size={14} className="text-amber-400 shrink-0" />;
    default:        return <FileText size={14} className="text-white/50 shrink-0" />;
  }
}

function getContentPreview(item: RecycleBinItem): string {
  if (item.type === 'image') return '[Image]';
  if (item.type === 'canvas') return `[Canvas: ${item.content}]`;
  const text = item.metadata?.title || item.content;
  return text.length > 80 ? text.slice(0, 80) + '…' : text;
}

function formatDeletedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function RecycleBin({
  items,
  onRestore,
  onDeletePermanently,
  onEmptyBin,
  onClose,
  daysRemaining,
}: RecycleBinProps) {
  const handleEmptyBin = () => {
    if (confirm(`Permanently delete all ${items.length} item${items.length !== 1 ? 's' : ''} from the recycle bin? This cannot be undone.`)) {
      onEmptyBin();
    }
  };

  const handleDeletePermanently = (id: string) => {
    if (confirm('Permanently delete this item? This cannot be undone.')) {
      onDeletePermanently(id);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-xl mx-4 rounded-2xl shadow-2xl shadow-black/80 ring-1 ring-white/10 flex flex-col max-h-[80vh] animate-in fade-in slide-in-from-bottom-3 duration-200"
        style={{ background: 'rgba(8, 12, 24, 0.98)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center">
              <Trash2 size={16} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white/90">Recycle Bin</h2>
              <p className="text-[10px] text-white/35 mt-0.5">
                Items are permanently deleted after 45 days
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                onClick={handleEmptyBin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-red-400 hover:bg-red-500/15 transition-colors border border-red-500/25 hover:border-red-500/40"
              >
                <Trash2 size={12} />
                Empty Bin
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/8 transition-colors text-white/40 hover:text-white/70"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Trash2 size={36} className="text-white/10" />
              <p className="text-white/25 text-sm font-medium">Recycle bin is empty</p>
              <p className="text-white/15 text-xs">Deleted items will appear here</p>
            </div>
          ) : (
            items.map((item) => {
              const days = daysRemaining(item);
              const isExpiringSoon = days <= 7;
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/4 transition-colors group border border-transparent hover:border-white/6"
                >
                  {/* Type icon */}
                  <div className="mt-0.5 w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    {getTypeIcon(item.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70 leading-relaxed line-clamp-2 font-medium">
                      {getContentPreview(item)}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-white/30">
                        Deleted {formatDeletedAt(item.deletedAt)}
                      </span>
                      <span className="text-white/15">·</span>
                      <span className={`text-[10px] flex items-center gap-0.5 ${isExpiringSoon ? 'text-red-400/70' : 'text-white/30'}`}>
                        {isExpiringSoon && <AlertTriangle size={9} className="shrink-0" />}
                        {days}d left
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onRestore(item.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-sky-400 hover:bg-sky-500/15 transition-colors border border-sky-500/20 hover:border-sky-500/40"
                      title="Restore to canvas"
                    >
                      <RotateCcw size={11} />
                      Restore
                    </button>
                    <button
                      onClick={() => handleDeletePermanently(item.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/12 transition-colors"
                      title="Delete permanently"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-5 py-3 border-t border-white/8">
            <p className="text-[10px] text-white/25 text-center">
              {items.length} item{items.length !== 1 ? 's' : ''} in recycle bin
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
