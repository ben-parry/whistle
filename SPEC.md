# Whistle

A hyper-opinionated, beautifully crafted punch clock web app with Art Nouveau styling and a native iOS companion.

## What is Whistle?

Whistle is an opinionated time tracking app for people who believe work has its hours and rest has its own. You clock in when you start working, clock out when you stop, and Whistle keeps track of everything — with guardrails.

### Core Philosophy

Whistle enforces boundaries like a Victorian factory punch clock. Work happens between 5am and 9pm, never on Sundays, and never more than 12 hours in a day. One clock-in and one clock-out per day — no multiple sessions. If you forget to clock out, Whistle auto-closes your session server-side.

### Features

- **Simple punch clock** — One button to clock in/out, one session per day
- **Timestamps** — Clock-in and clock-out timestamps displayed below the timer
- **Year total** — Hours worked this year with compact progress bar toward 2,333 hours
- **Shift progress** — Inline progress bar showing shift completion with hours label
- **Heatmap visualization** — GitHub-style calendar on profile page (Sundays greyed out)
- **Factory Floor** — Public today-only table showing who is working, with realtime ticking
- **Profile link** — Each user can set one personal link, displayed as their name on Factory Floor
- **Shift length** — Configurable daily shift target (4–10 hours, default 8)
- **Session history** — View, edit, and delete recent sessions (with limits)
- **Statistics** — Inline prose summary of your year including median clock-in/out times
- **CSV export** — Download all your time entries (as JSON for client-side CSV generation)
- **Change password** — Self-service password changes
- **Native iOS app** — Minimal companion for clock in/out on the go
- **Multi-user** — Each person gets a name, a cute three-word ID, and their own account
- **Sunday experience** — Special quote, image, poetry, and link on Sundays
- **Hidden users** — Specific users can be excluded from the Factory Floor
- **About page** — Content served from an ABOUT.md markdown file
- **Sign-out safety** — Signing out while clocked in shows a warning and auto-clocks out

## Tech Stack

- **Frontend**: Plain HTML, CSS, and JavaScript (no frameworks)
- **Backend**: Node.js with Vercel serverless functions
- **Database**: Vercel Postgres (via `pg`)
- **iOS App**: SwiftUI (iOS 16+)
- **Hosting**: Vercel
- **Font**: Kalice (self-hosted woff2/woff)
- **AI**: Anthropic Claude API (for name validation on registration)
- **Email**: Resend API (for account deletion notifications)

### Dependencies

- `pg` — PostgreSQL client
- `bcryptjs` — Password hashing
- `cookie` — Cookie parsing/serialization

## Time Tracking Rules

These rules are enforced server-side:

| Rule | Detail |
|---|---|
| **Working hours** | 5:00 AM – 9:00 PM only |
| **Daily maximum** | 12 hours per calendar day |
| **One session per day** | Only one clock-in and one clock-out allowed per day |
| **Sundays** | No work allowed. Full Sunday experience displayed |
| **Auto-close** | Stale open sessions are closed server-side at min(start + 12h, 9pm). Enforced on every status check and Factory Floor API call. |

### Server-Side Auto-Close

Stale sessions are closed proactively server-side:

- When the **status API** is called: auto-close the user's open session if past the cap
- When the **Factory Floor API** is called: auto-close all open sessions before computing data
- End time = min(start_time + 12 hours, 9pm in start_timezone)

### Client-Side Behavior

The frontend trusts the server completely:

- Do **not** display elapsed time or working state until the first status API response
- Show a loading/neutral state on page load
- Same applies to the Factory Floor: do not render live timers until the first API response

## Sunday Behavior

Sundays have a completely different experience across the app.

### Punch Clock Page (Sundays)

- **Hide entirely**: The clock-in/out button, year-at-a-glance heatmap, year total / hours worked, and progress bar
- **Show instead**: A centered quote: "It is Sunday, let us seize the means of relaxation."
- **Below the quote**: A link to https://lavitalenta.substack.com/
- **Below the link**: The image `pics/sunday.png` (smaller size, max-width 220px)
- The navigation bar remains visible and functional

### Factory Floor Page (Sundays)

- **Hide entirely**: The Factory Floor table
- **Show instead**: A poem from the curated poetry collection, **left-aligned**
- Attribution format: poet name, year

### Poems Database

A file at `public/data/poems.js` containing ~52 exceptional public domain poems. Selection is by week number (`weekNumber % poems.length`).

## User Identity

### Name

Every user must provide a real name at registration. Names are validated:
- Must contain only Unicode letters (no numbers)
- No more than one consecutive space between parts
- Validated by Claude API as a plausible real name (fails open)
- Displayed on the Factory Floor (email is never shown publicly)

### Cute ID

Every user is automatically assigned a unique three-word identifier: `Adjective-CraftWord-Noun`

Examples: `Steady-Wright-Oak`, `Bold-Weaver-Fern`, `Keen-Cooper-Lark`

### Hidden Users

A hardcoded list of email addresses in `api/_helpers.js` (`HIDDEN_USERS`). These users are excluded from all Factory Floor queries but can still use the app normally.

## Pages

### Login / Register (`index.html`)

- Tabbed form for Sign In and Create Account
- Registration requires: email, password (8+ chars), name (validated), and shift length (4–10 hours, default 8)
- **No password confirmation field** — single password entry only
- "Forgot password?" links to admin email
- Link to About page

### Punch Clock (`app.html`)

- Main working interface — one session per day, minimal UI
- Big clock in/out button with elapsed time display
- **Clock In button color**: `#6C7A61` (muted green)
- **No status text** — no "Currently Working" or "Not Working" labels
- **When clocked in**: Timer, shift progress bar (with shift hours inline), Clock Out button, clock-in timestamp
- **After clock-out**: Timestamps only (in and out), shift progress bar (filled), and annual progress bar. No button, no extra text.
- **Compact year total** with progress bar (goal: 2,333 hours), smaller text and padding
  - **(i) icon** next to the progress bar that links to the About page
- **No heatmap** on clock page — heatmap is only on the profile page
- Clicking the "Whistle" wordmark navigates here
- On Sundays: all of the above is hidden, replaced with Sunday experience
- **Loading state**: Do not show elapsed time or working status until the first API response

### Profile (`profile.html`)

- **Profile header image**: Mucha Art Nouveau image as circular crop, ~120px diameter. Images are resized to 300px for fast loading. Random image selected on each page load.
- User info: name, email, cute ID
- **Shift length display** (read-only on profile)
- **Link field** — editable, with subtitle "Share a link to a personal website, social media, or just something you love"
- **Statistics section** (in its own boxed card):
  - Inline prose with highlighted dynamic values (highlight color: `#6C7A61` green):
    > "In **2026** you have clocked in on **47 days** and completed **312 hours** of work. On a median day you worked **6 hours and 38 minutes**."
    > "You usually clock in at **8:30 AM** and clock out at **5:15 PM**."
- **Heatmap** immediately below the statistics card
  - Hover interaction shows details below the heatmap
- **Session history**: Scrollable list of all sessions
  - Sessions from current/previous month can be edited (max 3 edits/month) or deleted
  - Shows duration and shift-met status per session
- **Change password**, **Export to CSV**, **Delete account**

### Factory Floor (`leaderboard.html`)

- **Public page** — no authentication required
- **Today-only table** — no year view, no toggle
- **On Sundays**: Table is hidden. Left-aligned poem displayed instead.
- Hidden users are excluded from all queries
- Names link to the user's profile link (if set), otherwise plain text

**Table columns:** Rank, Name (with cute ID), Today Hours

**Today column behavior:**
- Active users: cell shaded `#8F3416`, value ticks in realtime
- Inactive users: regular text color

**Polling**: Every 30 seconds. Active timers tick every 1 second client-side.

### About (`about.html`)

- Content served from `public/ABOUT.md` markdown file
- Simple client-side markdown rendering (headings, paragraphs, bold, lists)
- Navigation adapts based on auth status

## Navigation

All authenticated pages show: **Factory Floor** · **About** · **Profile** · **Sign Out**

**Sign Out behavior**: If the user is currently clocked in, a warning is shown ("Signing out will clock you out. Continue?"). The server auto-closes any open session on logout.

The "Whistle" wordmark always links to `app.html`.

### Timezone Strategy

All time-of-day rules are evaluated in the user's timezone:
- On clock-in, the frontend sends the user's IANA timezone
- Stored as `start_timezone` on the time entry
- Server-side auto-close uses the stored timezone
- "Today" Factory Floor accepts viewer's timezone as query parameter

## Color Scheme

### Core Colors

| Color | Hex | Usage |
|---|---|---|
| Warm pink | `#F5DCC3` | Page background |
| Warm surface | `#EBCAA0` | Card backgrounds, boxed content |
| Golden brown | `#C4956A` | Borders (light/transparent), links, interactive elements |
| White-ish | `#EDE9E2` | Heatmap empty cells |
| Warm grey | `#8A7D73` | Secondary text, muted elements |
| Near-black | `#1A1714` | Primary text |

### Highlight Colors

| Color | Hex | Usage |
|---|---|---|
| Terracotta | `#8F3416` | Buttons, danger zone, active/working state on Factory Floor |
| Green | `#5E7252` | Heatmap level 4, hover states |
| Light green | `#6C7A61` | Clock In button, stat highlights, accent numbers/metrics |

### Heatmap (Green scheme)

Fixed thresholds using `#6C7A61` at varying opacity:

- Level 4 (10+ hours): `#5E7252` at 100%
- Level 3 (6–10 hours): `rgba(108, 122, 97, 0.75)`
- Level 2 (3–6 hours): `rgba(108, 122, 97, 0.5)`
- Level 1 (0.1–3 hours): `rgba(108, 122, 97, 0.25)`
- Level 0 (no work): `#EDE9E2`
- Sundays: `#EBCAA0`

### Typography

- **Font**: Kalice (self-hosted, woff2/woff files in `public/fonts/`)
- **Headings**: Negative letter-spacing (-0.01em) for a tighter feel
- **Body**: Standard case

### Decorative Accents

Art Nouveau aesthetic: decorative ornaments, elegant card layouts, warm tones. Footer illustration links to the About page.

## UI Specifications

### Box Borders

All card and box borders are **1px solid** `rgba(196, 149, 106, 0.3)` (light, transparent golden brown).

### Content Width

Primary content column: ~720px max-width.

### Spacing & Padding

Compact spacing throughout. The punch clock page should fit on screen without scrolling at 1080p+.

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Log in |
| POST | `/api/auth/logout` | Log out (auto-clocks out any open session) |
| GET | `/api/auth/me` | Get current user info (includes link, shift_changes_remaining) |
| POST | `/api/auth/me` | Change password |
| PUT | `/api/auth/me` | Update profile link or change shift length |

### Time
| Method | Path | Description |
|---|---|---|
| POST | `/api/time/clock-in` | Start a work session (one per day) |
| POST | `/api/time/clock-out` | End current work session |
| GET | `/api/time/status` | Current status + year total + today's session |
| GET | `/api/time/heatmap` | Daily totals for heatmap |
| GET | `/api/time/stats` | Statistics including median clock times |
| GET | `/api/time/sessions` | Session history for profile |
| PUT | `/api/time/sessions` | Edit a session |
| DELETE | `/api/time/sessions` | Delete a session |
| GET | `/api/time/sessions?export=csv` | Export entries as JSON for CSV |

### Factory Floor
| Method | Path | Description |
|---|---|---|
| GET | `/api/leaderboard?view=year` | Yearly rankings (excludes hidden users) |
| GET | `/api/leaderboard?view=today` | Today's activity with links (excludes hidden users) |

### Account
| Method | Path | Description |
|---|---|---|
| DELETE | `/api/account/delete` | Delete account (sends notification email via Resend) |

## Database Schema

### `users` table
```sql
id              SERIAL PRIMARY KEY
email           VARCHAR(255) UNIQUE NOT NULL
name            VARCHAR(255) NOT NULL
password_hash   VARCHAR(255) NOT NULL
session_token   VARCHAR(255)
cute_id         VARCHAR(100) UNIQUE NOT NULL
shift_length    INTEGER NOT NULL DEFAULT 8  -- 4 to 10 hours
link            VARCHAR(500)               -- optional personal link
created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
```

### `time_entries` table
```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
start_time      TIMESTAMP WITH TIME ZONE NOT NULL
end_time        TIMESTAMP WITH TIME ZONE
start_timezone  VARCHAR(100) NOT NULL
created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
```

### `session_edits` table
```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
entry_id        INTEGER NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE
edited_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
old_start_time  TIMESTAMP WITH TIME ZONE NOT NULL
old_end_time    TIMESTAMP WITH TIME ZONE
new_start_time  TIMESTAMP WITH TIME ZONE NOT NULL
new_end_time    TIMESTAMP WITH TIME ZONE NOT NULL
```

### `shift_length_changes` table
```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
old_length      INTEGER NOT NULL
new_length      INTEGER NOT NULL
changed_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
```

## iOS App

Located at `ios/Whistle/` within the monorepo.

### Features (intentionally minimal)
- Login screen (email + password)
- "Create account" button directs user to the website
- Clock in / Clock out button with current state display
- Elapsed time display when clocked in
- Time restriction enforcement shown client-side
- Art Nouveau styling matching the web app

### What the iOS app does NOT include
- No registration flow (website only)
- No stats, heatmap, Factory Floor, or session history
- No profile management, password change, or account deletion

### Tech
- SwiftUI, iOS 16+ minimum
- Same API endpoints and cookie-based auth

## Project Structure

```
whistle/
├── api/                        # Backend API endpoints
│   ├── _helpers.js             # Shared helpers (DB, auth, time rules, hidden users)
│   ├── auth/
│   │   ├── register.js
│   │   ├── login.js
│   │   ├── logout.js
│   │   └── me.js              # GET: user info, POST: change password
│   ├── time/
│   │   ├── clock-in.js         # One session per day
│   │   ├── clock-out.js
│   │   ├── status.js           # Returns today_session for completed days
│   │   ├── heatmap.js
│   │   ├── stats.js            # Includes median clock-in/out times
│   │   └── sessions.js         # List, edit, export
│   ├── leaderboard.js          # Factory Floor API, excludes hidden users
│   └── account/
│       └── delete.js
├── public/                     # Frontend files
│   ├── index.html
│   ├── app.html
│   ├── profile.html
│   ├── leaderboard.html
│   ├── about.html              # Renders ABOUT.md
│   ├── ABOUT.md                # About page content
│   ├── css/
│   │   └── style.css           # Kalice font, new color scheme
│   ├── js/
│   │   ├── auth.js
│   │   ├── app.js              # Punch clock with timestamps
│   │   ├── profile.js
│   │   └── leaderboard.js
│   ├── fonts/
│   │   ├── Kalice-Regular.woff2
│   │   ├── Kalice-Regular.woff
│   │   ├── Kalice-Bold.woff2
│   │   ├── Kalice-Bold.woff
│   │   ├── Kalice-Medium.woff2
│   │   ├── Kalice-Medium.woff
│   │   ├── Kalice-Italic.woff2
│   │   └── Kalice-Italic.woff
│   ├── pics/
│   │   ├── sunday.png
│   │   └── profile-headers/    # Mucha images (300px, ~200KB each)
│   └── data/
│       └── poems.js
├── whistle-resources/          # Source design assets
├── ios/                        # iOS app (SwiftUI)
├── db/
│   └── schema.sql
├── package.json
├── vercel.json
└── SPEC.md
```

## Environment Variables

| Variable | Description |
|---|---|
| `POSTGRES_URL` | Vercel Postgres connection string |
| `ANTHROPIC_API_KEY` | Claude API key for name validation |
| `RESEND_API_KEY` | Resend API key for account deletion notification emails |

## Setup Instructions

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Link to Vercel

```bash
vercel link
```

### Step 3: Create Postgres Database

In the Vercel dashboard, create a Postgres database under the Storage tab.

### Step 4: Run Schema

Copy `db/schema.sql` into the Vercel Postgres query editor and run it.

### Step 5: Set Environment Variables

Add `ANTHROPIC_API_KEY` in Vercel dashboard → Settings → Environment Variables.

### Step 6: Run Locally

```bash
vercel dev
```

### Step 7: Deploy

```bash
vercel --prod
```

## License

MIT
