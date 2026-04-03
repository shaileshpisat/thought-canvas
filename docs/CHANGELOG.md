# Changelog

All user-facing changes to Black Board are documented here, grouped by version.

Format: `vMAJOR.MINOR.PATCH`
- **MAJOR** — breaking changes or complete redesigns
- **MINOR** — new features or significant UI changes
- **PATCH** — bug fixes, small tweaks, copy/style-only changes

---

## v1.7.3

### Timer — running capsule shows today's time

- The top-right running timers capsule now displays **today's elapsed time** instead of the all-time total, consistent with the timer badge on the card itself.

## v1.7.2

### Timer — daily breakdown

- When a timer is running or has sessions, the main badge now shows **today's elapsed time only**.
- If there is time from previous days, a separate dimmer **"prev"** badge appears alongside it showing the cumulative past total.
- Items with no sessions data (legacy timers) continue showing the original all-time total.

## v1.7.1

### Manual Logs

- Added a **hide/show toggle** to the Manual Logs section on canvas items. Clicking the "Manual Logs" header collapses or expands the list. The count of logs is shown in the header at all times.

---

## v1.7.0

### Archives

- Added a dedicated **Archives** store — separate from the canvas board, stored as `state.archive`.
- Every canvas item now has an **Archive** button in its action menu (amber colour). Clicking it removes the item from the board and places it in Archives.
- Archives toolbar button (amber) shows a count badge and opens the **archive canvas view**.
- Archive canvas view renders archived items as fully draggable cards, identical to the main board.
- Items can be **ejected back to the root board** or **moved into any sub-canvas** directly from Archives.
- All archive movements are recorded in the item's **audit history**: `"Archived"`, `"Restored from Archives"`, `"Restored from Archives to sub-canvas"`.

### Inbox

- Added a dedicated **Inbox** store — `state.inbox`, completely separate from the main canvas board. No sub-canvas card is shown on the board.
- All notes captured via the **Quick Entry Bar** (without a `>>` routing prefix) go directly to Inbox.
- Quick Entry Bar shows a sky-blue **Inbox** badge as the default destination indicator.
- Inbox toolbar button shows total item count (sky-blue badge) and a pulsing amber **re-surface** count badge.
- Clicking the Inbox button switches to the **inbox canvas view** — fully draggable cards, not a list.
- **Re-surface logic**: an inbox item resurfaces (amber badge) on day 0 (creation), day 1 (next day), and every 7 days thereafter until moved out.
- Items can be **ejected to the root board** or **moved into any sub-canvas** from the inbox view.
- Inbox items are correctly placed using `findEmptyLocation` — no longer stacked at the top-left corner.
- All inbox movements are recorded in audit history: `"Sent to Inbox"`, `"Moved from Inbox to board"`, `"Moved from Inbox to sub-canvas"`.
- Data migration: existing `type: 'canvas'` Inbox items are automatically moved to `state.inbox` on first load.

### New fields

- `CanvasItem.createdAt` — unix ms timestamp auto-set on every new item, used by re-surface logic.
- `CanvasState.inbox` and `CanvasState.archive` — dedicated arrays in persisted state.

## v1.5.0

### Week Board — Calendar View Redesign

- Redesigned Week Board layout to a Google Calendar-style grid: sticky day-name header row with circular today badge, fixed time-gutter column, and scrollable hourly rows.
- Time slots use a 3-zone layout: a collapsed **00:00–09:59** pre-block, individual **10:00–20:00** hourly rows (one per hour), and a collapsed **21:00–23:59** post-block.
- Yellow activity dots now appear **per slot per block** — if a block has activity across multiple time slots in a day, a separate dot is shown in each applicable slot.
- Hover popup on yellow dots shows **only the history entries for that time slot** (up to 8, with overflow count).
- Clicking a yellow dot still opens the **full-day history** via the "Show Full History" popup.
- "Show Full History" opens a compact popup (matching the hover popup style) with all entries for the block on that day, scrollable.
- "Involved Canvases" and "Modified Tags" sections moved inline into the all-day band at the top of each day column.
- Popup buttons changed from all-caps to **title case** with normal letter-spacing and `whitespace-nowrap`.
- Popup buttons no longer show icons — labels only.
- Popup positioning anchored to top of dot row to prevent overlap with the sticky header.
- Overall font sizes increased one step across all Week Board elements.

## v1.4.3

- Added version changelog popup — click the version number to see what's new.

## v1.4.2

- Internal improvements and bug fixes.

## v1.4.1

- Added date filter panel to browse and filter canvas items by date.
- Search panel improvements for faster discovery of notes and links.

## v1.4.0

- Introduced folder/path-based organization for canvas items.
- Added breadcrumb navigation to move between folders.

## v1.3.0

- Added settings panel with canvas customization options.
- Export and import canvas data as JSON for backup and transfer.

## v1.2.0

- Link cards now show rich previews with title, description, and image from the linked page.
- Paste a URL directly onto the canvas to create a link card instantly.

## v1.1.0

- Images can now be added by pasting from clipboard or uploading a file.
- Canvas background color can be customized.

## v1.0.0

- Initial release: freeform canvas for text notes, images, and links.
- Drag cards freely around the canvas and double-click to create new notes.
- All data saved locally in your browser — no account needed.
