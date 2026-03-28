import { CanvasItem } from '@/types/canvas';
import { ITEM_DEFAULTS, ORG_GAP, ORG_MARGIN, ORG_TOOLBAR_RESERVE, ITEM_MIN_WIDTH, ITEM_MIN_HEIGHT, DEFAULT_WIDTH, DEFAULT_HEIGHT, PADDING, START_X, START_Y } from './canvasConstants';

export type OrganizedItem = { id: string; x: number; y: number; width?: number; height?: number };

/**
 * Organises items using an iterative compaction sequence:
 *
 * 1. Sort items by reading order (top-to-bottom, left-to-right).
 * 2. Place each item at the topmost-leftmost clear spot on the canvas
 *    (no overlapping, consistent gap). This is the initial tight pack.
 * 3. Repeat: for every item, try to move it to a better (closer to the
 *    top-left origin) clear spot. Each pass fills gaps created by
 *    previous passes. Stop when nothing moves or after MAX_PASSES.
 * 4. Only if the final layout still overflows the visible viewport,
 *    scale all items down uniformly (binary search for the minimal
 *    scale that fits, respecting ITEM_MIN_WIDTH / ITEM_MIN_HEIGHT).
 *
 * No items are ever resized unless the viewport genuinely cannot
 * accommodate them at natural size.
 */
export const organizeItems = (items: CanvasItem[]): OrganizedItem[] => {
  if (items.length === 0) return [];

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
  const availW = vw - 2 * ORG_MARGIN;
  const availH = vh - 2 * ORG_MARGIN - ORG_TOOLBAR_RESERVE;

  // Sort by reading order
  const ROW_SNAP = 60;
  const sorted = [...items].sort((a, b) => {
    const rowA = Math.round(a.y / ROW_SNAP);
    const rowB = Math.round(b.y / ROW_SNAP);
    return rowA !== rowB ? rowA - rowB : a.x - b.x;
  });

  const origW = sorted.map((item) => item.width  || ITEM_DEFAULTS[item.type].width);
  const origH = sorted.map((item) => item.height || ITEM_DEFAULTS[item.type].height);

  type Rect = { x: number; y: number; w: number; h: number };

  const collides = (a: Rect, b: Rect) =>
    a.x < b.x + b.w + ORG_GAP &&
    a.x + a.w + ORG_GAP > b.x &&
    a.y < b.y + b.h + ORG_GAP &&
    a.y + a.h + ORG_GAP > b.y;

  /**
   * Scan from (ORG_MARGIN, ORG_MARGIN) left-to-right, top-to-bottom and
   * return the first position where a w×h item fits without colliding with
   * any rect in `others`. Falls back to below all items if no spot is found
   * within the viewport.
   */
  const bestSpot = (w: number, h: number, others: Rect[]): { x: number; y: number } => {
    const maxCX = ORG_MARGIN + availW - w;
    const maxCY = ORG_MARGIN + availH - h;
    // Clamp: if item is wider/taller than viewport, just place at origin
    const cx0 = ORG_MARGIN;
    const cy0 = ORG_MARGIN;
    const cxEnd = Math.max(cx0, maxCX);
    const cyEnd = Math.max(cy0, maxCY);

    for (let cy = cy0; cy <= cyEnd; cy += ORG_GAP) {
      for (let cx = cx0; cx <= cxEnd; cx += ORG_GAP) {
        const r: Rect = { x: cx, y: cy, w, h };
        if (!others.some((o) => collides(r, o))) return { x: cx, y: cy };
      }
    }
    // No in-viewport spot — place below all items
    const bottom = others.reduce((m, o) => Math.max(m, o.y + o.h), ORG_MARGIN);
    return { x: ORG_MARGIN, y: bottom + ORG_GAP };
  };

  /**
   * Run the full layout pipeline for a given set of working widths/heights.
   * Returns the final array of rects in the same order as `sorted`.
   */
  const runLayout = (ws: number[], hs: number[]): Rect[] => {
    const rects: Rect[] = [];

    // Step 1 + 2: initial placement — each item goes to first clear spot
    for (let i = 0; i < sorted.length; i++) {
      const { x, y } = bestSpot(ws[i], hs[i], rects);
      rects.push({ x, y, w: ws[i], h: hs[i] });
    }

    // Step 3: iterative compaction — keep moving items closer to origin
    // until nothing moves (canvas is as full as possible).
    const MAX_PASSES = 8;
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let moved = false;
      for (let i = 0; i < rects.length; i++) {
        const others = rects.filter((_, j) => j !== i);
        const { x, y } = bestSpot(ws[i], hs[i], others);
        if (Math.abs(x - rects[i].x) > 1 || Math.abs(y - rects[i].y) > 1) {
          rects[i] = { x, y, w: ws[i], h: hs[i] };
          moved = true;
        }
      }
      if (!moved) break;
    }

    return rects;
  };

  // Step 4: try at natural sizes first
  let ws = origW.map((w) => Math.max(ITEM_MIN_WIDTH, w));
  let hs = origH.map((h) => Math.max(ITEM_MIN_HEIGHT, h));
  let rects = runLayout(ws, hs);

  // Only resize if the result overflows the viewport
  const bottom = rects.reduce((m, r) => Math.max(m, r.y + r.h), 0);
  if (bottom > ORG_MARGIN + availH) {
    const minScale = Math.min(
      ITEM_MIN_WIDTH / Math.max(...origW),
      ITEM_MIN_HEIGHT / Math.max(...origH)
    );
    
    // Fallback: start with minScale results if we must resize
    // Pre-calculate the min-scale layout since it's the smallest we can ever get
    const minWs = origW.map((w) => Math.max(ITEM_MIN_WIDTH, Math.round(w * minScale)));
    const minHs = origH.map((h) => Math.max(ITEM_MIN_HEIGHT, Math.round(h * minScale)));
    ws = minWs;
    hs = minHs;
    rects = runLayout(minWs, minHs);

    // If even min-scale doesn't fit, we stop and use it anyway (best-effort)
    // Otherwise, we binary search for the LARGEST scale that still fits.
    const minBottom = rects.reduce((m, r) => Math.max(m, r.y + r.h), 0);
    if (minBottom <= ORG_MARGIN + availH) {
      let lo = minScale;
      let hi = 1;
      for (let iter = 0; iter < 10; iter++) {
        const mid = (lo + hi) / 2;
        const scaledWs = origW.map((w) => Math.max(ITEM_MIN_WIDTH, Math.round(w * mid)));
        const scaledHs = origH.map((h) => Math.max(ITEM_MIN_HEIGHT, Math.round(h * mid)));
        const candidate = runLayout(scaledWs, scaledHs);
        const candidateBottom = candidate.reduce((m, r) => Math.max(m, r.y + r.h), 0);
        if (candidateBottom <= ORG_MARGIN + availH) {
          lo = mid;
          ws = scaledWs;
          hs = scaledHs;
          rects = candidate;
        } else {
          hi = mid;
        }
      }
    }
  }

  return sorted.map((item, i) => {
    const out: OrganizedItem = { id: item.id, x: rects[i].x, y: rects[i].y };
    if (ws[i] !== origW[i]) out.width  = ws[i];
    if (hs[i] !== origH[i]) out.height = hs[i];
    return out;
  });
};

export const findEmptyLocation = (
  items: CanvasItem[],
  width: number = DEFAULT_WIDTH,
  height: number = DEFAULT_HEIGHT
): { x: number; y: number } => {
  let x = START_X;
  let y = START_Y;
  
  const hasCollision = (nx: number, ny: number) => {
    return items.some(item => {
      const itemWidth = item.width || ITEM_DEFAULTS[item.type].width;
      const itemHeight = item.height || ITEM_DEFAULTS[item.type].height;
      
      return (
        nx < item.x + itemWidth + PADDING &&
        nx + width + PADDING > item.x &&
        ny < item.y + itemHeight + PADDING &&
        ny + height + PADDING > item.y
      );
    });
  };

  // Try to find a spot by moving right, then down
  let attempts = 0;
  const maxAttempts = 100;
  const step = 40;

  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;

  while (hasCollision(x, y) && attempts < maxAttempts) {
    // Basic search: move right, then wrap around and move down
    x += step;
    if (x > screenWidth - width - PADDING) {
      x = START_X;
      y += step;
    }
    
    if (y > screenHeight - height - PADDING) {
       // If we exceed screen, just stack with a small offset
       return { 
         x: START_X + (items.length % 10) * 20, 
         y: START_Y + (items.length % 10) * 20 
       };
    }
    attempts++;
  }

  return { x, y };
};
