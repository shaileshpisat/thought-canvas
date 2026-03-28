# Changelog

All user-facing changes to Black Board are documented here, grouped by version.

Format: `vMAJOR.MINOR.PATCH`
- **MAJOR** — breaking changes or complete redesigns
- **MINOR** — new features or significant UI changes
- **PATCH** — bug fixes, small tweaks, copy/style-only changes

---

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
