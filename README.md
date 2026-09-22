# Thought Canvas

A spatial thinking tool. Drop text, images, and links anywhere on a free-form canvas and organize your thoughts visually — all stored in your browser with no account required.

## Features

- **Spatial canvas** — drag and drop text, image, and link items anywhere on the screen
- **Clipboard support** — paste images and links directly onto the canvas
- **Link previews** — pasted URLs are resolved into rich cards via server-side metadata scraping
- **Calendar & plan boards** — organize entries by date alongside the free-form canvas
- **Recycle bin** — restore accidentally deleted items
- **100% local** — all data lives in `localStorage`; nothing leaves your browser

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) — App Router |
| UI | [React 19](https://react.dev/) |
| Language | [TypeScript 5](https://www.typescriptlang.org/) — strict mode |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Animation | [Framer Motion](https://motion.dev/) |
| Persistence | `localStorage` + `IndexedDB` (images) — no backend database |

## Getting Started

### Prerequisites

- Node.js 18.17+
- npm 9+

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production build

```bash
npm run build
npm start
```

## Data

Canvas items and settings are stored in `localStorage`; pasted images are stored in `IndexedDB` to avoid `localStorage` size limits. Nothing is sent to a server except a metadata fetch used to build link preview cards.

## Project Structure

```
app/               # Next.js App Router (layout, page, globals.css, metadata API route)
components/        # Canvas, CanvasItem, PlanBoard, CalendarBoard, SearchPanel, etc.
hooks/             # useCanvas, useRecycleBin, useStorageMonitor, useImageStorageTracker
config/            # storageConfig
data/              # changelog
types/             # canvas types
utils/             # canvasUtils, dateUtils, imageDB, searchUtils, etc.
```

## License

MIT — see [LICENSE](LICENSE).
