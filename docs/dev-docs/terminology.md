# Black Board — Terminology Glossary

A reference for all terms used across the app for elements, views, collections, and interactions.

---

## Item Types (`ItemType`)

| Code value | Display label | Description |
|---|---|---|
| `'text'` | Text / Block | A text card; also referred to as a **block** in the QuickEntryBar context |
| `'image'` | Image | An image card (base64 or IDB-stored) |
| `'link'` | Link | A URL card with OG metadata preview |
| `'canvas'` | Sub-canvas / Canvas | A nested canvas container that holds children items |

---

## Views / Modes

| Code value | Display label | Icon |
|---|---|---|
| `'canvas'` | Canvas | LayoutGrid |
| `'calendar'` | Calendar | CalendarDays — rendered via **CalendarBoard** |
| `'plan'` | Plan | ClipboardList — rendered via **PlanBoard** |
| `'inbox'` | Inbox | Inbox icon |
| `'archive'` | Archive | Archive icon |

---

## Collections / Containers

| Term | Where used |
|---|---|
| **Canvas** | The root freeform board; also the name for nested sub-canvases |
| **Sub-canvas** | A `canvas`-type item nested inside the root canvas (used in QuickEntryBar, code comments, UI labels) |
| **Inbox** | `CanvasState.inbox[]` — staging area for quick-entry items |
| **Archive** | `CanvasState.archive[]` — archived items |
| **Root** | The top-level canvas (used in BlockLinkPicker path breadcrumbs) |

---

## UI / Interaction Terms

| Term | Where used |
|---|---|
| **Block** | Any single canvas item, especially when referenced via `^` in QuickEntryBar or searched in BlockLinkPicker |
| **Block link** | A `[[id]]`-style reference to another block (BlockLinkPicker placeholder: "Link to a block…") |
| **Quick Entry Bar** | The top fixed input bar for rapidly adding items |
| **Tag** | `#hashtag` attached to items; stored in `tags[]` and `tagMaster` |
| **Timer** | Per-item `CanvasTimer` — tracks elapsed time on a block |
| **Action** | `CanvasAction` — a timestamped log entry on a block |
| **History** | `CanvasHistoryEntry[]` — audit trail of changes to a block |

---

## Priority Levels

`'very-high'` · `'high'` · `'medium'` · `'low'` · `'very-low'`

---

## Recurring Options (for dated items)

`'daily'` · `'weekly'` · `'weekdays'` · `'biweekly'` · `'monthly'`
