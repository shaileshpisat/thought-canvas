export type ItemType = 'text' | 'image' | 'link' | 'canvas';

export type Priority = 'very-high' | 'high' | 'medium' | 'low' | 'very-low';

export interface CanvasItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  content: string; // text content, image URL, link URL, or canvas name
  date?: string; // ISO date string YYYY-MM-DD
  priority?: Priority;
  children?: CanvasItem[]; // only for type 'canvas'
  metadata?: {
    title?: string;
    description?: string;
    image?: string;
    color?: string;
    locked?: boolean;
    zIndex?: number;
    naturalSize?: boolean;
  };
}

export interface CanvasState {
  items: CanvasItem[];
  backgroundColor: string;
  zoom: number;
}
