# Whistle

A hyper-opinionated, beautifully crafted punch clock web app with Art Nouveau styling and a native iOS companion.

## What is Whistle?

Whistle is an opinionated time tracking app for people who believe work has its hours and rest has its own. You clock in when you start working, clock out when you stop, and Whistle keeps track of everything — with guardrails.

### Core Philosophy

Whistle enforces boundaries. Work happens between 5am and 9pm, never on Sundays, and never more than 12 hours in a day. If you forget to clock out, Whistle clocks you out at 9pm. On Sundays, you'll be reminded to seize the means of relaxation.

### Features

- **Simple punch clock** — One button to clock in/out
- **Year total** — Hours worked this year with progress bar toward 2,333 hours
- **Heatmap visualization** — GitHub-style calendar showing daily work (Sundays greyed out)
- **Public leaderboard** — See who's working today (realtime) and yearly totals
- **Session history** — View and edit recent sessions (with limits)
- **Statistics** — Inline prose summary of your year
- **CSV export** — Download all your time entries
- **Change password** — Self-service password changes
- **Native iOS app** — Minimal companion for clock in/out on the go
- **Multi-user** — Each person gets a name, a cute three-word ID, and their own account

## Tech Stack

- **Frontend**: Plain HTML, CSS, and JavaScript (no frameworks)
- **Backend**: Node.js with Vercel serverless functions
- **Database**: Vercel Postgres (via `pg`)
- **iOS App**: SwiftUI (iOS 16+)
- **Hosting**: Vercel
- **Email**: Resend (for account deletion notifications)
- **AI**: Anthropic Claude API (for name validation on registration)

### Dependencies

- `pg` — PostgreSQL client
- `bcryptjs` — Password hashing
- `cookie` — Cookie parsing/serialization
- `uuid` — Session token generation
- `resend` — Transactional email (account deletion notifications)
- `@anthropic-ai/sdk` — Name validation during registration

## Time Tracking Rules

These rules are enforced on both client and server:

| Rule | Detail |
|---|---|
| **Working hours** | 5:00 AM – 9:00 PM only |
| **Daily maximum** | 12 hours per calendar day (across all sessions) |
| **Sundays** | No work allowed. Message: "It is Sunday, let us seize the means of relaxation." with a link to [lavitalenta](https://x.com/lavitalenta) |
| **Auto clock-out** | If a session is still open at 9:00 PM, it is automatically closed with `end_time = 21:00`. Enforced server-side on next status check and client-side in realtime. |
| **No Saturday restriction** | Saturdays follow the standard 5am–9pm rules (the old 6pm Saturday cutoff is removed) |

## User Identity

### Name

Every user must provide a real name at registration. Names are validated:
- Must contain only Unicode letters (no numbers)
- No more than one consecutive space between parts
- Multi-part names are fine (e.g., "María José", "李明")
- Validated by Claude API as a plausible real name from any language/culture (fails open — if API is unavailable, regex-only validation is accepted)
- Displayed on the leaderboard (email is never shown publicly)

### Cute ID

Every user is automatically assigned a unique three-word identifier in the format:

> `Adjective-CraftWord-Noun`

Examples: `Steady-Wright-Oak`, `Bold-Weaver-Fern`, `Keen-Cooper-Lark`

The middle word is always from an artisan/craftsman theme: Mason, Tinker, Smith, Carver, Joiner, Wright, Cooper, Weaver, Artificer, etc.

This ID is displayed alongside the user's name on the leaderboard and profile.

## Pages

### Login / Register (`index.html`)

- Tabbed form for Sign In and Create Account
- Registration requires: email, password (8+ chars), and name (validated)
- "Forgot password?" links to admin email
- Link to About page

### Punch Clock (`app.html`)

- Main working interface
- Big clock in/out button with elapsed time display
- Year total with progress bar (goal: 2,333 hours)
- GitHub-style heatmap for the current year
  - Sundays are uniformly greyed out regardless of data
  - Heatmap color: `#4380E4` at full opacity for the most hours, decreasing opacity for fewer hours
- Clicking the "Whistle" wordmark navigates here

### Profile (`profile.html`)

- User info: name, email, cute ID
- **Statistics section**: Inline prose with highlighted dynamic values:
  > "In **2026** you have clocked in on **47 days** and completed **312 hours** of work. On a median day you have worked **6 hours and 38 minutes**."
- **Session history**: Scrollable list of all sessions with start/end times
  - Sessions from the previous calendar month and current month can be edited (start and end time)
  - One edit operation = one count toward the limit (even if both start and end time change)
  - Editing the same session again counts as another edit
  - Maximum 3 edits per calendar month (resets on the 1st)
  - Edits must conform to all time rules (5am–9pm, 12h/day max, no Sundays, no overlaps with other sessions)
  - Warning shown before each edit attempt showing remaining edits
- **Change password**: Requires current password, new password (8+ chars), confirmation
- **Export to CSV**: Download all time entries
- **Delete account**: Shows confirmation modal with option to download CSV first (with warning this is their last chance), then deletes all data and sends email to ben@benparry.ca via Resend

### Leaderboard (`leaderboard.html`)

- **Public page** — no authentication required
- Two views toggled by tabs:

**Yearly View:**
- All users ranked by total hours worked this calendar year
- Shows: rank, name, cute ID, total sessions, total hours

**Today View:**
- All users who have logged any time today
- Shows: name, cute ID, total time today, active indicator (if currently clocked in)
- Active sessions show a live-ticking timer (client-side, between polls)
- Data refreshes via polling every 30 seconds (seamless, no loading indicators)

### About (`about.html`)

- Static content page (currently placeholder text)
- Navigation adapts based on auth status

## Navigation

All authenticated pages show navigation links in this fixed order:

> **Leaderboard** · **About** · **Profile** · **Sign Out**

The "Whistle" wordmark/logo always links to the punch clock (`app.html`).

The leaderboard page shows navigation consistent with other pages (Leaderboard link active/highlighted).

### Timezone Strategy

All time-of-day rules (5am–9pm, Sunday check, 12h/day limit) are evaluated in the **user's timezone**:
- On clock-in, the frontend sends the user's IANA timezone (e.g., `America/Toronto`)
- This is stored as `start_timezone` on the time entry
- For server-side auto-close and rule enforcement, the stored `start_timezone` is used
- The "today" leaderboard accepts the viewer's timezone as a query parameter to define day boundaries

## Color Scheme

### Core Colors

| Color | Hex | Usage |
|---|---|---|
| Warm cream | `#F0EAD9` | Page background |
| Sand | `#E3D7BF` | Card backgrounds, secondary surfaces |
| Sage | `#C2CDCD` | Borders, subtle accents |
| Warm grey | `#9D8F86` | Secondary text, muted elements |
| Deep charcoal | `#332F35` | Primary text |

### Highlight Colors

| Color | Hex | Usage |
|---|---|---|
| Terracotta | `#D38370` | Warnings, danger zone, active/working state |
| Steel blue | `#4380A4` | Links, interactive elements |

### Heatmap

Fixed thresholds using `#4380E4` at varying opacity:

- Level 4 (10+ hours): `#4380E4` at 100% opacity
- Level 3 (6–10 hours): `#4380E4` at ~70% opacity
- Level 2 (3–6 hours): `#4380E4` at ~45% opacity
- Level 1 (0.1–3 hours): `#4380E4` at ~20% opacity
- Level 0 (no work): Background color (`#F0EAD9`)
- Sundays: Uniformly `#E3D7BF` regardless of data

All styling must maintain the existing Art Nouveau aesthetic: Playfair Display font, decorative ornaments, elegant card layouts, warm tones.

## API Endpoints

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account (email, password, name) |
| POST | `/api/auth/login` | Log in |
| POST | `/api/auth/logout` | Log out |
| GET | `/api/auth/me` | Get current user info |
| POST | `/api/auth/change-password` | Change password (requires current password) |

### Time
| Method | Path | Description |
|---|---|---|
| POST | `/api/time/clock-in` | Start a work session |
| POST | `/api/time/clock-out` | End current work session |
| GET | `/api/time/status` | Current status + year total (auto-closes stale sessions) |
| GET | `/api/time/entries` | All entries for CSV export |
| GET | `/api/time/heatmap` | Daily totals for heatmap |
| PUT | `/api/time/edit` | Edit a session's start/end time |
| GET | `/api/time/stats` | Statistics for the stats sentence |
| GET | `/api/time/sessions` | Paginated session history for profile |

### Leaderboard
| Method | Path | Description |
|---|---|---|
| GET | `/api/leaderboard/year` | Yearly rankings (all users) |
| GET | `/api/leaderboard/today` | Today's activity (all users) |

### Account
| Method | Path | Description |
|---|---|---|
| DELETE | `/api/account/delete` | Delete account (sends email via Resend) |

## Database Schema

### `users` table
```sql
id              SERIAL PRIMARY KEY
email           VARCHAR(255) UNIQUE NOT NULL
name            VARCHAR(255) NOT NULL
password_hash   VARCHAR(255) NOT NULL
session_token   VARCHAR(255)
cute_id         VARCHAR(100) UNIQUE NOT NULL
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

### `session_edits` table (new)
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

The `session_edits` table tracks edit history and is used to enforce the 3-edits-per-calendar-month limit.

## iOS App

Located at `ios/Whistle/` within the monorepo.

### Features (intentionally minimal)
- Login screen (email + password)
- "Create account" button directs user to the website
- Clock in / Clock out button with current state display
- Elapsed time display when clocked in
- Time restriction enforcement (5am–9pm, no Sundays) shown client-side
- Subtle prompt: "Visit whistle on the web for stats, history, and more"
- Art Nouveau styling matching the web app (Playfair Display, warm tones)

### What the iOS app does NOT include
- No registration flow (website only)
- No stats, heatmap, leaderboard, or session history
- No profile management, password change, or account deletion
- No CSV export

### Tech
- SwiftUI, iOS 16+ minimum
- Communicates with the same API endpoints as the web app
- Same cookie-based session auth

## Project Structure

```
whistle/
├── api/                        # Backend API endpoints
│   ├── _helpers.js             # Shared helper functions
│   ├── auth/
│   │   ├── register.js         # Create account (with name + cute ID)
│   │   ├── login.js            # Log in
│   │   ├── logout.js           # Log out
│   │   ├── me.js               # Get current user
│   │   └── change-password.js  # Change password
│   ├── time/
│   │   ├── clock-in.js         # Start working
│   │   ├── clock-out.js        # Stop working
│   │   ├── status.js           # Current status + year total
│   │   ├── entries.js          # All entries (for CSV export)
│   │   ├── heatmap.js          # Daily totals (for heatmap)
│   │   ├── edit.js             # Edit a session (with limits)
│   │   ├── stats.js            # Statistics for profile
│   │   └── sessions.js         # Session history for profile
│   ├── leaderboard/
│   │   ├── year.js             # Yearly leaderboard
│   │   └── today.js            # Today's leaderboard
│   └── account/
│       └── delete.js           # Delete account + email notification
├── public/                     # Frontend files
│   ├── index.html              # Login/register page
│   ├── app.html                # Main punch clock page
│   ├── profile.html            # Profile, stats, sessions, settings
│   ├── leaderboard.html        # Public leaderboard
│   ├── about.html              # About page
│   ├── css/
│   │   └── style.css           # All styles (Art Nouveau theme)
│   └── js/
│       ├── auth.js             # Login/register logic
│       ├── app.js              # Punch clock logic
│       ├── profile.js          # Profile page logic
│       └── leaderboard.js      # Leaderboard logic
├── ios/                        # iOS app (SwiftUI)
│   └── Whistle/
│       ├── Whistle.xcodeproj
│       └── Whistle/
│           ├── WhistleApp.swift
│           ├── Views/
│           ├── Models/
│           └── Assets.xcassets
├── db/
│   └── schema.sql              # Database table definitions
├── package.json
├── vercel.json                 # Vercel configuration
└── README.md                   # This file
```

## Environment Variables

| Variable | Description |
|---|---|
| `POSTGRES_URL` | Vercel Postgres connection string |
| `ANTHROPIC_API_KEY` | Claude API key for name validation |
| `RESEND_API_KEY` | Resend API key for deletion emails |

## Setup Instructions

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Install Dependencies

```bash
cd whistle
npm install
```

### Step 3: Create a Vercel Project

```bash
vercel link
```

Follow the prompts to create a new project.

### Step 4: Create a Postgres Database

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project
3. Go to the "Storage" tab
4. Click "Create Database" → "Postgres"
5. Follow the prompts to create a database
6. Once created, Vercel will automatically add the database environment variables to your project

### Step 5: Set Up the Database Tables

1. In the Vercel dashboard, go to your Postgres database
2. Click on the "Query" tab
3. Copy the contents of `db/schema.sql` and paste it into the query editor
4. Click "Run" to create the tables

### Step 6: Set Environment Variables

Add the following in Vercel dashboard → Settings → Environment Variables:
- `ANTHROPIC_API_KEY` — Your Claude API key (for name validation)
- `RESEND_API_KEY` — Your Resend API key (for deletion emails)

### Step 7: Run Locally

```bash
vercel dev
```

Open http://localhost:3000 in your browser.

### Step 8: Deploy

```bash
vercel --prod
```

## Troubleshooting

### "Invalid email or password" on login
- Make sure you registered first
- Check that you're using the correct email (it's case-insensitive)

### Database errors
- Make sure you ran the schema.sql in your Vercel Postgres dashboard
- Check that your Vercel project is linked to the database

### Changes not showing
- Try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- For API changes, restart `vercel dev`

### Name rejected at registration
- Names must be real names from any language/culture
- No numbers allowed
- Nicknames, handles, and joke names will be rejected by the AI validator

## License

MIT — Feel free to use this however you like!
