# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server at localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

There are no tests in this project.

## Architecture

Thought Canvas is a single-page, client-side freeform canvas app built with Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, and Framer Motion.

### Data flow

All canvas state lives in **`localStorage`** under the key `thought-canvas-data`. There is no database or auth. The `useCanvas` hook ([src/hooks/useCanvas.ts](src/hooks/useCanvas.ts)) manages reads/writes to localStorage and exposes `addItem`, `updateItem`, `removeItem`, `moveItem`, and `clearCanvas`.

### Core types

[src/types/canvas.ts](src/types/canvas.ts) defines two types:
- `CanvasItem` — a positioned card with `type: 'text' | 'image' | 'link'`, `x/y` coords, optional `width/height`, `content` string, and `metadata` (OG tags for links).
- `CanvasState` — the full persisted state: `items[]`, `backgroundColor`, `zoom`.

### Component tree

```
page.tsx
└── Canvas.tsx          ← full-screen container; handles paste events, toolbar, drag-drop orchestration
    ├── CanvasItem.tsx  ← renders each card (text/image/link), drag via Framer Motion
    └── StorageStats.tsx ← modal showing localStorage usage
```

**Canvas.tsx** ([src/components/Canvas.tsx](src/components/Canvas.tsx)):
- Global `paste` event listener converts clipboard text/URLs/images into new items.
- Double-click on the empty canvas creates a new text item at the click position.
- Bottom toolbar for adding Text / Image (file upload) / Link (prompt dialog).
- Calls `/api/metadata` after adding a link item to fetch OG tags.

**CanvasItem.tsx** ([src/components/CanvasItem.tsx](src/components/CanvasItem.tsx)):
- Uses Framer Motion `drag` + `dragMomentum={false}` for free drag. Position is committed on `onDragEnd` by adding the drag offset to the stored `x/y`.
- Text items render via `ReactMarkdown` + `remark-gfm` in view mode; switch to `<textarea>` in edit mode.
- Image items store base64 data URLs in `content`.
- Link items display OG image, title, description, and favicon via Google's favicon service.

### API route

[src/app/api/metadata/route.ts](src/app/api/metadata/route.ts) — server-side proxy that fetches a URL and uses `cheerio` to parse `og:title`, `og:description`, and `og:image` tags. Required to avoid CORS issues when fetching third-party pages from the browser.

### Styling

Tailwind v4 with a custom theme in [src/app/globals.css](src/app/globals.css):
- `canvas-bg` utility — 40px dot-grid via CSS background-image.
- `glass` / `glass-dark` utilities — glassmorphism effect used on all cards and the toolbar.
- Fonts: `Inter` (sans), `Outfit` (display via `font-display`).
- Colors: `canvas-bg` (#0f172a dark navy), `accent` (#38bdf8 sky blue).

### Placement logic

[src/utils/canvasUtils.ts](src/utils/canvasUtils.ts) — `findEmptyLocation` scans existing items with a 40px padding collision check, stepping right then down, to place new items without overlap.
