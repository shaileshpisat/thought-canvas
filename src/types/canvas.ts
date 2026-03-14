export type ItemType = 'text' | 'image' | 'link' | 'canvas';

export interface CanvasItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  content: string; // text content, image URL, link URL, or canvas name
  children?: CanvasItem[]; // only for type 'canvas'
  metadata?: {
    title?: string;
    description?: string;
    image?: string;
    color?: string;
    locked?: boolean;
    zIndex?: number;
  };
}

export interface CanvasState {
  items: CanvasItem[];
  backgroundColor: string;
  zoom: number;
}
