'use client';

import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { CanvasItem as ICanvasItem } from '@/types/canvas';
import { Trash2, ExternalLink, GripVertical, Edit3, Check, ArrowRight, Layers } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
    item: ICanvasItem;
    onUpdate: (id: string, updates: Partial<ICanvasItem>) => void;
    onRemove: (id: string) => void;
    onMove: (id: string, x: number, y: number) => void;
    onEnterCanvas?: (id: string) => void;
}

const MIN_WIDTH = 150;
const MIN_HEIGHT = 80;

// Color dot per item type for the canvas preview
const TYPE_COLOR: Record<string, string> = {
    text: 'bg-sky-400',
    image: 'bg-emerald-400',
    link: 'bg-amber-400',
    canvas: 'bg-purple-400',
};

export const CanvasItem: React.FC<Props> = ({ item, onUpdate, onRemove, onMove, onEnterCanvas }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [localSize, setLocalSize] = useState<{ width: number; height: number } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);
    const isDragging = useRef(false);

    const motionX = useMotionValue(item.x);
    const motionY = useMotionValue(item.y);

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

    const renderContent = () => {
        switch (item.type) {
            case 'text':
                return isEditing ? (
                    <textarea
                        ref={textareaRef}
                        className="w-full h-full bg-transparent outline-none resize-none text-white placeholder-white/30 p-4 font-sans leading-relaxed"
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
                        {item.content ? (
                            <div className="text-sm max-w-none text-white/90">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        h1: ({ node, ...props }) => <h1 className="text-xl font-bold text-sky-400 mb-3 mt-4 first:mt-0" {...props} />,
                                        h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-sky-400/90 mb-2 mt-3" {...props} />,
                                        h3: ({ node, ...props }) => <h3 className="text-base font-bold text-sky-400/80 mb-2 mt-2" {...props} />,
                                        p: ({ node, ...props }) => <p className="leading-relaxed mb-3 last:mb-0" {...props} />,
                                        ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-3 space-y-1" {...props} />,
                                        ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-3 space-y-1" {...props} />,
                                        li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                                        blockquote: ({ node, ...props }) => (
                                            <blockquote className="border-l-4 border-sky-500/50 bg-white/5 py-2 px-4 my-3 rounded-r-lg italic text-white/70" {...props} />
                                        ),
                                        code: ({ node, ...props }) => (
                                            <code className="text-sky-300 bg-white/10 px-1.5 py-0.5 rounded text-[0.9em] font-mono" {...props} />
                                        ),
                                        a: ({ node, ...props }) => <a className="text-sky-400 underline hover:text-sky-300 transition-colors" target="_blank" rel="noopener noreferrer" {...props} />,
                                    }}
                                >
                                    {item.content}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            <span className="text-white/30 italic">Click to edit...</span>
                        )}
                    </div>
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
                            {children.length > 0 ? (
                                <div className="absolute inset-0 p-2 flex flex-wrap gap-1 content-start overflow-hidden">
                                    {children.slice(0, 30).map((child) => (
                                        <div
                                            key={child.id}
                                            className={`h-1.5 rounded-sm opacity-50 shrink-0 ${TYPE_COLOR[child.type] ?? 'bg-white/30'}`}
                                            style={{ width: child.type === 'text' ? 28 : child.type === 'canvas' ? 22 : 24 }}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-white/15 text-xs font-medium">Empty</span>
                                </div>
                            )}
                            {/* Hover overlay */}
                            <div className="absolute inset-0 bg-purple-500/0 group-hover:bg-purple-500/8 transition-colors duration-200 flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full text-white/70 text-xs font-medium">
                                    <ArrowRight size={12} />
                                    Double-click to enter
                                </div>
                            </div>
                        </div>

                        {/* Canvas footer — name + item count */}
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
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="group relative"
        >
            <div
                className={`
                relative w-full h-full glass rounded-xl overflow-visible transition-all duration-200
                ${isHovered
                    ? item.type === 'canvas'
                        ? 'ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/10'
                        : 'ring-2 ring-sky-500/50 shadow-lg shadow-sky-500/10'
                    : 'ring-1 ring-white/10'
                }
            `}
            >
                {/* Toolbar */}
                {isHovered && !isResizing && (
                    <div className="absolute -top-10 left-0 flex items-center gap-1 p-1 glass rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2">
                        <div className="p-1.5 cursor-grab active:cursor-grabbing text-white/40 hover:text-white transition-colors">
                            <GripVertical size={16} />
                        </div>
                        <div className="w-[1px] h-4 bg-white/10" />

                        {item.type === 'text' && (
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className={`p-1.5 transition-colors ${isEditing ? 'text-green-400 hover:text-green-300' : 'text-white/40 hover:text-sky-400'}`}
                                title={isEditing ? 'Save' : 'Edit'}
                            >
                                {isEditing ? <Check size={16} /> : <Edit3 size={16} />}
                            </button>
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

                        <button
                            onClick={() => onRemove(item.id)}
                            className="p-1.5 text-white/40 hover:text-red-400 transition-colors"
                        >
                            <Trash2 size={16} />
                        </button>
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
