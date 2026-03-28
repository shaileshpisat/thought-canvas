import { ItemType } from '../types/canvas';

export const ITEM_DEFAULTS: Record<ItemType, { width: number; height: number }> = {
  text:   { width: 240, height: 120 },
  image:  { width: 300, height: 200 },
  link:   { width: 300, height: 280 },
  canvas: { width: 320, height: 240 },
};

export const ORG_GAP = 32;
export const ORG_MARGIN = 80;
export const ORG_TOOLBAR_RESERVE = 100;
export const ITEM_MIN_WIDTH = 160;
export const ITEM_MIN_HEIGHT = 90;

export const DEFAULT_WIDTH = 300;
export const DEFAULT_HEIGHT = 200;
export const PADDING = 40;
export const START_X = 100;
export const START_Y = 100;
