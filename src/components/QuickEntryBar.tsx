'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Hash, Play, Save, X, Layers, Calendar, Inbox, IndianRupee } from 'lucide-react';
import { getRelativeLabel } from '@/utils/dateUtils';
import { CanvasItem } from '@/types/canvas';
import { getItemsAtPath } from '@/hooks/useCanvas';

export interface SubCanvasSuggestion {
    id: string;
    name: string;
    path: string[];
    parentName?: string;
}

const AGE_FILTER_LABELS: Record<number, string> = {
    10: 'All',
    9: 'Today',
    8: 'Yesterday',
    7: 'This week',
    6: 'Last week',
    5: 'Prev. week',
    4: '2 wks prior',
    3: 'This month',
    2: 'Last month',
    1: 'Prev. month',
    0: 'Older',
};

interface Props {
    onSave: (content: string, tags: string[], date?: string) => void;
    onAddToSubCanvas: (path: string[], content: string, tags: string[], date?: string) => void;
    onAppendToBlock: (path: string[], id: string, appendText: string) => void;
    onStartTimer: (content: string, tags: string[], date?: string) => void;
    subCanvases: SubCanvasSuggestion[];
    tagMaster: string[];
    onAddToTagMaster: (tag: string) => void;
    allItems: CanvasItem[];
    hasInbox?: boolean;
    ageFilter?: number;
    onAgeFilterChange?: (value: number) => void;
    fundsNet?: number;
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
    onAppendToBlock,
    onStartTimer,
    subCanvases,
    tagMaster,
    onAddToTagMaster,
    allItems,
    hasInbox,
    ageFilter = 8,
    onAgeFilterChange,
    fundsNet,
}) => {
    const [text, setText] = useState('');
    const [date, setDate] = useState<string | undefined>(undefined);
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    // Sub-canvas targeting: set when user has picked a canvas via >>
    const [targetCanvas, setTargetCanvas] = useState<SubCanvasSuggestion | null>(null);
    // Block picker: shown when ^ is typed with a targetCanvas selected
    const [showBlockPicker, setShowBlockPicker] = useState(false);
    const [blockPickerFilter, setBlockPickerFilter] = useState('');
    const [selectedBlock, setSelectedBlock] = useState<CanvasItem | null>(null);
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
        setSelectedBlock(null);
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

    // Blocks in the targeted sub-canvas for ^ picker
    const targetBlocks = targetCanvas
        ? getItemsAtPath(allItems, targetCanvas.path)
              .filter((i) => i.type === 'text' && i.content.trim())
        : [];
    const blockSuggestions = showBlockPicker
        ? targetBlocks.filter((i) => {
              const first = i.content.trim().split('\n')[0].toLowerCase();
              return !blockPickerFilter || first.includes(blockPickerFilter.toLowerCase());
          }).slice(0, 8)
        : [];

    const selectBlock = (item: CanvasItem) => {
        const input = inputRef.current;
        if (!input) return;
        // Strip the trailing ^<filter> from the textarea — the note is shown as a badge
        const newText = text.replace(/\^[^\s]*$/, '').trimEnd();
        setText(newText);
        setSelectedBlock(item);
        setShowBlockPicker(false);
        setBlockPickerFilter('');
        setTimeout(() => { input.focus(); input.setSelectionRange(newText.length, newText.length); }, 0);
    };

    const clearSelectedBlock = () => {
        setSelectedBlock(null);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

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
        // ^ block picker: only active when a sub-canvas is targeted
        if (targetCanvas) {
            const before = val.slice(0, cursor);
            const caretMatch = before.match(/\^([^\s]*)$/);
            if (caretMatch) {
                setShowBlockPicker(true);
                setBlockPickerFilter(caretMatch[1]);
                return;
            }
        }
        setShowBlockPicker(false);
        setBlockPickerFilter('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === '@') {
            e.preventDefault();
            openDatePicker();
            return;
        }
        if (e.key === 'Escape') {
            if (showBlockPicker) {
                setShowBlockPicker(false);
                setBlockPickerFilter('');
                return;
            }
            if (selectedBlock) {
                setSelectedBlock(null);
                return;
            }
            setText('');
            setDate(undefined);
            setShowDropdown(false);
            return;
        }
        if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
            e.preventDefault();
            submit('save');
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
        const tags = extractTags(trimmed);
        // Strip #tags from the saved content
        const content = trimmed.replace(/#[a-zA-Z0-9_]+/g, '').replace(/\s{2,}/g, ' ').trim();
        tags.forEach((t) => { if (!tagMaster.includes(t)) onAddToTagMaster(t); });
        // If a block is selected via ^, append typed text to that existing block
        if (selectedBlock && targetCanvas) {
            if (!content) return;
            onAppendToBlock(targetCanvas.path, selectedBlock.id, content);
            setText('');
            setDate(undefined);
            setSelectedBlock(null);
            return;
        }
        if (!content) return;
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
        setSelectedBlock(null);
    };

    const hasText = text.trim().length > 0;
    const previewTags = extractTags(text);

    return (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4" title="Quickly add notes using Quick Entry Bar">
            <div className={`flex items-center gap-2 px-4 py-1 glass rounded-2xl shadow-2xl min-w-[900px] max-w-[1200px] transition-all${targetCanvas ? ' ring-1 ring-violet-500/40' : ''}`}>
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

                {/* Default Inbox indicator — shown when no specific canvas is targeted */}
                {!targetCanvas && hasInbox && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-sky-500/15 text-sky-400 border border-sky-500/25 shrink-0">
                        <Inbox size={10} />
                        Inbox
                    </div>
                )}

                {/* Selected block badge */}
                {selectedBlock && (
                    <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); clearSelectedBlock(); }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 hover:bg-amber-500/30 transition-colors max-w-[180px]"
                        title="Clear selected note"
                    >
                        <span className="font-bold opacity-70">^</span>
                        <span className="truncate">{selectedBlock.content.trim().split('\n')[0].slice(0, 30)}</span>
                        <X size={9} className="ml-0.5 opacity-60 shrink-0" />
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
                        onBlur={() => setTimeout(() => { setShowDropdown(false); setShowBlockPicker(false); }, 150)}
                        onSelect={(e) => {
                            const cursor = (e.target as HTMLTextAreaElement).selectionStart ?? text.length;
                            syncActiveTag(text, cursor);
                        }}
                        placeholder={targetCanvas ? `Add to "${targetCanvas.name}"…` : 'Type >> for sub-canvas and then ^ for block.'}
                        className="w-full bg-transparent text-white/90 placeholder-white/25 text-sm outline-none resize-none overflow-hidden leading-normal py-0.5"
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

                    {/* Block picker dropdown — shown when ^ is typed with a target sub-canvas */}
                    {showBlockPicker && (
                        <ul
                            className="absolute top-full left-0 mt-2 rounded-xl shadow-xl overflow-hidden min-w-[240px] z-50 border border-white/10"
                            style={{ background: 'rgba(8, 14, 26, 0.97)', backdropFilter: 'blur(20px)' }}
                        >
                            {blockSuggestions.length > 0 ? blockSuggestions.map((item) => {
                                const firstLine = item.content.trim().split('\n')[0].slice(0, 60);
                                return (
                                    <li key={item.id}>
                                        <button
                                            type="button"
                                            onMouseDown={(e) => { e.preventDefault(); selectBlock(item); }}
                                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/60 hover:text-amber-300 hover:bg-white/5 transition-colors"
                                        >
                                            <span className="text-amber-400/50 font-bold shrink-0">^</span>
                                            <span className="truncate text-white/80">{firstLine}</span>
                                        </button>
                                    </li>
                                );
                            }) : (
                                <li className="px-3 py-2 text-xs text-white/30">No blocks in this canvas</li>
                            )}
                        </ul>
                    )}

                    {/* Tag suggestion dropdown */}
                    {showDropdown && suggestions.length > 0 && !showCanvasPicker && !showBlockPicker && (
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

                {/* Age filter slider */}
                {onAgeFilterChange && (
                    <>
                        <div className="w-px h-5 bg-white/10 shrink-0" />
                        <div className="flex flex-col items-center gap-0.5 shrink-0" title="Filter by age">
                            <span className={`text-[9px] font-semibold uppercase tracking-wider transition-colors ${ageFilter === 10 ? 'text-white/25' : 'text-amber-400'}`}>
                                {AGE_FILTER_LABELS[ageFilter]}
                            </span>
                            <input
                                type="range"
                                min={0}
                                max={10}
                                step={1}
                                value={ageFilter}
                                onChange={(e) => onAgeFilterChange(Number(e.target.value))}
                                className="age-filter-slider w-28 h-1 cursor-pointer"
                                style={{
                                    accentColor: ageFilter === 10 ? 'rgba(255,255,255,0.2)' : '#fbbf24',
                                }}
                                title={`Age filter: ${AGE_FILTER_LABELS[ageFilter]}`}
                            />
                        </div>
                    </>
                )}

                {/* Funds aggregate */}
                {fundsNet !== undefined && fundsNet !== 0 && (
                    <>
                        <div className="w-px h-5 bg-white/10 shrink-0" />
                        <div className={`flex items-center gap-1 text-[11px] font-bold tabular-nums shrink-0 ${fundsNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`} title="Funds aggregate for this canvas">
                            <IndianRupee size={10} />
                            {fundsNet >= 0 ? '+' : '-'}{'₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Math.abs(fundsNet))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
