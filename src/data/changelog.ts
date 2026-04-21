// Auto-synced from docs/CHANGELOG.md — update via /changelog command
export interface ChangelogEntry {
  version: string;
  sections: { heading?: string; changes: string[] }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'v2.3.0',
    sections: [
      {
        heading: 'Features',
        changes: [
          'Reorder canvases in Canvas Map — a new Reorder toggle in the Canvas Map header unlocks inline controls on every canvas entry. Move a canvas up or down among its siblings with the arrow buttons, or type a sequence number directly to jump it to a specific position. Reorder controls are scoped to the Canvas Map only.',
        ],
      },
    ],
  },
  {
    version: 'v2.2.1',
    sections: [
      {
        heading: 'Improvements',
        changes: [
          'Stats Board panel is now larger (wider and taller) for more comfortable browsing.',
          'Recurring Today, Pinned Canvases, and Pinned Notes render as horizontally-scrolling cards instead of vertical lists.',
          'Markdown syntax is stripped from note snippets in the Stats Board so previews read as plain text.',
        ],
      },
    ],
  },
  {
    version: 'v2.2.0',
    sections: [
      {
        heading: 'Features',
        changes: [
          'Pinning — any block (canvas, text, image, link) can now be pinned. Toggle via the new pin icon in the hover toolbar, or click the amber pin badge on the top-left of the card to unpin. Pinned state persists with the item.',
          'Stats Board — new Pinned Canvases and Pinned Notes sections list all currently pinned items of those types, each clickable to jump to its location.',
        ],
      },
    ],
  },
  {
    version: 'v2.1.0',
    sections: [
      {
        heading: 'Features',
        changes: [
          'New Stats Board panel — open from the toolbar (chart icon). Shows totals for Canvases, Text, Image, and Link blocks, a tag cloud sized by usage, blocks dated today, and recurring blocks whose rule falls on today. Each listed block is clickable to jump to its location.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.18',
    sections: [
      {
        heading: 'Improvements',
        changes: [
          'Increased toolbar, menubar, and badge opacity for better visibility on all background types.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.17',
    sections: [
      {
        heading: 'Improvements',
        changes: [
          'Canvas-level timer chip (top-right) now stays visible when paused (amber dot, play button to resume), and disappears only when stopped.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.16',
    sections: [
      {
        heading: 'Fixes',
        changes: [
          'Canvas-level running timer (top-right) now resets to zero each time the timer is started or resumed, instead of showing cumulative daily time.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.15',
    sections: [
      {
        heading: 'Improvements',
        changes: [
          'Navigating to a block from Plan Board or Calendar Board now illuminates it with a pulsing highlight.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.14',
    sections: [
      {
        heading: 'Improvements',
        changes: [
          'Repeat option in block date picker now shows as soon as a date is set, without requiring a time or duration.',
          'Pre-block date badge now shows a violet dot when "Show on Plan Board" is checked and a sky dot when "Show on Week Board" is checked.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.13',
    sections: [
      {
        heading: 'Bug Fixes',
        changes: [
          'Fixed Plan Board showing multiple popups when clicking a block that repeats daily or multiple times per week.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.12',
    sections: [
      {
        heading: 'Tweaks',
        changes: [
          '"Move into canvas" tree picker now shows connecting elbow lines between parent and child canvases for easier readability.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.11',
    sections: [
      {
        heading: 'Improvements',
        changes: [
          '"Move into canvas" picker now shows all canvases across the entire tree — with a search box and depth-indented parent breadcrumbs — instead of only sibling canvases at the current level.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.10',
    sections: [
      {
        heading: 'Bug Fixes',
        changes: [
          '[[block]] links now correctly intercept clicks — onPointerDown stops Framer Motion\'s drag tracking so the link navigates instead of being swallowed.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.9',
    sections: [
      {
        heading: 'Bug Fixes',
        changes: [
          'Tag suggestions dropdown no longer appears behind the timer badge when adding a tag to a block.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.8',
    sections: [
      {
        heading: 'Improvements',
        changes: [
          '[[block]] links now pan the canvas to center the linked item and illuminate it with a violet glow on click.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.7',
    sections: [
      {
        heading: 'New Features',
        changes: [
          'Settings → Tags master list: view all tags with item usage counts, rename a tag across all items, and delete unused tags (count = 0).',
        ],
      },
    ],
  },
  {
    version: 'v2.0.6',
    sections: [
      {
        heading: 'Tweaks',
        changes: [
          'Removed the duplicate "Week" toolbar button (Week Board). Items with "Show on Week Board" enabled now appear as priority-colored cards in the main Week (calendar) view instead.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.5',
    sections: [
      {
        heading: 'Fixes',
        changes: [
          'In Inbox view, toolbar Text/Image/Link buttons now add items to Inbox instead of the root canvas.',
          'In Archive view, toolbar add buttons now show a "Can\'t add to Archives" toast.',
          'Canvas sub-canvas button is blocked in Inbox view with a clear message.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.4',
    sections: [
      {
        heading: 'Tweaks',
        changes: [
          'Manual Logs section on canvas items now defaults to collapsed instead of expanded.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.3',
    sections: [
      {
        heading: 'Enhancements',
        changes: [
          'Plan Board now shows date-only blocks (with "Show on Plan Board" checked) in the pre-block row, without requiring time or duration.',
          'Blocks with date + time + duration always appear on Plan Board automatically — no checkbox needed.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.2',
    sections: [
      {
        heading: 'Enhancements',
        changes: [
          'Schedule dropdown now has "Show on Plan Board" and "Show on Week Board" checkboxes — blocks only appear on a board when explicitly opted in.',
          'New Week Board view: shows opted-in blocks as simple cards stacked under their date column, sorted by time. Accessible from the main toolbar.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.1',
    sections: [
      {
        heading: 'Enhancements',
        changes: [
          'Recurrence rules are now structured objects supporting frequency, interval, specific weekdays, and end conditions (never / after N times / by date).',
          'New recurrence builder UI in the schedule dropdown: frequency chips, interval input, weekday toggles, day-of-month vs nth-weekday for monthly, and end condition selector.',
          'Human-readable recurrence summary shown inline on the schedule button (e.g. "Weekly Mon Wed Fri · 5×").',
          'PlanBoard occurrence engine updated for the new rule structure; legacy string values are automatically migrated.',
        ],
      },
    ],
  },
  {
    version: 'v2.0.0',
    sections: [
      {
        heading: 'Enhancements',
        changes: [
          'Schedule control: date, time, duration, and recurrence are now combined into a single button with an inline dropdown panel.',
        ],
      },
    ],
  },
  {
    version: 'v1.9.9',
    sections: [
      {
        heading: 'Bug Fixes',
        changes: [
          'Text blocks: bottom content no longer hidden behind the tag strip when editing — textarea now scrolls above the tag bar.',
        ],
      },
    ],
  },
  {
    version: 'v1.9.8',
    sections: [
      {
        heading: 'Bug Fixes',
        changes: [
          'Plan view: multiple blocks in the same time slot now render side by side instead of overlapping.',
          'Plan view: blocks no longer bleed outside their date column boundary.',
          'Plan view: blocks are now absolutely positioned by time — they snap to 15-min sections, span their full duration across hour rows, and sit side-by-side when overlapping.',
        ],
      },
    ],
  },
  {
    version: 'v1.9.7',
    sections: [
      {
        heading: 'Enhancements',
        changes: [
          'Archive blocks are now fully read-only — editing, deletion, tag changes, priority, date, timer, and financials are blocked. Drag, history panel, eject, and move-into remain available.',
        ],
      },
    ],
  },
  {
    version: 'v1.9.6',
    sections: [
      {
        heading: 'Enhancements',
        changes: [
          'All blocks now track a modifiedAt timestamp, updated on every edit (inbox blocks included).',
          'Audit history panel shows Created and Modified timestamps at the top for all blocks.',
          'Inbox resurface schedule resets on modification — editing a block restarts the day-0/1/7… cycle from the last edit date.',
        ],
      },
    ],
  },
  {
    version: 'v1.9.5',
    sections: [
      {
        heading: 'Enhancements',
        changes: [
          'Inbox: audit history is now fully functional — content edits are recorded, the history panel can be opened, and actions can be logged and deleted directly on inbox items.',
        ],
      },
    ],
  },
  {
    version: 'v1.9.4',
    sections: [
      {
        heading: 'Enhancements',
        changes: [
          'Inbox: clicking the amber resurface count badge filters the inbox view to show only resurfacing items; clicking again clears the filter. Badge turns solid amber when active.',
        ],
      },
    ],
  },
  {
    version: 'v1.9.3',
    sections: [
      {
        heading: 'Enhancements',
        changes: [
          'Canvas Map: added Show Details toggle — reveals per-canvas stat pills for sub-canvas count, block count, aggregate timer, and net financials (recursive across all descendants).',
        ],
      },
    ],
  },
  {
    version: 'v1.9.2',
    sections: [
      {
        heading: 'New Features',
        changes: [
          'Added Canvas Map ("Tree") button in the toolbar — opens a sitemap-style popup showing all sub-canvases in a collapsible tree, with the current canvas highlighted; click any node to navigate there instantly.',
        ],
      },
    ],
  },
  {
    version: 'v1.9.1',
    sections: [
      {
        heading: 'Bug Fixes',
        changes: [
          'Fixed single linefeeds typed in text edit mode being ignored in the rendered Markdown view.',
        ],
      },
    ],
  },
  {
    version: 'v1.9.0',
    sections: [
      {
        heading: 'Recycle Bin',
        changes: [
          'Deleted blocks are now moved to a Recycle Bin instead of being permanently removed.',
          'Deleted items are retained for 45 days before being automatically purged.',
          'Access the Recycle Bin via the trash icon in the bottom toolbar — shows a badge count when items are present.',
          'Restore any deleted block back to its original canvas position with one click.',
          'Permanently delete individual items or empty the entire bin at once.',
        ],
      },
    ],
  },
  {
    version: 'v1.8.4',
    sections: [{ heading: 'Toolbar Cleanup', changes: ['Removed the Edit button from text block toolbars — clicking the block content already enters edit mode.'] }],
  },
  {
    version: 'v1.8.3',
    sections: [
      {
        heading: 'Date/Time Toolbar Cleanup',
        changes: [
          'Removed the standalone "Remove date" and "Remove time" X buttons from the toolbar.',
          'The time clock button now opens a dropdown with "Change" and "Clear" options when a time is already set.',
        ],
      },
    ],
  },
  {
    version: 'v1.8.2',
    sections: [
      {
        heading: 'Block Toolbar Declutter',
        changes: [
          'Timer and Financials buttons removed from the top toolbar.',
          'Timer button now lives at the bottom-left of the block — appears on hover when no timer exists, always visible once recording has started.',
          'Financials button now lives at the bottom-right, next to the financial aggregate badge — appears on hover when no entries exist, always visible when financials are recorded.',
        ],
      },
    ],
  },
  {
    version: 'v1.8.1',
    sections: [
      {
        heading: 'Image Caption',
        changes: [
          'Image blocks now support an optional caption displayed below the image.',
          'Click the Aa button in the image toolbar to add or edit a caption.',
          'Double-click the caption text directly to edit it inline.',
          'Clearing the caption removes it entirely.',
        ],
      },
    ],
  },
  {
    version: 'v1.8.0',
    sections: [
      {
        heading: 'Financials on Blocks',
        changes: [
          'Add financial entries to any block via the new ₹ toolbar button.',
          'Each entry has an amount, optional description, and type: income, expense, investment, redemption, inflow, or outflow (expense is the default).',
          'The block displays a ₹ net aggregate badge (green for positive, red for negative).',
          'Week Board and Plan Board day headers now show Funds: ₹X below the date, aggregating all financial entries from items scheduled on that day.',
        ],
      },
    ],
  },
  {
    version: 'v1.7.6',
    sections: [
      {
        heading: 'Week Board — Manual Log capsule labels',
        changes: [
          'Manual log capsules now display the first 15 characters of the block title as a text label instead of a plain dot.',
          'Markdown formatting (headings, bold/italic, inline code, links) is stripped before truncating.',
        ],
      },
    ],
  },
  {
    version: 'v1.7.5',
    sections: [
      {
        heading: 'Week Board — Manual Log capsules',
        changes: [
          'Manual log entries now appear on the Week Board as sky-blue square capsules in the time slot matching the entry\'s timestamp.',
          'Hover (or click to pin) a capsule to see a popup with the block title, canvas path, entry count, total duration, and each log entry with its time and label.',
          '"Show on Canvas" button navigates directly to the block.',
        ],
      },
    ],
  },
  {
    version: 'v1.7.4',
    sections: [
      {
        heading: 'Manual Logs — date grouping',
        changes: [
          'Log entries are now grouped by date in descending order (newest date first).',
          'Each group shows a date header — "Today" for today\'s entries, or a formatted date for older ones.',
        ],
      },
    ],
  },
  {
    version: 'v1.7.3',
    sections: [
      {
        heading: 'Timer — running capsule shows today\'s time',
        changes: [
          'The top-right running timers capsule now displays today\'s elapsed time instead of the all-time total, consistent with the timer badge on the card itself.',
        ],
      },
    ],
  },
  {
    version: 'v1.7.2',
    sections: [
      {
        heading: 'Timer — daily breakdown',
        changes: [
          'When a timer is running or has sessions, the main badge now shows today\'s elapsed time only.',
          'If there is time from previous days, a separate dimmer "prev" badge appears alongside it showing the cumulative past total.',
          'Items with no sessions data (legacy timers) continue showing the original all-time total.',
        ],
      },
    ],
  },
  {
    version: 'v1.7.1',
    sections: [
      {
        heading: 'Manual Logs',
        changes: [
          'Added a hide/show toggle to the Manual Logs section on canvas items. Clicking the "Manual Logs" header collapses or expands the list. The count of logs is shown in the header at all times.',
        ],
      },
    ],
  },
  {
    version: 'v1.7.0',
    sections: [
      {
        heading: 'Archives',
        changes: [
          'Added a dedicated Archives store — separate from the canvas board, stored as state.archive.',
          'Every canvas item now has an Archive button in its action menu (amber colour). Clicking it removes the item from the board and places it in Archives.',
          'Archives toolbar button (amber) shows a count badge and opens the archive canvas view.',
          'Archive canvas view renders archived items as fully draggable cards, identical to the main board.',
          'Items can be ejected back to the root board or moved into any sub-canvas directly from Archives.',
          'All archive movements are recorded in audit history: "Archived", "Restored from Archives", "Restored from Archives to sub-canvas".',
        ],
      },
      {
        heading: 'Inbox',
        changes: [
          'Added a dedicated Inbox store — state.inbox, completely separate from the main canvas board. No sub-canvas card is shown on the board.',
          'All notes captured via the Quick Entry Bar (without a >> routing prefix) go directly to Inbox.',
          'Quick Entry Bar shows a sky-blue Inbox badge as the default destination indicator.',
          'Inbox toolbar button shows total item count (sky-blue badge) and a pulsing amber re-surface count badge.',
          'Clicking the Inbox button switches to the inbox canvas view — fully draggable cards, not a list.',
          'Re-surface logic: an inbox item resurfaces on day 0 (creation), day 1 (next day), and every 7 days thereafter until moved out.',
          'Items can be ejected to the root board or moved into any sub-canvas from the inbox view.',
          'All inbox movements are recorded in audit history: "Sent to Inbox", "Moved from Inbox to board", "Moved from Inbox to sub-canvas".',
          'Data migration: existing Inbox canvas items are automatically moved to state.inbox on first load.',
        ],
      },
    ],
  },
  {
    version: 'v1.5.0',
    sections: [
      {
        heading: 'Week Board — Calendar View Redesign',
        changes: [
          'Redesigned Week Board layout to a Google Calendar-style grid: sticky day-name header row with circular today badge, fixed time-gutter column, and scrollable hourly rows.',
          'Time slots use a 3-zone layout: a collapsed 00:00–09:59 pre-block, individual 10:00–20:00 hourly rows, and a collapsed 21:00–23:59 post-block.',
          'Yellow activity dots now appear per slot per block — if a block has activity across multiple time slots in a day, a separate dot is shown in each applicable slot.',
          'Hover popup on yellow dots shows only the history entries for that time slot (up to 8, with overflow count).',
          '"Involved Canvases" and "Modified Tags" sections moved inline into the all-day band at the top of each day column.',
        ],
      },
    ],
  },
  {
    version: 'v1.4.3',
    sections: [
      {
        changes: [
          'Added Organize button — arranges all blocks in a clean grid that fits the visible screen.',
          'Undo button appears after organizing, letting you restore the previous layout instantly.',
          'Added version changelog popup — click the version number to see what\'s new.',
        ],
      },
    ],
  },
  {
    version: 'v1.4.1',
    sections: [{ changes: ['Added date filter panel to browse and filter canvas items by date.', 'Search panel improvements for faster discovery of notes and links.'] }],
  },
  {
    version: 'v1.4.0',
    sections: [{ changes: ['Introduced folder/path-based organization for canvas items.', 'Added breadcrumb navigation to move between folders.'] }],
  },
  {
    version: 'v1.3.0',
    sections: [{ changes: ['Added settings panel with canvas customization options.', 'Export and import canvas data as JSON for backup and transfer.'] }],
  },
  {
    version: 'v1.2.0',
    sections: [{ changes: ['Link cards now show rich previews with title, description, and image from the linked page.', 'Paste a URL directly onto the canvas to create a link card instantly.'] }],
  },
  {
    version: 'v1.1.0',
    sections: [{ changes: ['Images can now be added by pasting from clipboard or uploading a file.', 'Canvas background color can be customized.'] }],
  },
  {
    version: 'v1.0.0',
    sections: [{ changes: ['Initial release: freeform canvas for text notes, images, and links.', 'Drag cards freely around the canvas and double-click to create new notes.', 'All data saved locally in your browser — no account needed.'] }],
  },
];
