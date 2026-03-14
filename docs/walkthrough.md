# Thought Canvas - Project Walkthrough

Thought Canvas is a spatial thinking tool built with Next.js, React, and Tailwind CSS. It allows you to organize your thoughts, images, and links in a free-form digital space.

## Key Features
- **Spatial Canvas**: Drag and drop elements anywhere on the screen.
- **Rich Content Support**:
  - **Text**: Double-click or click to edit text blocks.
  - **Images**: Paste images from clipboard or upload from your device.
  - **Links**: Paste URLs to create interactive link cards.
- **Persistence**: All your data is automatically saved to the browser's `localStorage`.
- **PWA Ready**: Install the app on your home screen for a native-like experience.
- **High Aesthetics**: Dark mode by default, glassmorphism, and smooth animations.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Persistence**: Browser Local Storage API

## How to Use
1. **Add Text**: Click the "Text" button in the bottom toolbar or just start typing (coming soon).
2. **Add Images**: Paste an image directly (`Ctrl+V`) or use the "Image" button.
3. **Add Links**: Paste a URL or use the "Link" button.
4. **Organize**: Drag items to reposition them. Use the trash icon on hover to remove items.

## Implementation Details
- `useCanvas` hook: Manages the global state and syncs with `localStorage`.
- `Canvas` component: Handles global events like `paste` and renders the workspace.
- `CanvasItem` component: A wrapper that provides drag functionality and type-specific rendering.

![Thought Canvas Logo](./thought_canvas_logo_1773416246941.png)
