'use client';

import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue } from 'framer-motion';
import { CanvasItem as ICanvasItem } from '@/types/canvas';
import { Trash2, ExternalLink, GripVertical, Edit3, ArrowRight, ArrowUpLeft, LogIn, Layers, X, Maximize2, Eye, Calendar, ChevronDown, Flag } from 'lucide-react';
import { Priority } from '@/types/canvas';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getRelativeLabel, getDateStatus } from '@/utils/dateUtils';

interface Props {
    item: ICanvasItem;
    onUpdate: (id: string, updates: Partial<ICanvasItem>) => void;
    onRemove: (id: string) => void;
    onMove: (id: string, x: number, y: number) => void;
    onEnterCanvas?: (id: string) => void;
    // Move in/out of sub-canvases
    canEject?: boolean;
    onEject?: () => void;
    moveTargets?: ICanvasItem[]; // sibling canvas-type items to move into
    onMoveInto?: (targetCanvasId: string) => void;
}

const MIN_WIDTH = 150;
const MIN_HEIGHT = 80;


const MD_COMPONENTS = {
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
    a: ({ node, ...props }: any) => (
        <a className="text-sky-400 underline hover:text-sky-300 transition-colors" target="_blank" rel="noopener noreferrer" {...props} />
    ),
};

export const CanvasItem: React.FC<Props> = ({ item, onUpdate, onRemove, onMove, onEnterCanvas, canEject, onEject, moveTargets, onMoveInto }) => {
    const [isHovered, setIsHovered] = useState(false);
    const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [showMoveInto, setShowMoveInto] = useState(false);
    const [showPriority, setShowPriority] = useState(false);
    const [localSize, setLocalSize] = useState<{ width: number; height: number } | null>(null);
    const [previewPos, setPreviewPos] = useState<{ top: number; left: number } | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const dateInputRef = useRef<HTMLInputElement>(null);
    const isDragging = useRef(false);

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
            onUpdate(item.id, { width: newW, height: newH });
            setLocalSize(null);
            setIsResizing(false);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    };

    const defaultWidth =
        item.type === 'text' ? 240 : item.type === 'canvas' ? 320 : 300;
    const defaultHeight =
        item.type === 'text' ? 120 : item.type === 'link' ? 280 : item.type === 'canvas' ? 240 : 200;

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
                                onChange={(e) => onUpdate(item.id, { content: e.target.value })}
                                onBlur={() => setIsEditing(false)}
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
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{item.content}</ReactMarkdown>
                                      </div>
                                    : <span className="text-white/30 italic">Click to edit...</span>
                                }
                            </div>
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
                                        ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{item.content}</ReactMarkdown>
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
                                            onChange={(e) => onUpdate(item.id, { content: e.target.value })}
                                            placeholder="Type something in Markdown..."
                                            spellCheck={false}
                                            autoFocus
                                        />
                                        <div className="w-px bg-white/10 shrink-0" />
                                        <div className="w-1/2 h-full p-5 overflow-y-auto text-sm text-white/90">
                                            {item.content
                                                ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{item.content}</ReactMarkdown>
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
                return (
                    <img
                        src={item.content}
                        alt="Canvas item"
                        className="w-full h-full object-cover rounded-sm pointer-events-none"
                    />
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
                                                            <img src={child.content} alt="" className="w-full h-full object-cover opacity-70" />
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
                {priorityCfg && (
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
                            title={item.date ? `Date: ${item.date} — click to change` : 'Add date'}
                        >
                            <Calendar size={16} />
                        </button>
                        {item.date && (
                            <button
                                onClick={() => onUpdate(item.id, { date: undefined })}
                                className="p-1.5 text-white/25 hover:text-red-400 transition-colors"
                                title="Remove date"
                            >
                                <X size={13} />
                            </button>
                        )}
                        <input
                            ref={dateInputRef}
                            type="date"
                            className="absolute opacity-0 w-0 h-0 pointer-events-none overflow-hidden"
                            value={item.date || ''}
                            onChange={(e) => onUpdate(item.id, { date: e.target.value || undefined })}
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

                        <div className="w-[1px] h-4 bg-white/10" />

                        <button
                            onClick={() => onRemove(item.id)}
                            className="p-1.5 text-white/40 hover:text-red-400 transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}

                {/* Date overlay badge — top right of block */}
                {item.date && dateLabel && (
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
                        {dateLabel}
                    </div>
                )}

                <div className="w-full h-full overflow-hidden rounded-xl">
                    {renderContent()}
                </div>

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
        </motion.div>
    );
};
