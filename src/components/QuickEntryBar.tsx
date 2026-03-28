'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Hash, Play, Save, X, Layers, Calendar } from 'lucide-react';
import { getRelativeLabel } from '@/utils/dateUtils';
import { CanvasItem } from '@/types/canvas';

export interface SubCanvasSuggestion {
    id: string;
    name: string;
    path: string[];
    parentName?: string;
}

interface Props {
    onSave: (content: string, tags: string[], date?: string) => void;
    onAddToSubCanvas: (path: string[], content: string, tags: string[], date?: string) => void;
    onStartTimer: (content: string, tags: string[], date?: string) => void;
    subCanvases: SubCanvasSuggestion[];
    tagMaster: string[];
    onAddToTagMaster: (tag: string) => void;
}

/** Extract all #hashtag words from a string (deduped, without the #). */
function extractTags(text: string): string[] {
    const matches = text.match(/#([a-zA-Z0-9_]+)/g);
    return matches ? [...new Set(matches.map((m) => m.slice(1)))] : [];
}

/**
 * Return the partial tag word currently being typed after a #, relative to
 * the cursor position, or null if the cursor is not right after a #word.
 */
function getActiveTag(text: string, cursorPos: number): string | null {
    const before = text.slice(0, cursorPos);
    const match = before.match(/#([a-zA-Z0-9_]*)$/);
    return match ? match[1] : null;
}

export const QuickEntryBar: React.FC<Props> = ({
    onSave,
    onAddToSubCanvas,
    onStartTimer,
    subCanvases,
    tagMaster,
    onAddToTagMaster,
}) => {
    const [text, setText] = useState('');
    const [date, setDate] = useState<string | undefined>(undefined);
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    // Sub-canvas targeting: set when user has picked a canvas via >>
    const [targetCanvas, setTargetCanvas] = useState<SubCanvasSuggestion | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const dateInputRef = useRef<HTMLInputElement>(null);
    const openingDatePicker = useRef(false);

    // When >> is typed and no canvas is selected yet, filter sub-canvases by what follows >>
    const routingFilter = !targetCanvas && text.trimStart().startsWith('>>')
        ? text.trimStart().slice(2).trimStart().toLowerCase()
        : null;
    const canvasSuggestions = routingFilter !== null
        ? subCanvases.filter((c) => c.name.toLowerCase().includes(routingFilter)).slice(0, 8)
        : [];
    const showCanvasPicker = canvasSuggestions.length > 0 || (routingFilter !== null && subCanvases.length > 0);

    const selectTargetCanvas = (canvas: SubCanvasSuggestion) => {
        setTargetCanvas(canvas);
        setText('');
        setShowDropdown(false);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const clearTargetCanvas = () => {
        setTargetCanvas(null);
        setText('');
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const openDatePicker = () => {
        if (dateInputRef.current) {
            openingDatePicker.current = true;
            try { (dateInputRef.current as any).showPicker(); } catch { dateInputRef.current.click(); }
            setTimeout(() => { openingDatePicker.current = false; }, 300);
        }
    };

    const suggestions =
        activeTag !== null
            ? tagMaster
                  .filter(
                      (t) =>
                          t.toLowerCase().startsWith(activeTag.toLowerCase()) &&
                          !new RegExp(`#${t}(\\s|$)`).test(text)
                  )
                  .slice(0, 8)
            : [];

    const syncActiveTag = (value: string, cursor: number) => {
        const partial = getActiveTag(value, cursor);
        setActiveTag(partial);
        setShowDropdown(partial !== null);
    };

    const autoResize = () => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    };

    useEffect(() => { autoResize(); }, [text]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        const cursor = e.target.selectionStart ?? val.length;
        setText(val);
        syncActiveTag(val, cursor);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === '@') {
            e.preventDefault();
            openDatePicker();
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
            e.preventDefault();
            submit('save');
        }
        if (e.key === 'Escape') {
            setText('');
            setDate(undefined);
            setShowDropdown(false);
        }
    };

    const completeTag = (tag: string) => {
        const input: HTMLTextAreaElement | null = inputRef.current;
        if (!input) return;
        const cursor = input.selectionStart ?? text.length;
        const before = text.slice(0, cursor);
        const after = text.slice(cursor);
        const replaced = before.replace(/#([a-zA-Z0-9_]*)$/, `#${tag} `);
        const newText = replaced + after;
        setText(newText);
        setShowDropdown(false);
        setActiveTag(null);
        if (!tagMaster.includes(tag)) onAddToTagMaster(tag);
        // Restore focus
        setTimeout(() => {
            input.focus();
            const pos = replaced.length;
            input.setSelectionRange(pos, pos);
        }, 0);
    };

    const submit = (action: 'save' | 'timer') => {
        const trimmed = text.trim();
        if (!trimmed && !targetCanvas) return;
        const content = trimmed;
        if (!content) return;
        const tags = extractTags(content);
        tags.forEach((t) => {
            if (!tagMaster.includes(t)) onAddToTagMaster(t);
        });
        if (targetCanvas) {
            onAddToSubCanvas(targetCanvas.path, content, tags, date);
            setTargetCanvas(null);
        } else if (action === 'save') {
            onSave(content, tags, date);
        } else {
            onStartTimer(content, tags, date);
        }
        setText('');
        setDate(undefined);
        setShowDropdown(false);
        setActiveTag(null);
    };

    const hasText = text.trim().length > 0;
    const previewTags = extractTags(text);

    return (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4">
            <div className={`flex items-start gap-2 px-4 py-2 glass rounded-2xl shadow-2xl min-w-[600px] max-w-[860px] transition-all${targetCanvas ? ' ring-1 ring-violet-500/40' : ''}`}>
                {/* Target sub-canvas badge */}
                {targetCanvas && (
                    <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); clearTargetCanvas(); }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30 shrink-0 hover:bg-violet-500/30 transition-colors"
                        title="Clear target canvas"
                    >
                        <Layers size={10} />
                        {targetCanvas.name}
                        <X size={9} className="ml-0.5 opacity-60" />
                    </button>
                )}

                {/* Input */}
                <div className="relative flex-1">
                    <textarea
                        ref={inputRef}
                        rows={1}
                        value={text}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => {
                            const cursor = inputRef.current?.selectionStart ?? text.length;
                            syncActiveTag(text, cursor);
                        }}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                        onSelect={(e) => {
                            const cursor = (e.target as HTMLTextAreaElement).selectionStart ?? text.length;
                            syncActiveTag(text, cursor);
                        }}
                        placeholder={targetCanvas ? `Add to "${targetCanvas.name}"…` : 'What are you working on? Type >> to add to a sub-canvas'}
                        className="w-full bg-transparent text-white/90 placeholder-white/25 text-sm outline-none resize-none overflow-hidden leading-relaxed"
                    />

                    {/* Sub-canvas picker dropdown */}
                    {showCanvasPicker && (
                        <ul
                            className="absolute top-full left-0 mt-2 rounded-xl shadow-xl overflow-hidden min-w-[200px] z-50 border border-white/10"
                            style={{ background: 'rgba(8, 14, 26, 0.97)', backdropFilter: 'blur(20px)' }}
                        >
                            {canvasSuggestions.length > 0 ? canvasSuggestions.map((c) => (
                                <li key={c.id}>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => { e.preventDefault(); selectTargetCanvas(c); }}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/60 hover:text-violet-300 hover:bg-white/5 transition-colors"
                                    >
                                        <Layers size={11} className="text-violet-400/50 shrink-0" />
                                        <div className="flex flex-col items-start overflow-hidden">
                                            <span className="text-white/90">{c.name}</span>
                                            {c.parentName && (
                                                <span className="text-[10px] text-white/30 truncate w-full">
                                                    in {c.parentName}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                </li>
                            )) : (
                                <li className="px-3 py-2 text-xs text-white/30">No sub-canvases found</li>
                            )}
                        </ul>
                    )}

                    {/* Tag suggestion dropdown */}
                    {showDropdown && suggestions.length > 0 && !showCanvasPicker && (
                        <ul
                            className="absolute top-full left-0 mt-2 rounded-xl shadow-xl overflow-hidden min-w-[160px] z-50 border border-white/10"
                            style={{
                                background: 'rgba(8, 14, 26, 0.97)',
                                backdropFilter: 'blur(20px)',
                            }}
                        >
                            {suggestions.map((s) => (
                                <li key={s}>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            completeTag(s);
                                        }}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/60 hover:text-sky-400 hover:bg-white/5 transition-colors"
                                    >
                                        <Hash size={11} className="text-white/30 shrink-0" />
                                        {s}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Inline tag preview */}
                {previewTags.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                        {previewTags.slice(0, 3).map((t) => (
                            <span
                                key={t}
                                className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/20"
                            >
                                #{t}
                            </span>
                        ))}
                        {previewTags.length > 3 && (
                            <span className="text-[10px] text-white/30">+{previewTags.length - 3}</span>
                        )}
                    </div>
                )}

                {/* Date badge */}
                {date && (
                    <div className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/25 text-sky-400 text-[11px] font-medium">
                        <Calendar size={11} />
                        <span>{getRelativeLabel(date)}</span>
                        <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); setDate(undefined); inputRef.current?.focus(); }}
                            className="ml-0.5 text-sky-400/60 hover:text-sky-300"
                        >
                            <X size={10} />
                        </button>
                    </div>
                )}
                <input
                    ref={dateInputRef}
                    type="date"
                    className="absolute opacity-0 w-0 h-0 pointer-events-none overflow-hidden"
                    value={date || ''}
                    onChange={(e) => {
                        setDate(e.target.value || undefined);
                        setTimeout(() => inputRef.current?.focus(), 0);
                    }}
                />

                {/* Clear */}
                {hasText && (
                    <button
                        onClick={() => {
                            setText('');
                            setShowDropdown(false);
                            inputRef.current?.focus();
                        }}
                        className="p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0"
                        title="Clear"
                    >
                        <X size={13} className="text-white/30" />
                    </button>
                )}

                <div className="w-px h-5 bg-white/10 shrink-0" />

                {/* Save / Add button */}
                <button
                    onClick={() => submit('save')}
                    disabled={!hasText}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-25 disabled:cursor-not-allowed shrink-0 ${targetCanvas ? 'hover:bg-violet-500/15 text-violet-300' : 'hover:bg-sky-500/15 text-sky-400'}`}
                    title={targetCanvas ? `Add to "${targetCanvas.name}" (Enter)` : 'Save to canvas (Enter)'}
                >
                    {targetCanvas ? <Layers size={13} /> : <Save size={13} />}
                    {targetCanvas ? 'Add' : 'Save'}
                </button>

                {/* Start timer button — hidden in sub-canvas mode */}
                {!targetCanvas && (
                    <button
                        onClick={() => submit('timer')}
                        disabled={!hasText}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all disabled:opacity-25 disabled:cursor-not-allowed hover:bg-emerald-500/15 text-emerald-400 shrink-0"
                        title="Save and start timer"
                    >
                        <Play size={13} />
                        Timer
                    </button>
                )}
            </div>
        </div>
    );
};
