export type ItemType = 'text' | 'image' | 'link' | 'canvas';

export type Priority = 'very-high' | 'high' | 'medium' | 'low' | 'very-low';

export interface CanvasTimer {
  isRunning: boolean;
  startTime: number;   // Date.now() when last started
  totalElapsed: number; // seconds accumulated across all sessions
  sessions?: { start: number; end?: number }[];
}

export interface CanvasAction {
  id: string;
  label: string;
  timestamp: number;  // Date.now() when logged
  duration: number;   // seconds since previous action (or since timer start)
}

export interface CanvasHistoryEntry {
  id: string;
  type: 'tag' | 'date' | 'navigation' | 'content' | 'geometry' | 'timer';
  action: string; // descriptive text: "Added tag: work", "Changed date to 2023-10-01", etc.
  timestamp: number;
  snapshot?: string; // Optonal snapshot of text for content changes
}

export interface CanvasItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  content: string; // text content, image URL, link URL, or canvas name
  date?: string; // ISO date string YYYY-MM-DD
  time?: string; // HH:MM (24-hour)
  duration?: number; // minutes
  priority?: Priority;
  tags?: string[];
  timer?: CanvasTimer;
  actions?: CanvasAction[];
  history?: CanvasHistoryEntry[];
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
