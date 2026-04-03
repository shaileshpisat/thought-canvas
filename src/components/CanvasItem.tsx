'use client';

import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue } from 'framer-motion';
import { CanvasItem as ICanvasItem } from '@/types/canvas';
import { Trash2, ExternalLink, GripVertical, Edit3, ArrowRight, ArrowUpLeft, LogIn, Layers, X, Maximize2, Eye, Calendar, ChevronDown, Flag, ScanSearch, Play, Pause, Square, ListPlus, Clock, Plus, Hash, History, Move, Settings2, Archive } from 'lucide-react';
import { Priority, CanvasTimer, CanvasAction, CanvasHistoryEntry } from '@/types/canvas';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getRelativeLabel, getDateStatus } from '@/utils/dateUtils';
import { isIdbSentinel, sentinelId, getImage } from '@/utils/imageDB';
import { BlockLinkPicker } from './BlockLinkPicker';

/** Resolves an image item's content to a renderable src string.
 *  - bare base64 / URL: returned as-is
 *  - "idb:<id>" sentinel: fetched from IndexedDB and converted to an object URL
 */
function useImageSrc(content: string): string {
    const [src, setSrc] = useState<string>(() => (isIdbSentinel(content) ? '' : content));

    useEffect(() => {
        if (!isIdbSentinel(content)) {
            setSrc(content);
            return;
        }
        let objectUrl: string | null = null;
        getImage(sentinelId(content)).then((blob) => {
            if (blob) {
                objectUrl = URL.createObjectURL(blob);
                setSrc(objectUrl);
            }
        });
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [content]);

    return src;
}

interface Props {
    item: ICanvasItem;
    onUpdate: (id: string, updates: Partial<ICanvasItem>) => void;
    onRemove: (id: string) => void;
    onMove: (id: string, x: number, y: number) => void;
    onEnterCanvas?: (id: string) => void;
    // Move in/out of sub-canvases
    canEject?: boolean;
    onEject?: () => void;
    onArchive?: () => void;
    moveTargets?: ICanvasItem[]; // sibling canvas-type items to move into
    onMoveInto?: (targetCanvasId: string) => void;
    // Timer support
    clockTick?: number;
    onToggleTimer?: (id: string) => void;
    onStopTimer?: (id: string) => void;
    isAlerting?: boolean;
    isHighlighted?: boolean;
    onLogAction?: (id: string, label: string) => void;
    onDeleteAction?: (id: string, actionId: string) => void;
    tagMaster?: string[];
    onUpdateTags?: (id: string, tags: string[]) => void;
    onLogHistory?: (id: string, type: CanvasHistoryEntry['type'], action: string, snapshot?: string) => void;
    allItems?: ICanvasItem[];
    onNavigateToBlock?: (path: string[], itemId: string) => void;
}

import { ITEM_DEFAULTS } from '@/utils/canvasConstants';

const MIN_WIDTH = 150;
const MIN_HEIGHT = 80;

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatSeconds(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getTodayMidnight(): number {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/** Seconds elapsed today (completed sessions + live running if started today) */
function getTodayElapsed(timer: CanvasTimer): number {
    const midnight = getTodayMidnight();
    let todaySecs = 0;
    for (const s of timer.sessions ?? []) {
        if (s.end !== undefined && s.start >= midnight) {
            todaySecs += Math.floor((s.end - s.start) / 1000);
        }
    }
    if (timer.isRunning && timer.startTime >= midnight) {
        todaySecs += Math.floor((Date.now() - timer.startTime) / 1000);
    }
    return todaySecs;
}

/** Seconds elapsed before today (from totalElapsed, subtract today's completed sessions) */
function getPastElapsed(timer: CanvasTimer): number {
    const midnight = getTodayMidnight();
    let todayCompleted = 0;
    for (const s of timer.sessions ?? []) {
        if (s.end !== undefined && s.start >= midnight) {
            todayCompleted += Math.floor((s.end - s.start) / 1000);
        }
    }
    // If running session started before today, that running time counts as past
    let runningPast = 0;
    if (timer.isRunning && timer.startTime < midnight) {
        runningPast = Math.floor((Date.now() - timer.startTime) / 1000);
    }
    return timer.totalElapsed - todayCompleted + runningPast;
}

function formatTimerElapsed(timer: CanvasTimer): string {
    let seconds = timer.totalElapsed;
    if (timer.isRunning) {
        seconds += Math.floor((Date.now() - timer.startTime) / 1000);
    }
    return formatSeconds(seconds);
}


const MD_COMPONENTS_BASE = {
    h1: ({ node, ...props }: any) => <h1 className="text-xl font-bold text-sky-400 mb-3 mt-4 first:mt-0" {...props} />,
    h2: ({ node, ...props }: any) => <h2 className="text-lg font-bold text-sky-400/90 mb-2 mt-3" {...props} />,
    h3: ({ node, ...props }: any) => <h3 className="text-base font-bold text-sky-400/80 mb-2 mt-2" {...props} />,
    p: ({ node, ...props }: any) => <p className="leading-relaxed mb-3 last:mb-0" {...props} />,
    ul: ({ node, ...props }: any) => <ul className="list-disc pl-4 mb-3 space-y-1" {...props} />,
    ol: ({ node, ...props }: any) => <ol className="list-decimal pl-4 mb-3 space-y-1" {...props} />,
    li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
    blockquote: ({ node, ...props }: any) => (
        <blockquote className="border-l-4 border-sky-500/50 bg-white/5 py-2 px-4 my-3 rounded-r-lg italic text-white/70" {...props} />
    ),
    code: ({ node, ...props }: any) => (
        <code className="text-sky-300 bg-white/10 px-1.5 py-0.5 rounded text-[0.9em] font-mono" {...props} />
    ),
};

function makeMdComponents(onNavigateToBlock?: (path: string[], itemId: string) => void) {
    return {
        ...MD_COMPONENTS_BASE,
        a: ({ node, href, children, ...props }: any) => {
            if (href?.startsWith('block://') && onNavigateToBlock) {
                const blockId = href.slice('block://'.length);
                return (
                    <button
                        className="text-violet-400 underline hover:text-violet-300 transition-colors decoration-dotted cursor-pointer"
                        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={e => { e.preventDefault(); e.stopPropagation(); onNavigateToBlock([], blockId); }}
                    >
                        {children}
                    </button>
                );
            }
            return (
                <a className="text-sky-400 underline hover:text-sky-300 transition-colors" target="_blank" rel="noopener noreferrer" href={href} {...props}>
                    {children}
                </a>
            );
        },
    };
}

const DURATION_PRESETS = [
    { label: '5 min', minutes: 5 },
    { label: '10 min', minutes: 10 },
    { label: '15 min', minutes: 15 },
    { label: '30 min', minutes: 30 },
    { label: '45 min', minutes: 45 },
    { label: '1 hour', minutes: 60 },
    { label: '1.5 hours', minutes: 90 },
    { label: '2 hours', minutes: 120 },
    { label: '3 hours', minutes: 180 },
    { label: '4 hours', minutes: 240 },
    { label: 'All day', minutes: 480 },
];

function formatBlockDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function addMinutesToTime(timeStr: string, minutes: number): string {
    const [hh, mm] = timeStr.split(':').map(Number);
    const total = hh * 60 + mm + minutes;
    const eh = Math.floor(total / 60) % 24;
    const em = total % 60;
    return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

const RECURRING_OPTIONS: { value: import('@/types/canvas').CanvasItem['recurring']; label: string; icon: string }[] = [
    { value: 'daily',    label: 'Daily',       icon: '↻' },
    { value: 'weekdays', label: 'Weekdays',     icon: '↻' },
    { value: 'weekly',   label: 'Weekly',       icon: '↻' },
    { value: 'biweekly', label: 'Bi-weekly',    icon: '↻' },
    { value: 'monthly',  label: 'Monthly',      icon: '↻' },
];

const ChildImageThumb: React.FC<{ content: string }> = ({ content }) => {
    const src = useImageSrc(content);
    return src
        ? <img src={src} alt="" className="w-full h-full object-cover opacity-70" />
        : <div className="w-full h-full bg-white/5 animate-pulse" />;
};

export const CanvasItem: React.FC<Props> = ({ item, onUpdate, onRemove, onMove, onEnterCanvas, canEject, onEject, onArchive, moveTargets, onMoveInto, clockTick: _clockTick, onToggleTimer, onStopTimer, isAlerting, isHighlighted, onLogAction, onDeleteAction, tagMaster = [], onUpdateTags, onLogHistory, allItems = [], onNavigateToBlock }) => {
    const imageSrc = useImageSrc(item.content);
    const [isHovered, setIsHovered] = useState(false);
    const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [showMoveInto, setShowMoveInto] = useState(false);
    const [showPriority, setShowPriority] = useState(false);
    const [showDuration, setShowDuration] = useState(false);
    const [showRecurring, setShowRecurring] = useState(false);
    const [localSize, setLocalSize] = useState<{ width: number; height: number } | null>(null);
    const [previewPos, setPreviewPos] = useState<{ top: number; left: number } | null>(null);
    const [isLogging, setIsLogging] = useState(false);
    const [logText, setLogText] = useState('');
    const [isAddingTag, setIsAddingTag] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [showManualLogs, setShowManualLogs] = useState(true);
    const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
    const [blockPickerPos, setBlockPickerPos] = useState<{ top: number; left: number } | null>(null);
    const blockPickerTriggerPos = useRef<number>(0); // cursor position where [[ was typed

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const dateInputRef = useRef<HTMLInputElement>(null);
    const timeInputRef = useRef<HTMLInputElement>(null);
    const logInputRef = useRef<HTMLInputElement>(null);
    const tagInputRef = useRef<HTMLInputElement>(null);
    const isDragging = useRef(false);
    const openingDatePicker = useRef(false);
    const blockPickerOpenRef = useRef(false);
    const preEditContentRef = useRef<string>(item.content);

    const motionX = useMotionValue(item.x);
    const motionY = useMotionValue(item.y);

    const dateStatus = item.date ? getDateStatus(item.date) : null;
    const dateLabel = item.date ? getRelativeLabel(item.date) : null;

    const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; border: string; dot: string }> = {
        'very-high': { label: 'Very High', color: 'text-red-400',    border: 'border-l-red-500',    dot: 'bg-red-500' },
        'high':      { label: 'High',      color: 'text-orange-400', border: 'border-l-orange-500', dot: 'bg-orange-500' },
        'medium':    { label: 'Medium',    color: 'text-yellow-400', border: 'border-l-yellow-500', dot: 'bg-yellow-500' },
        'low':       { label: 'Low',       color: 'text-blue-400',   border: 'border-l-blue-500',   dot: 'bg-blue-500' },
        'very-low':  { label: 'Very Low',  color: 'text-white/30',   border: 'border-l-white/20',   dot: 'bg-white/25' },
    };
    const priorityCfg = item.priority ? PRIORITY_CONFIG[item.priority] : null;

    useEffect(() => {
        if (!isDragging.current) motionX.set(item.x);
    }, [item.x]);

    useEffect(() => {
        if (!isDragging.current) motionY.set(item.y);
    }, [item.y]);

    useEffect(() => {
        if (isEditing || isExpanded) {
            preEditContentRef.current = item.content;
        } else {
            if (item.content !== preEditContentRef.current) {
                const oldText = preEditContentRef.current || '';
                const newText = item.content || '';

                // Identify the changed region (simplified diff)
                let start = 0;
                while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) start++;
                let oldEnd = oldText.length - 1;
                let newEnd = newText.length - 1;
                while (oldEnd >= start && newEnd >= start && oldText[oldEnd] === newText[newEnd]) {
                    oldEnd--;
                    newEnd--;
                }

                const removed = oldText.slice(start, oldEnd + 1);
                const added = newText.slice(start, newEnd + 1);

                let snapshot = '';
                if (removed && added) snapshot = `${removed.slice(0, 40)} → ${added.slice(0, 40)}`;
                else if (added) snapshot = added.slice(0, 80);
                else if (removed) snapshot = `Removed: ${removed.slice(0, 80)}`;

                if (snapshot.length > 90) snapshot = snapshot.slice(0, 90) + '...';

                const action = !oldText && newText ? 'Added text' : !newText && oldText ? 'Removed text' : 'Edited text';
                onLogHistory?.(item.id, 'content', action, snapshot || undefined);
                preEditContentRef.current = item.content;
            }
        }
    }, [isEditing, isExpanded]);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
        }
        if (isEditing && cardRef.current) {
            const rect = cardRef.current.getBoundingClientRect();
            const previewWidth = 300;
            const gap = 12;
            // Prefer right side; fall back to left
            const leftCandidate = rect.right + gap;
            const left = leftCandidate + previewWidth > window.innerWidth
                ? rect.left - previewWidth - gap
                : leftCandidate;
            const top = Math.min(rect.top, window.innerHeight - 420);
            setPreviewPos({ top: Math.max(8, top), left: Math.max(8, left) });
        }
        if (!isEditing) {
            setPreviewPos(null);
        }
    }, [isEditing]);

    useEffect(() => {
        if (isRenaming && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [isRenaming]);

    const handleDragStart = () => {
        isDragging.current = true;
    };

    const handleDragEnd = () => {
        isDragging.current = false;
        onMove(item.id, motionX.get(), motionY.get());
    };

    const handleResizePointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);

        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const startW = item.width ?? defaultWidth;
        const startH = item.height ?? defaultHeight;

        const onPointerMove = (ev: PointerEvent) => {
            const newW = Math.max(MIN_WIDTH, startW + ev.clientX - startClientX);
            const newH = Math.max(MIN_HEIGHT, startH + ev.clientY - startClientY);
            setLocalSize({ width: newW, height: newH });
        };

        const onPointerUp = (ev: PointerEvent) => {
            const newW = Math.max(MIN_WIDTH, startW + ev.clientX - startClientX);
            const newH = Math.max(MIN_HEIGHT, startH + ev.clientY - startClientY);
            const updates: Partial<ICanvasItem> = { width: newW, height: newH };
            if (item.type === 'image' && item.metadata?.naturalSize) {
                updates.metadata = { ...item.metadata, naturalSize: false };
            }
            onUpdate(item.id, updates);
            setLocalSize(null);
            setIsResizing(false);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    };

        const { width: defaultWidth, height: defaultHeight } = ITEM_DEFAULTS[item.type];

    const currentWidth = localSize?.width ?? item.width ?? defaultWidth;
    const currentHeight = localSize?.height ?? item.height ?? defaultHeight;

    const handleDateClick = () => {
        if (dateInputRef.current) {
            try {
                (dateInputRef.current as any).showPicker();
            } catch {
                dateInputRef.current.click();
            }
        }
    };

    const handleTimeClick = () => {
        if (timeInputRef.current) {
            try {
                (timeInputRef.current as any).showPicker();
            } catch {
                timeInputRef.current.click();
            }
        }
    };

    const renderContent = () => {
        switch (item.type) {
            case 'text':
                return (
                    <>
                        {/* Inline editing: textarea inside the card */}
                        {isEditing ? (
                            <textarea
                                ref={textareaRef}
                                className="w-full h-full bg-transparent outline-none resize-none text-white/90 placeholder-white/20 p-4 font-mono text-sm leading-relaxed"
                                value={item.content}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const cursor = e.target.selectionStart ?? val.length;
                                    const before = val.slice(0, cursor);
                                    if (before.endsWith('[[') && allItems.length > 0) {
                                        blockPickerTriggerPos.current = cursor - 2;
                                        const ta = e.target;
                                        const rect = ta.getBoundingClientRect();
                                        blockPickerOpenRef.current = true;
                                        setBlockPickerPos({ top: rect.bottom + 4, left: rect.left });
                                    } else if (blockPickerPos) {
                                        blockPickerOpenRef.current = false;
                                        setBlockPickerPos(null);
                                    }
                                    onUpdate(item.id, { content: val });
                                }}
                                onBlur={() => { if (!openingDatePicker.current && !blockPickerOpenRef.current) setIsEditing(false); }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape' && blockPickerPos) {
                                        setBlockPickerPos(null);
                                        return;
                                    }
                                    if (e.key === '@') {
                                        e.preventDefault();
                                        openingDatePicker.current = true;
                                        handleDateClick();
                                        setTimeout(() => { openingDatePicker.current = false; }, 300);
                                    }
                                }}
                                placeholder="Type something in Markdown..."
                                spellCheck={false}
                            />
                        ) : (
                            <div
                                className="w-full h-full p-4 overflow-y-auto cursor-text text-white/90"
                                onClick={() => setIsEditing(true)}
                            >
                                {item.content
                                    ? <div className="text-sm max-w-none text-white/90">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={makeMdComponents(onNavigateToBlock)}>{item.content}</ReactMarkdown>
                                      </div>
                                    : <span className="text-white/30 italic">Click to edit...</span>
                                }
                            </div>
                        )}

                        {/* Block link picker — shown when user types [[ in edit mode */}
                        {isEditing && blockPickerPos && (
                            <BlockLinkPicker
                                allItems={allItems}
                                anchorPos={blockPickerPos}
                                onPick={(pickedItem, pickedPath) => {
                                    const label = pickedItem.type === 'link'
                                        ? (pickedItem.metadata?.title || pickedItem.content || 'Block')
                                        : (pickedItem.content?.split('\n')[0]?.slice(0, 60) || 'Block');
                                    const insertion = `[${label}](block://${pickedItem.id})`;
                                    const ta = textareaRef.current;
                                    if (ta) {
                                        const before = item.content.slice(0, blockPickerTriggerPos.current);
                                        const after = item.content.slice(ta.selectionStart ?? item.content.length);
                                        onUpdate(item.id, { content: before + insertion + after });
                                        requestAnimationFrame(() => {
                                            const pos = blockPickerTriggerPos.current + insertion.length;
                                            ta.setSelectionRange(pos, pos);
                                            ta.focus();
                                        });
                                    }
                                    blockPickerOpenRef.current = false;
                                    setBlockPickerPos(null);
                                }}
                                onClose={() => {
                                    blockPickerOpenRef.current = false;
                                    setBlockPickerPos(null);
                                    textareaRef.current?.focus();
                                }}
                            />
                        )}

                        {/* Inline edit: floating preview panel next to the card */}
                        {isEditing && previewPos && createPortal(
                            <div
                                className="fixed z-[999] rounded-xl shadow-2xl shadow-black/60 ring-1 ring-white/15 flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-2 duration-150"
                                style={{ top: previewPos.top, left: previewPos.left, width: currentWidth, height: currentHeight, background: 'rgba(8, 14, 26, 0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                {/* Floating preview indicator */}
                                <div className="absolute top-2 right-2 z-10 p-1 rounded-md bg-white/5 ring-1 ring-white/10" title="Preview">
                                    <Eye size={11} className="text-white/30" />
                                </div>
                                <div className="flex-1 p-4 overflow-y-auto text-sm text-white/90">
                                    {item.content
                                        ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={makeMdComponents(onNavigateToBlock)}>{item.content}</ReactMarkdown>
                                        : <span className="text-white/20 italic text-xs">Preview will appear here...</span>
                                    }
                                </div>
                            </div>,
                            document.body
                        )}

                        {/* Expanded view: full split overlay */}
                        {isExpanded && createPortal(
                            <div
                                className="fixed inset-0 z-[1000] flex items-center justify-center"
                                onMouseDown={(e) => { if (e.target === e.currentTarget) setIsExpanded(false); }}
                            >
                                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                                <div className="relative z-10 w-[1100px] max-w-[96vw] h-[700px] max-h-[92vh] glass-dark rounded-2xl shadow-2xl shadow-black/60 ring-1 ring-white/15 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                    {/* Header */}
                                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
                                        <div className="flex items-center gap-3 text-xs font-medium">
                                            <span className="text-white/60">Markdown</span>
                                            <div className="w-px h-3 bg-white/15" />
                                            <span className="text-white/40">Preview</span>
                                        </div>
                                        <button
                                            onMouseDown={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                                            className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                        >
                                            <X size={15} />
                                        </button>
                                    </div>
                                    {/* Split panes */}
                                    <div className="flex flex-1 min-h-0">
                                        <textarea
                                            className="w-1/2 h-full bg-transparent outline-none resize-none text-white/90 placeholder-white/20 p-5 font-mono text-sm leading-relaxed"
                                            value={item.content}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const cursor = e.target.selectionStart ?? val.length;
                                                const before = val.slice(0, cursor);
                                                if (before.endsWith('[[') && allItems.length > 0) {
                                                    blockPickerTriggerPos.current = cursor - 2;
                                                    const ta = e.target;
                                                    const rect = ta.getBoundingClientRect();
                                                    setBlockPickerPos({ top: rect.top + rect.height / 2, left: rect.left + rect.width / 2 });
                                                } else if (blockPickerPos) {
                                                    setBlockPickerPos(null);
                                                }
                                                onUpdate(item.id, { content: val });
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Escape' && blockPickerPos) {
                                                    setBlockPickerPos(null);
                                                    return;
                                                }
                                                if (e.key === '@') {
                                                    e.preventDefault();
                                                    openingDatePicker.current = true;
                                                    handleDateClick();
                                                    setTimeout(() => { openingDatePicker.current = false; }, 300);
                                                }
                                            }}
                                            placeholder="Type something in Markdown..."
                                            spellCheck={false}
                                            autoFocus
                                        />
                                        <div className="w-px bg-white/10 shrink-0" />
                                        <div className="w-1/2 h-full p-5 overflow-y-auto text-sm text-white/90">
                                            {item.content
                                                ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={makeMdComponents(onNavigateToBlock)}>{item.content}</ReactMarkdown>
                                                : <span className="text-white/20 italic text-xs">Preview will appear here...</span>
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>,
                            document.body
                        )}
                    </>
                );

            case 'image':
                return imageSrc ? (
                    <img
                        src={imageSrc}
                        alt="Canvas item"
                        className={`w-full h-full rounded-sm pointer-events-none ${item.metadata?.naturalSize ? 'object-contain' : 'object-cover'}`}
                        onLoad={(e) => {
                            if (item.metadata?.naturalSize) {
                                const img = e.currentTarget;
                                const nw = img.naturalWidth;
                                const nh = img.naturalHeight;
                                if (nw > 0 && nh > 0) {
                                    const maxW = Math.min(nw, 900);
                                    const scale = maxW / nw;
                                    onUpdate(item.id, { width: Math.round(nw * scale), height: Math.round(nh * scale) });
                                }
                            }
                        }}
                    />
                ) : (
                    <div className="w-full h-full rounded-sm bg-white/5 animate-pulse" />
                );

            case 'link':
                return (
                    <div className="flex flex-col h-full bg-white/5 rounded-lg border border-white/10 overflow-hidden group/link">
                        {item.metadata?.image && (
                            <div className="relative w-full h-32 overflow-hidden border-b border-white/5">
                                <img
                                    src={item.metadata.image}
                                    alt={item.metadata.title}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover/link:scale-105"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            </div>
                        )}
                        <div className="flex flex-col gap-2 p-3 flex-1 min-h-0">
                            <div className="flex items-start justify-between gap-2">
                                <a
                                    href={item.content}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-bold text-white hover:text-sky-400 transition-colors line-clamp-2 flex-1 tracking-tight leading-snug"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {item.metadata?.title || item.content}
                                </a>
                                <a
                                    href={item.content}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 hover:bg-white/10 rounded-md transition-colors shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ExternalLink size={14} className="text-sky-400 group-hover/link:text-sky-300" />
                                </a>
                            </div>
                            {item.metadata?.description && (
                                <p className="text-[11px] text-white/40 line-clamp-3 leading-relaxed font-medium">
                                    {item.metadata.description}
                                </p>
                            )}
                            <div className="mt-auto pt-2 flex items-center gap-2 border-t border-white/5">
                                <div className="w-4 h-4 rounded bg-white/5 flex items-center justify-center overflow-hidden">
                                    <img
                                        src={`https://www.google.com/s2/favicons?domain=${new URL(item.content).hostname}&sz=32`}
                                        alt=""
                                        className="w-3 h-3 object-contain"
                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                    />
                                </div>
                                <span className="text-[10px] uppercase tracking-wider font-bold text-white/20 truncate">
                                    {new URL(item.content).hostname}
                                </span>
                            </div>
                        </div>
                    </div>
                );

            case 'canvas': {
                const children = item.children ?? [];
                return (
                    <div
                        className="w-full h-full flex flex-col cursor-pointer select-none"
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            onEnterCanvas?.(item.id);
                        }}
                    >
                        {/* Mini canvas preview */}
                        <div className="flex-1 relative bg-[#0a1120] canvas-bg overflow-hidden rounded-t-xl">
                            {children.length > 0 ? (() => {
                                // Show a zoomed viewport into the top-left portion of the canvas
                                const PAD = 16;
                                const FOOTER_H = 44;
                                const TOP_MARGIN = 20;
                                const previewW = currentWidth;
                                const previewH = currentHeight - FOOTER_H;
                                // Find top-left origin across all children
                                let minX = Infinity, minY = Infinity;
                                children.forEach(child => {
                                    if (child.x < minX) minX = child.x;
                                    if (child.y < minY) minY = child.y;
                                });
                                // Fixed viewport size in canvas coords — smaller = more zoomed in
                                const VIEWPORT_W = previewW * 1.2;
                                const VIEWPORT_H = (previewH - TOP_MARGIN) * 1.2;
                                const scale = Math.min(previewW / VIEWPORT_W, (previewH - TOP_MARGIN) / VIEWPORT_H);
                                return (
                                    <div className="absolute inset-0 overflow-hidden">
                                        <div style={{
                                            transform: `translate(${PAD * scale - minX * scale}px, ${(TOP_MARGIN + PAD * scale) - minY * scale}px) scale(${scale})`,
                                            transformOrigin: '0 0',
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                        }}>
                                            {children.map((child) => {
                                                const w = child.width ?? (child.type === 'text' ? 180 : child.type === 'canvas' ? 160 : 200);
                                                const h = child.height ?? (child.type === 'text' ? 80 : child.type === 'canvas' ? 120 : 90);
                                                return (
                                                    <div
                                                        key={child.id}
                                                        className="absolute rounded overflow-hidden"
                                                        style={{ left: child.x, top: child.y, width: w, height: h, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                    >
                                                        {child.type === 'text' && (
                                                            <div className="text-white/70 p-1.5 text-[13px] leading-snug font-sans overflow-hidden [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-sky-400 [&_h2]:text-[13px] [&_h2]:font-bold [&_h2]:text-sky-400/80 [&_h3]:text-[12px] [&_h3]:font-bold [&_h3]:text-sky-400/70 [&_strong]:font-bold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-3 [&_ol]:list-decimal [&_ol]:pl-3 [&_code]:text-sky-300 [&_code]:bg-white/10 [&_code]:px-0.5 [&_code]:rounded [&_a]:text-sky-400">
                                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{child.content}</ReactMarkdown>
                                                            </div>
                                                        )}
                                                        {child.type === 'image' && (
                                                            <ChildImageThumb content={child.content} />
                                                        )}
                                                        {child.type === 'link' && (
                                                            <p className="text-amber-300/70 p-1.5 text-[13px] leading-snug truncate font-sans">
                                                                {child.metadata?.title || child.content}
                                                            </p>
                                                        )}
                                                        {child.type === 'canvas' && (
                                                            <p className="text-purple-300/70 p-1.5 text-[13px] leading-snug truncate font-sans flex items-center gap-1">
                                                                {child.content || 'Untitled Canvas'}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })() : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-white/15 text-xs font-medium">Empty</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-purple-500/0 group-hover:bg-purple-500/8 transition-colors duration-200 flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full text-white/70 text-xs font-medium">
                                    <ArrowRight size={12} />
                                    Double-click to enter
                                </div>
                            </div>
                        </div>

                        {/* Canvas footer */}
                        <div className="shrink-0 px-3 py-2 border-t border-white/10 flex items-center justify-between gap-2 bg-purple-950/20 rounded-b-xl">
                            {isRenaming ? (
                                <input
                                    ref={renameInputRef}
                                    className="flex-1 bg-transparent outline-none text-sm font-semibold text-white/90 min-w-0"
                                    defaultValue={item.content}
                                    onBlur={(e) => {
                                        onUpdate(item.id, { content: e.target.value || 'Untitled Canvas' });
                                        setIsRenaming(false);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === 'Escape') {
                                            onUpdate(item.id, { content: (e.target as HTMLInputElement).value || 'Untitled Canvas' });
                                            setIsRenaming(false);
                                        }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <span className="flex-1 text-sm font-semibold text-white/80 truncate flex items-center gap-2">
                                    <Layers size={13} className="text-purple-400 shrink-0" />
                                    {item.content || 'Untitled Canvas'}
                                </span>
                            )}
                            {children.length > 0 && (
                                <span className="text-[10px] text-purple-400/60 shrink-0 font-medium">
                                    {children.length} item{children.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    </div>
                );
            }

            default:
                return null;
        }
    };

    return (
        <motion.div
            ref={cardRef}
            drag={!isEditing && !isResizing && !isRenaming}
            dragMomentum={false}
            dragElastic={0}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            initial={false}
            style={{
                position: 'absolute',
                left: 0,
                top: 0,
                x: motionX,
                y: motionY,
                width: currentWidth,
                height: currentHeight,
                zIndex: isResizing || isHovered ? 10 : 1,
            }}
            onMouseEnter={() => {
                if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current);
                setIsHovered(true);
            }}
            onMouseLeave={() => {
                hoverLeaveTimer.current = setTimeout(() => setIsHovered(false), 300);
            }}
            className="group relative"
        >
            <div
                className={`
                relative w-full h-full glass rounded-xl overflow-visible transition-all duration-200
                ${isAlerting ? 'timer-alert' : ''}
                ${isHighlighted ? 'search-highlight' : ''}
                ${isHovered
                    ? item.type === 'canvas'
                        ? 'ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/10'
                        : dateStatus === 'past-old'
                        ? 'ring-2 ring-red-500/60 shadow-lg shadow-red-500/15'
                        : 'ring-2 ring-sky-500/50 shadow-lg shadow-sky-500/10'
                    : dateStatus === 'past-old'
                    ? 'ring-2 ring-red-500/40 shadow-md shadow-red-500/10'
                    : 'ring-1 ring-white/10'
                }
            `}
            >
                {/* Priority accent strip */}
                {priorityCfg && item.type !== 'canvas' && (
                    <div
                        className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full z-20 ${priorityCfg.dot}`}
                        style={{ opacity: item.priority === 'very-low' ? 0.4 : 0.85 }}
                    />
                )}

                {/* Toolbar */}
                {isHovered && !isResizing && (
                    <div className="absolute -top-10 left-0 flex items-center gap-1 p-1 glass rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2">
                        <div className="p-1.5 cursor-grab active:cursor-grabbing text-white/40 hover:text-white transition-colors">
                            <GripVertical size={16} />
                        </div>
                        <div className="w-[1px] h-4 bg-white/10" />

                        {item.type === 'text' && (
                            <>
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className={`p-1.5 transition-colors ${isEditing ? 'text-sky-400 hover:text-sky-300' : 'text-white/40 hover:text-sky-400'}`}
                                    title="Edit"
                                >
                                    <Edit3 size={16} />
                                </button>
                                <button
                                    onClick={() => { setIsEditing(false); setIsExpanded(true); }}
                                    className={`p-1.5 transition-colors ${isExpanded ? 'text-sky-400 hover:text-sky-300' : 'text-white/40 hover:text-sky-400'}`}
                                    title="Expanded view"
                                >
                                    <Maximize2 size={16} />
                                </button>
                            </>
                        )}

                        {item.type === 'canvas' && (
                            <>
                                <button
                                    onClick={() => setIsRenaming(true)}
                                    className="p-1.5 text-white/40 hover:text-purple-400 transition-colors"
                                    title="Rename canvas"
                                >
                                    <Edit3 size={16} />
                                </button>
                                <button
                                    onClick={() => onEnterCanvas?.(item.id)}
                                    className="p-1.5 text-white/40 hover:text-purple-400 transition-colors"
                                    title="Enter canvas"
                                >
                                    <ArrowRight size={16} />
                                </button>
                            </>
                        )}

                        {item.type === 'image' && (
                            <button
                                onClick={() => onUpdate(item.id, { metadata: { ...item.metadata, naturalSize: !item.metadata?.naturalSize } })}
                                className={`p-1.5 transition-colors ${item.metadata?.naturalSize ? 'text-sky-400 hover:text-sky-300' : 'text-white/40 hover:text-sky-400'}`}
                                title={item.metadata?.naturalSize ? 'Natural size (on) — click to fit card' : 'Show at natural dimensions'}
                            >
                                <ScanSearch size={16} />
                            </button>
                        )}

                        {item.type !== 'canvas' && (<>
                        <div className="w-[1px] h-4 bg-white/10" />

                        {/* Date picker button */}
                        <button
                            onClick={handleDateClick}
                            className={`p-1.5 transition-colors relative ${
                                item.date
                                    ? dateStatus === 'today'
                                        ? 'text-green-400 hover:text-green-300'
                                        : dateStatus === 'past-old' || dateStatus === 'past-week'
                                        ? 'text-red-400 hover:text-red-300'
                                        : 'text-sky-400 hover:text-sky-300'
                                    : 'text-white/40 hover:text-sky-400'
                            }`}
                            title={item.date ? `Date: ${item.date}${item.time ? ` ${item.time}` : ''} — click to change` : 'Add date'}
                        >
                            <Calendar size={16} />
                        </button>
                        {item.date && (
                            <>
                                <button
                                    onClick={handleTimeClick}
                                    className={`p-1.5 transition-colors ${item.time ? 'text-sky-400 hover:text-sky-300' : 'text-white/25 hover:text-sky-400'}`}
                                    title={item.time ? `Time: ${item.time} — click to change` : 'Add time'}
                                >
                                    <Clock size={13} />
                                </button>
                                {item.time && (
                                    <>
                                        <button
                                            onClick={() => onUpdate(item.id, { time: undefined, duration: undefined, recurring: undefined })}
                                            className="p-1.5 text-white/20 hover:text-red-400 transition-colors -ml-1"
                                            title="Remove time"
                                        >
                                            <X size={11} />
                                        </button>
                                        {/* Duration picker */}
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowDuration(v => !v)}
                                                className={`p-1.5 transition-colors flex items-center gap-0.5 text-[10px] font-mono ${item.duration ? 'text-violet-400 hover:text-violet-300' : 'text-white/25 hover:text-sky-400'}`}
                                                title={item.duration ? `Duration: ${formatBlockDuration(item.duration)} — click to change` : 'Add duration'}
                                            >
                                                {item.duration ? formatBlockDuration(item.duration) : <><ArrowRight size={11} className="rotate-90" /><span className="sr-only">duration</span></>}
                                            </button>
                                            {showDuration && (
                                                <div
                                                    className="absolute top-full left-0 mt-1 z-[200] min-w-[120px] rounded-xl shadow-2xl shadow-black/60 ring-1 ring-white/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-100"
                                                    style={{ background: 'rgba(8, 12, 24, 0.98)', backdropFilter: 'blur(20px)' }}
                                                >
                                                    <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/30 border-b border-white/8">Duration</div>
                                                    {DURATION_PRESETS.map(({ label, minutes }) => (
                                                        <button
                                                            key={minutes}
                                                            onClick={() => { onUpdate(item.id, { duration: item.duration === minutes ? undefined : minutes }); setShowDuration(false); }}
                                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-white/8 transition-colors ${item.duration === minutes ? 'text-violet-400 font-semibold' : 'text-white/60'}`}
                                                        >
                                                            {label}
                                                        </button>
                                                    ))}
                                                    {item.duration && (
                                                        <>
                                                            <div className="border-t border-white/8 mx-2" />
                                                            <button
                                                                onClick={() => { onUpdate(item.id, { duration: undefined }); setShowDuration(false); }}
                                                                className="w-full text-left px-3 py-2 text-xs text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors"
                                                            >
                                                                Clear
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {/* Recurring picker — only when time + duration set */}
                                        {item.duration && (
                                            <div className="relative">
                                                <button
                                                    onClick={() => setShowRecurring(v => !v)}
                                                    className={`p-1.5 transition-colors text-[10px] font-bold ${item.recurring ? 'text-amber-400 hover:text-amber-300' : 'text-white/25 hover:text-sky-400'}`}
                                                    title={item.recurring ? `Repeats ${item.recurring} — click to change` : 'Set recurrence'}
                                                >
                                                    ↻
                                                </button>
                                                {showRecurring && (
                                                    <div
                                                        className="absolute top-full left-0 mt-1 z-[200] min-w-[130px] rounded-xl shadow-2xl shadow-black/60 ring-1 ring-white/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-100"
                                                        style={{ background: 'rgba(8, 12, 24, 0.98)', backdropFilter: 'blur(20px)' }}
                                                    >
                                                        <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/30 border-b border-white/8">Repeat</div>
                                                        {RECURRING_OPTIONS.map(({ value, label }) => (
                                                            <button
                                                                key={value}
                                                                onClick={() => { onUpdate(item.id, { recurring: item.recurring === value ? undefined : value }); setShowRecurring(false); }}
                                                                className={`w-full text-left px-3 py-2 text-xs hover:bg-white/8 transition-colors flex items-center gap-2 ${item.recurring === value ? 'text-amber-400 font-semibold' : 'text-white/60'}`}
                                                            >
                                                                <span className="text-sm leading-none">↻</span>
                                                                {label}
                                                            </button>
                                                        ))}
                                                        {item.recurring && (
                                                            <>
                                                                <div className="border-t border-white/8 mx-2" />
                                                                <button
                                                                    onClick={() => { onUpdate(item.id, { recurring: undefined }); setShowRecurring(false); }}
                                                                    className="w-full text-left px-3 py-2 text-xs text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors"
                                                                >
                                                                    Clear
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                                <button
                                    onClick={() => onUpdate(item.id, { date: undefined, time: undefined, duration: undefined, recurring: undefined })}
                                    className="p-1.5 text-white/25 hover:text-red-400 transition-colors"
                                    title="Remove date"
                                >
                                    <X size={13} />
                                </button>
                            </>
                        )}
                        <input
                            ref={dateInputRef}
                            type="date"
                            className="absolute opacity-0 w-0 h-0 pointer-events-none overflow-hidden"
                            value={item.date || ''}
                            onChange={(e) => onUpdate(item.id, { date: e.target.value || undefined })}
                        />
                        <input
                            ref={timeInputRef}
                            type="time"
                            className="absolute opacity-0 w-0 h-0 pointer-events-none overflow-hidden"
                            value={item.time || ''}
                            onChange={(e) => onUpdate(item.id, { time: e.target.value || undefined })}
                        />

                        <div className="w-[1px] h-4 bg-white/10" />

                        {/* Priority picker */}
                        <div className="relative">
                            <button
                                onClick={() => setShowPriority((v) => !v)}
                                className={`p-1.5 transition-colors flex items-center gap-0.5 ${item.priority ? priorityCfg!.color : 'text-white/40 hover:text-sky-400'}`}
                                title={item.priority ? `Priority: ${priorityCfg!.label}` : 'Set priority'}
                            >
                                <Flag size={15} />
                            </button>
                            {showPriority && (
                                <div
                                    className="absolute top-full left-0 mt-1 z-[200] min-w-[130px] rounded-xl shadow-2xl shadow-black/60 ring-1 ring-white/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-100"
                                    style={{ background: 'rgba(8, 12, 24, 0.98)', backdropFilter: 'blur(20px)' }}
                                >
                                    <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/30 border-b border-white/8">Priority</div>
                                    {(Object.entries(PRIORITY_CONFIG) as [Priority, typeof PRIORITY_CONFIG[Priority]][]).map(([key, cfg]) => (
                                        <button
                                            key={key}
                                            onClick={() => { onUpdate(item.id, { priority: item.priority === key ? undefined : key }); setShowPriority(false); }}
                                            className={`w-full text-left px-3 py-2 text-xs hover:bg-white/8 transition-colors flex items-center gap-2 ${item.priority === key ? cfg.color + ' font-semibold' : 'text-white/60'}`}
                                        >
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                                            {cfg.label}
                                        </button>
                                    ))}
                                    {item.priority && (
                                        <>
                                            <div className="border-t border-white/8 mx-2" />
                                            <button
                                                onClick={() => { onUpdate(item.id, { priority: undefined }); setShowPriority(false); }}
                                                className="w-full text-left px-3 py-2 text-xs text-white/30 hover:text-red-400 hover:bg-white/5 transition-colors"
                                            >
                                                Clear
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        </>)}

                        <div className="w-[1px] h-4 bg-white/10" />

                        {/* Eject to parent */}
                        {canEject && (
                            <button
                                onClick={onEject}
                                className="p-1.5 text-white/40 hover:text-sky-400 transition-colors"
                                title="Move out to parent canvas"
                            >
                                <ArrowUpLeft size={16} />
                            </button>
                        )}

                        {/* Move into a sibling canvas */}
                        {moveTargets && moveTargets.length > 0 && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowMoveInto((v) => !v)}
                                    className={`p-1.5 transition-colors flex items-center gap-0.5 ${showMoveInto ? 'text-purple-400' : 'text-white/40 hover:text-purple-400'}`}
                                    title="Move into a canvas"
                                >
                                    <LogIn size={16} />
                                    <ChevronDown size={10} />
                                </button>
                                {showMoveInto && (
                                    <div className="absolute top-full left-0 mt-1 z-[200] min-w-[140px] rounded-xl shadow-2xl shadow-black/60 ring-1 ring-white/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-100"
                                        style={{ background: 'rgba(8, 12, 24, 0.98)', backdropFilter: 'blur(20px)' }}>
                                        <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/30 border-b border-white/8">Move into</div>
                                        {moveTargets.map((t) => (
                                            <button
                                                key={t.id}
                                                onClick={() => { onMoveInto?.(t.id); setShowMoveInto(false); }}
                                                className="w-full text-left px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-purple-500/15 transition-colors flex items-center gap-2"
                                            >
                                                <Layers size={11} className="text-purple-400 shrink-0" />
                                                <span className="truncate">{t.content || 'Untitled Canvas'}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Timer button — non-canvas blocks only */}
                        {item.type !== 'canvas' && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleTimer?.(item.id); }}
                                className={`p-1.5 transition-colors ${
                                    item.timer?.isRunning
                                        ? 'text-emerald-400 hover:text-emerald-300'
                                        : item.timer && item.timer.totalElapsed > 0
                                        ? 'text-white/50 hover:text-emerald-400'
                                        : 'text-white/40 hover:text-emerald-400'
                                }`}
                                title={item.timer?.isRunning ? 'Pause timer' : item.timer && item.timer.totalElapsed > 0 ? 'Resume timer' : 'Start timer'}
                            >
                                {item.timer?.isRunning ? <Pause size={16} /> : <Play size={16} />}
                            </button>
                        )}

                        {/* History audit log button */}
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={`p-1.5 transition-colors ${showHistory ? 'text-purple-400 hover:text-purple-300' : 'text-white/40 hover:text-purple-400'}`}
                            title="Audit history"
                        >
                            <History size={16} />
                        </button>

                        <div className="w-[1px] h-4 bg-white/10" />

                        {onArchive && (
                            <button
                                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onArchive(); }}
                                className="p-1.5 text-white/40 hover:text-amber-400 transition-colors"
                                title="Move to Archives"
                            >
                                <Archive size={16} />
                            </button>
                        )}

                        <button
                            onClick={() => onRemove(item.id)}
                            className="p-1.5 text-white/40 hover:text-red-400 transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}

                {/* Date overlay badge — top right of block */}
                {item.date && dateLabel && item.type !== 'canvas' && (
                    <div
                        className={`
                            absolute -top-3 right-3 z-30 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide pointer-events-none select-none
                            ${dateStatus === 'today'
                                ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30 shadow-sm shadow-green-500/20'
                                : dateStatus === 'past-old' || dateStatus === 'past-week'
                                ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/25 shadow-sm shadow-red-500/15'
                                : 'bg-white/8 text-white/55 ring-1 ring-white/15'
                            }
                        `}
                    >
                        {item.recurring && <span className="mr-1 opacity-60">↻</span>}{dateLabel}{item.time && <span className="ml-1 opacity-70">{item.time}{item.duration && <>–{addMinutesToTime(item.time, item.duration)}</>}</span>}
                    </div>
                )}

                <div className="w-full h-full overflow-hidden rounded-xl">
                    {renderContent()}
                </div>

                {/* Tags strip — visible when tags exist or card is hovered */}
                {(!!item.tags?.length || isHovered || isAddingTag) && (
                    <div
                        className="absolute left-0 right-0 z-20 flex flex-wrap items-center gap-1 px-2.5 py-1.5 rounded-b-xl"
                        style={{ bottom: item.type === 'canvas' ? 40 : 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {/* Existing tags — show × on hover */}
                        {(item.tags ?? []).map((tag) => (
                            <span
                                key={tag}
                                className="group/tag inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold rounded-full bg-sky-500/15 text-sky-400/80 border border-sky-500/20 shrink-0 leading-none"
                            >
                                #{tag}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdateTags?.(item.id, (item.tags ?? []).filter((t) => t !== tag));
                                    }}
                                    className="opacity-0 group-hover/tag:opacity-100 transition-opacity ml-0.5 hover:text-red-400"
                                    title="Remove tag"
                                >
                                    <X size={8} />
                                </button>
                            </span>
                        ))}

                        {/* Tag input */}
                        {isAddingTag ? (
                            <div className="relative flex items-center">
                                <Hash size={9} className="absolute left-1.5 text-sky-400/60 pointer-events-none" />
                                <input
                                    ref={tagInputRef}
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
                                    onKeyDown={(e) => {
                                        if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                                            e.preventDefault();
                                            const t = tagInput.trim().replace(/^#/, '');
                                            if (t && !(item.tags ?? []).includes(t)) {
                                                onUpdateTags?.(item.id, [...(item.tags ?? []), t]);
                                            }
                                            setTagInput('');
                                            setShowTagSuggestions(false);
                                        } else if (e.key === 'Escape') {
                                            setIsAddingTag(false);
                                            setTagInput('');
                                            setShowTagSuggestions(false);
                                        }
                                    }}
                                    onBlur={() => setTimeout(() => { setIsAddingTag(false); setTagInput(''); setShowTagSuggestions(false); }, 150)}
                                    placeholder="tag…"
                                    className="pl-4 pr-1.5 py-0.5 w-20 text-[9px] bg-sky-500/10 border border-sky-500/30 rounded-full text-sky-300 placeholder-sky-400/40 focus:outline-none focus:border-sky-400/60"
                                />
                                {/* Suggestions dropdown */}
                                {showTagSuggestions && tagInput.length >= 1 && (() => {
                                    const sugg = tagMaster.filter(
                                        (t) => t.toLowerCase().includes(tagInput.toLowerCase()) && !(item.tags ?? []).includes(t)
                                    ).slice(0, 6);
                                    if (!sugg.length) return null;
                                    return (
                                        <ul className="absolute top-full left-0 mt-1 z-50 rounded-xl overflow-hidden shadow-xl border border-white/10 min-w-[120px]"
                                            style={{ background: 'rgba(8,14,26,0.97)', backdropFilter: 'blur(20px)' }}>
                                            {sugg.map((s) => (
                                                <li key={s}>
                                                    <button
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            if (!(item.tags ?? []).includes(s)) {
                                                                onUpdateTags?.(item.id, [...(item.tags ?? []), s]);
                                                            }
                                                            setTagInput('');
                                                            setShowTagSuggestions(false);
                                                            setTimeout(() => tagInputRef.current?.focus(), 0);
                                                        }}
                                                        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[11px] text-white/60 hover:text-sky-400 hover:bg-white/5 transition-colors"
                                                    >
                                                        <Hash size={10} className="text-white/30 shrink-0" />
                                                        {s}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    );
                                })()}
                            </div>
                        ) : (
                            /* + button — only when hovered */
                            isHovered && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsAddingTag(true); setTimeout(() => tagInputRef.current?.focus(), 50); }}
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold rounded-full bg-white/5 text-white/30 border border-white/10 hover:bg-sky-500/15 hover:text-sky-400 hover:border-sky-500/25 transition-colors shrink-0 leading-none"
                                    title="Add tag"
                                >
                                    <Plus size={8} />
                                    tag
                                </button>
                            )
                        )}
                    </div>
                )}


                {/* Resize handle */}
                {isHovered && (
                    <div
                        className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-50 flex items-end justify-end p-1"
                        onPointerDown={handleResizePointerDown}
                    >
                        <div className="w-3 h-3 border-r-2 border-b-2 border-white/40 rounded-br-sm" />
                    </div>
                )}
            </div>

            {/* History & Timer section — floats below the card */}
            {(showHistory || (item.timer && (item.timer.isRunning || item.timer.totalElapsed > 0))) && (
                <div
                    className="group/timer absolute left-2 right-2 z-30 flex flex-col gap-1"
                    style={{ top: currentHeight + 6 }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {/* Row 1: badge + controls */}
                    {item.timer && (item.timer.isRunning || item.timer.totalElapsed > 0) && (
                        <div className="flex items-center gap-1">
                            {/* Today elapsed badge (or total if no sessions data) */}
                            <div
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono font-bold tabular-nums ${
                                    item.timer.isRunning
                                        ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                                        : 'bg-black/40 text-white/40 ring-1 ring-white/10'
                                }`}
                                style={{ backdropFilter: 'blur(8px)' }}
                            >
                                {item.timer.isRunning && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                )}
                                {item.timer.sessions
                                    ? formatSeconds(getTodayElapsed(item.timer))
                                    : formatTimerElapsed(item.timer)
                                }
                            </div>
                            {/* Past days total — shown only when sessions exist and there's past time */}
                            {item.timer.sessions && getPastElapsed(item.timer) > 0 && (
                                <div
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono tabular-nums bg-black/30 text-white/25 ring-1 ring-white/8"
                                    style={{ backdropFilter: 'blur(8px)' }}
                                    title="Total time from previous days"
                                >
                                    <span className="text-[8px] font-sans font-medium text-white/20 mr-0.5">efforts</span>
                                    {formatSeconds(getPastElapsed(item.timer))}
                                </div>
                            )}

                        {/* Controls + Log button — fade in on hover */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/timer:opacity-100 transition-opacity duration-150">
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleTimer?.(item.id); }}
                                className="p-1 rounded-lg bg-black/40 ring-1 ring-white/10 hover:bg-white/15 transition-colors"
                                style={{ backdropFilter: 'blur(8px)' }}
                                title={item.timer.isRunning ? 'Pause' : 'Resume'}
                            >
                                {item.timer.isRunning
                                    ? <Pause size={10} className="text-emerald-400" />
                                    : <Play size={10} className="text-white/50" />
                                }
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onStopTimer?.(item.id); }}
                                className="p-1 rounded-lg bg-black/40 ring-1 ring-white/10 hover:bg-red-500/20 transition-colors"
                                style={{ backdropFilter: 'blur(8px)' }}
                                title="Stop"
                            >
                                <Square size={10} className="text-white/30 hover:text-red-400" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsLogging((v) => !v); setTimeout(() => logInputRef.current?.focus(), 50); }}
                                className={`p-1 rounded-lg ring-1 transition-colors ${isLogging ? 'bg-sky-500/20 ring-sky-500/30 text-sky-400' : 'bg-black/40 ring-white/10 hover:bg-sky-500/15 text-white/40 hover:text-sky-400'}`}
                                style={{ backdropFilter: 'blur(8px)' }}
                                title="Log action"
                            >
                                <ListPlus size={10} />
                            </button>
                        </div>
                    </div>
                    )}
                    {/* Inline log input */}
                    {isLogging && (
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                if (logText.trim()) {
                                    onLogAction?.(item.id, logText);
                                    setLogText('');
                                }
                                setIsLogging(false);
                            }}
                            className="flex gap-1"
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <input
                                ref={logInputRef}
                                type="text"
                                value={logText}
                                onChange={(e) => setLogText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Escape') { setIsLogging(false); setLogText(''); } }}
                                placeholder="What did you complete…"
                                className="flex-1 text-[11px] px-2 py-1 rounded-lg bg-black/50 ring-1 ring-white/15 text-white/80 placeholder-white/25 focus:outline-none focus:ring-sky-500/40"
                                style={{ backdropFilter: 'blur(8px)' }}
                            />
                            <button
                                type="submit"
                                className="px-2 py-1 text-[10px] font-bold rounded-lg bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30 hover:bg-sky-500/30 transition-colors shrink-0"
                            >
                                Log
                            </button>
                        </form>
                    )}

                    {/* Action log list */}
                    {(item.actions?.length ?? 0) > 0 && (
                        <div
                            className="flex flex-col gap-0.5 px-1 pb-1"
                            style={{ backdropFilter: 'blur(8px)' }}
                        >
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowManualLogs((v) => !v); }}
                                className="flex items-center gap-1 px-1 py-1 w-full text-left hover:bg-white/5 rounded transition-colors"
                            >
                                <span className="text-[8px] font-bold uppercase tracking-wider text-white/20">Manual Logs</span>
                                <span className="text-[8px] text-white/15 ml-0.5">({item.actions!.length})</span>
                                <ChevronDown size={8} className={`ml-auto text-white/20 transition-transform ${showManualLogs ? '' : '-rotate-90'}`} />
                            </button>
                            {showManualLogs && item.actions!.map((action: CanvasAction) => (
                                <div
                                    key={action.id}
                                    className="group/action flex items-center gap-1.5 py-0.5"
                                >
                                    <Clock size={9} className="text-white/20 shrink-0" />
                                    <span className="flex-1 text-[10px] text-white/55 truncate leading-none">{action.label}</span>
                                    <span className="font-mono text-[9px] text-white/25 shrink-0">{formatDuration(action.duration)}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteAction?.(item.id, action.id); }}
                                        className="opacity-0 group-hover/action:opacity-100 p-0.5 rounded hover:bg-red-500/20 transition-all"
                                        title="Remove"
                                    >
                                        <X size={9} className="text-white/30 hover:text-red-400" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* History audit log list */}
                    {showHistory && (() => {
                        const historyEntries = [...(item.history ?? [])].reverse();
                        const groupedByMonth = historyEntries.reduce((acc: Record<string, CanvasHistoryEntry[]>, entry) => {
                            const date = new Date(entry.timestamp);
                            const key = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
                            if (!acc[key]) acc[key] = [];
                            acc[key].push(entry);
                            return acc;
                        }, {});

                        return (
                            <div
                                className="flex flex-col gap-1 px-1 py-1.5 border-t border-white/5 mt-1"
                                style={{ backdropFilter: 'blur(8px)' }}
                            >
                                <div className="flex items-center justify-between px-1 mb-1">
                                    <span className="text-[8px] font-bold uppercase tracking-wider text-purple-400/60">Audit History Log</span>
                                    <button
                                        onClick={() => setShowHistory(false)}
                                        className="p-0.5 text-white/20 hover:text-white"
                                    >
                                        <X size={8} />
                                    </button>
                                </div>
                                <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                                    {historyEntries.length === 0 ? (
                                        <div className="px-2 py-3 text-center">
                                            <span className="text-[10px] text-white/20 italic tracking-tight">No audit data</span>
                                        </div>
                                    ) : (
                                        Object.entries(groupedByMonth)
                                            .sort((a, b) => {
                                                const [m1, y1] = a[0].split(' ');
                                                const [m2, y2] = b[0].split(' ');
                                                const d1 = new Date(`${m1} 1, ${y1}`).getTime();
                                                const d2 = new Date(`${m2} 1, ${y2}`).getTime();
                                                return d2 - d1;
                                            })
                                            .map(([monthYear, entries]) => {
                                            const isCollapsed = collapsedMonths.has(monthYear);
                                            return (
                                                <div key={monthYear} className="flex flex-col">
                                                    <button
                                                        onClick={() => {
                                                            const next = new Set(collapsedMonths);
                                                            if (isCollapsed) next.delete(monthYear);
                                                            else next.add(monthYear);
                                                            setCollapsedMonths(next);
                                                        }}
                                                        className="flex items-center gap-1.5 px-1 py-1 hover:bg-white/5 rounded transition-colors text-left"
                                                    >
                                                        <ChevronDown size={8} className={`text-white/20 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-tight">{monthYear}</span>
                                                        <span className="text-[8px] text-white/15 font-medium">({entries.length})</span>
                                                    </button>
                                                    
                                                    {!isCollapsed && (
                                                        <div className="flex flex-col gap-0.5 pl-2 mt-0.5 border-l border-white/5 ml-1.5">
                                                            {entries.map((entry) => {
                                                                const Icon = entry.type === 'tag' ? Hash
                                                                    : entry.type === 'date' ? Calendar
                                                                    : entry.type === 'navigation' ? Move
                                                                    : entry.type === 'content' ? Edit3
                                                                    : entry.type === 'geometry' ? Maximize2
                                                                    : entry.type === 'timer' ? Clock
                                                                    : History;
                                                                const d = new Date(entry.timestamp);
                                                                return (
                                                                    <div key={entry.id} className="flex items-start gap-1.5 px-1 py-0.5 hover:bg-white/5 rounded transition-colors group/h">
                                                                        <div className="flex items-center gap-1 font-mono text-[7px] text-white/20 shrink-0 mt-0.5">
                                                                            <span>{d.getDate()}/{d.getMonth() + 1}</span>
                                                                            <span className="opacity-50">{d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
                                                                        </div>
                                                                        <Icon size={8} className="mt-1 text-white/25 shrink-0 group-hover/h:text-purple-400/50 transition-colors" />
                                                                        <div className="flex-1 min-w-0 flex flex-col pt-0.5">
                                                                            <span className="text-[9px] text-white/45 leading-tight truncate">{entry.action}</span>
                                                                            {entry.snapshot && (
                                                                                <span className="text-[8px] text-white/20 mt-0.5 italic line-clamp-2 leading-tight">"{entry.snapshot}"</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </motion.div>
    );
};


