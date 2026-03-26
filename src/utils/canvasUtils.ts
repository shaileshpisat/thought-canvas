import { CanvasItem } from '@/types/canvas';

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 200;
const PADDING = 40;
const START_X = 100;
const START_Y = 100;

export type OrganizedItem = { id: string; x: number; y: number; width?: number; height?: number };

const ITEM_MIN_WIDTH = 160;
const ITEM_MIN_HEIGHT = 90;

function naturalSize(item: CanvasItem): { w: number; h: number } {
  return {
    w: item.width || (item.type === 'text' ? 240 : 300),
    h: item.height || (item.type === 'text' ? 120 : 200),
  };
}

function doLayout(
  items: CanvasItem[],
  scale: number,
  gap: number,
  margin: number,
  availableWidth: number
): OrganizedItem[] {
  let rowX = margin;
  let rowY = margin;
  let rowHeight = 0;

  return items.map((item) => {
    const { w: nw, h: nh } = naturalSize(item);
    const w = Math.max(ITEM_MIN_WIDTH, Math.round(nw * scale));
    const h = Math.max(ITEM_MIN_HEIGHT, Math.round(nh * scale));

    if (rowX + w > availableWidth + margin && rowX > margin) {
      rowX = margin;
      rowY += rowHeight + gap;
      rowHeight = 0;
    }

    const result: OrganizedItem = { id: item.id, x: rowX, y: rowY };
    if (scale < 1) {
      result.width = w;
      result.height = h;
    }
    rowX += w + gap;
    rowHeight = Math.max(rowHeight, h);
    return result;
  });
}

/**
 * Arranges items in a clean left-to-right, wrapping grid that fits the
 * visible viewport. If the natural layout overflows vertically, items are
 * uniformly scaled down (to a minimum size) so everything stays on screen.
 * Returns new positions and, when scaling is applied, new width/height.
 */
export const organizeItems = (items: CanvasItem[]): OrganizedItem[] => {
  if (items.length === 0) return [];

  const GAP = 32;
  const MARGIN = 80;
  const TOOLBAR_RESERVE = 100; // bottom toolbar
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;

  const availableWidth = vw - 2 * MARGIN;
  const availableHeight = vh - 2 * MARGIN - TOOLBAR_RESERVE;

  // First pass at scale=1 to measure total height needed
  const firstPass = doLayout(items, 1, GAP, MARGIN, availableWidth);
  const lastItem = firstPass[firstPass.length - 1];
  // find the bottom of the last row
  const maxBottom = firstPass.reduce((max, pos, i) => {
    const { h } = naturalSize(items[i]);
    return Math.max(max, pos.y + h);
  }, 0);
  const totalContentHeight = maxBottom + MARGIN - MARGIN; // = maxBottom

  if (totalContentHeight <= availableHeight + MARGIN) {
    return firstPass; // fits — no resizing needed
  }

  // Compute scale so everything fits vertically
  let scale = availableHeight / (totalContentHeight - MARGIN);
  scale = Math.max(scale, ITEM_MIN_WIDTH / 300); // don't go below min

  return doLayout(items, scale, Math.round(GAP * scale), MARGIN, availableWidth);
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
      const itemWidth = item.width || (item.type === 'text' ? 240 : 300);
      const itemHeight = item.height || (item.type === 'text' ? 120 : 200);
      
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
