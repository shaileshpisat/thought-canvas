import { CanvasItem } from '@/types/canvas';

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 200;
const PADDING = 40;
const START_X = 100;
const START_Y = 100;

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
