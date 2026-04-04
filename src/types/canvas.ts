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

export type FinancialType = 'income' | 'expense' | 'investment' | 'redemption' | 'inflow' | 'outflow';

export type WalletAccountType = 'Savings' | 'Current' | 'Credit Card' | 'Debit Card';

export interface WalletAccount {
  id: string;
  name: string;
  accountType: WalletAccountType;
}

export interface FinancialEntry {
  id: string;
  amount: number;
  description?: string;
  type: FinancialType;
  wallet?: string; // WalletAccount id
  timestamp: number;
}

export interface CanvasItem {
  id: string;
  createdAt?: number;   // unix ms timestamp — set once on creation
  modifiedAt?: number;  // unix ms timestamp — updated on every edit
  type: ItemType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  content: string; // text content, image URL, link URL, or canvas name
  date?: string; // ISO date string YYYY-MM-DD
  time?: string; // HH:MM (24-hour)
  duration?: number; // minutes
  recurring?: 'daily' | 'weekly' | 'weekdays' | 'biweekly' | 'monthly';
  priority?: Priority;
  tags?: string[];
  timer?: CanvasTimer;
  actions?: CanvasAction[];
  history?: CanvasHistoryEntry[];
  financials?: FinancialEntry[];
  children?: CanvasItem[]; // only for type 'canvas'
  caption?: string;
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
  inbox: CanvasItem[];
  archive: CanvasItem[];
  backgroundColor: string;
  zoom: number;
  wallets: WalletAccount[];
}

export interface RecycleBinItem extends CanvasItem {
  deletedAt: string;           // ISO timestamp
  originalCanvasColor?: string; // canvas backgroundColor at time of deletion
}
