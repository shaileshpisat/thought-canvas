# Changelog

All user-facing changes to Black Board are documented here, grouped by version.

Format: `vMAJOR.MINOR.PATCH`
- **MAJOR** — breaking changes or complete redesigns
- **MINOR** — new features or significant UI changes
- **PATCH** — bug fixes, small tweaks, copy/style-only changes

---

## v2.0.1

### Enhancements
- Recurrence rules are now structured objects (`RecurringRule`) supporting frequency, interval, specific weekdays, and end conditions (never / after N times / by date).
- New recurrence builder UI in the schedule dropdown: frequency chips (Daily/Weekly/Monthly/Yearly), interval input, weekday toggles for weekly, day-of-month vs nth-weekday for monthly, and end condition selector.
- Human-readable recurrence summary shown inline on the schedule button (e.g. "Weekly Mon Wed Fri · 5×").
- PlanBoard occurrence engine updated to handle the new `RecurringRule` structure with full interval, multi-day, and end-condition support; legacy string values are automatically migrated.

---

## v2.0.0

### Enhancements
- Schedule control: date, time, duration, and recurrence are now combined into a single button with an inline dropdown panel.

---

## v1.9.9

### Bug Fixes
- Text blocks: bottom content no longer hidden behind the tag strip when editing — textarea now scrolls above the tag bar.

---

## v1.9.8

### Bug Fixes
- Plan view: multiple blocks in the same time slot now render side by side instead of overlapping.
- Plan view: blocks no longer bleed outside their date column boundary.
- Plan view: blocks are now absolutely positioned by time — they snap to 15-min sections, span their full duration across hour rows, and sit side-by-side when overlapping.

---

## v1.9.7

### Enhancements
- Archive blocks are now fully read-only — editing, deletion, tag changes, priority, date, timer, and financials are all blocked. Drag, history panel, eject, and move-into remain available.

---

## v1.9.6

### Enhancements
- All blocks now track `modifiedAt` timestamp, updated on every edit (inbox blocks included via `updateInboxItem`).
- Audit history panel shows **Created** and **Modified** timestamps at the top for all blocks.
- Inbox resurface schedule now resets to the modification date — editing a block restarts its day-0/1/7… cycle from when it was last changed.

---

## v1.9.5

### Enhancements
- Inbox: audit history is now fully functional — content edits are recorded, the history panel can be opened, and actions can be logged and deleted, all operating directly on inbox items.

---

## v1.9.4

### Enhancements
- Inbox: clicking the amber resurface count badge filters the inbox view to show only resurfacing items; clicking again clears the filter. Badge appearance changes to solid amber when active.

---

## v1.9.3

### Enhancements
- Canvas Map: added **Show Details** toggle in the header — reveals per-canvas stat pills for sub-canvas count, block count, aggregate timer, and net financials (recursive across all descendants).

---

## v1.9.2

### New Features
- Added **Canvas Map** ("Tree") button in the toolbar — opens a sitemap-style popup showing all sub-canvases in a collapsible tree, with the current canvas highlighted; click any node to navigate there instantly.

---

## v1.9.1

### Bug Fixes
- Fixed single linefeeds typed in text edit mode being ignored in the rendered Markdown view.

---

## v1.9.0

### Recycle Bin
- Deleted blocks are now moved to a Recycle Bin instead of being permanently removed.
- Deleted items are retained for 45 days before being automatically purged.
- Access the Recycle Bin via the trash icon in the bottom toolbar — shows a badge count when items are present.
- Restore any deleted block back to its original canvas position with one click.
- Permanently delete individual items or empty the entire bin at once.

---

## v1.8.4

### Toolbar Cleanup
- Removed the Edit button from text block toolbars — clicking the block content already enters edit mode.

---

## v1.8.3

### Date/Time Toolbar Cleanup
- Removed the standalone "Remove date" and "Remove time" X buttons from the toolbar.
- The date picker's native Clear option handles date removal.
- The time clock button now opens a small dropdown (matching duration/recurring style) with "Change" and "Clear" options when a time is already set.

---

## v1.8.2

### Block Toolbar Declutter
- Timer and Financials buttons removed from the top toolbar.
- Timer button now lives at the bottom-left of the block: appears on hover when no timer exists, always visible once recording has started.
- Financials button now lives at the bottom-right, next to the financial aggregate badge: appears on hover when no entries exist, always visible when financials are recorded.

---

## v1.8.1

### Image Caption

- Image blocks now support an optional caption displayed below the image.
- Click the **Aa** button in the image toolbar to add or edit a caption.
- Double-click the caption text directly to edit it inline.
- Clearing the caption removes it entirely.

---

## v1.8.1

### Wallet Accounts for Financials

- Financial entries now include a **Wallet** dropdown to assign a source/destination account.
- Wallet master is managed in **Settings → Wallet Accounts**: add, rename, change account type, or remove wallets.
- Default accounts pre-loaded: ICICI CC, AXIS CC, IndusInd CC, KMB, HUF, IDFC, DBS, ICICI, Cash.
- Account types: Savings, Current, Credit Card, Debit Card.
- Selected wallet shown as a badge on each financial entry in the block panel.

## v1.8.0

### Financials on Blocks

- Add financial entries to any block via the new ₹ toolbar button.
- Each entry has an amount, optional description, and type: income, expense, investment, redemption, inflow, or outflow (expense is the default).
- The block displays a ₹ net aggregate badge (green for positive, red for negative).
- Week Board and Plan Board day headers now show **Funds: ₹X** below the date, aggregating all financial entries from items scheduled on that day.

## v1.7.6

### Week Board — Manual Log capsule labels

- Manual log capsules now display the first 15 characters of the block title as a text label instead of a plain dot.
- Markdown formatting (headings `#`, bold/italic `*_`, inline code, links) is stripped before truncating.

## v1.7.5

### Week Board — Manual Log capsules

- Manual log entries now appear on the Week Board as **sky-blue square capsules** in the time slot matching the entry's timestamp.
- Hover (or click to pin) a capsule to see a popup with the block title, canvas path, entry count, total duration, and each log entry with its time and label.
- "Show on Canvas" button navigates directly to the block.

## v1.7.4

### Manual Logs — date grouping

- Log entries are now grouped by date in descending order (newest date first).
- Each group shows a date header — "Today" for today's entries, or a formatted date (e.g. "Apr 2, 2026") for older ones.

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
