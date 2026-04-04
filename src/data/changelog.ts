// Auto-synced from docs/CHANGELOG.md — update via /changelog command
export interface ChangelogEntry {
  version: string;
  sections: { heading?: string; changes: string[] }[];
}

export const CHANGELOG: ChangelogEntry[] = [
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
