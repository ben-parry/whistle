# Whistle

A simple, beautiful punch clock web app with Art Nouveau styling.

## What is Whistle?

Whistle is a personal time tracking app. You clock in when you start working, clock out when you stop, and Whistle keeps track of all your hours. Features include:

- **Simple punch clock** - One button to clock in/out
- **Year total** - See how many hours you've worked this year
- **Heatmap visualization** - GitHub-style calendar showing work per day
- **CSV export** - Download all your time entries
- **Multi-user** - Each person has their own account

## Tech Stack

- **Frontend**: Plain HTML, CSS, and JavaScript (no frameworks!)
- **Backend**: Node.js with Vercel serverless functions
- **Database**: Vercel Postgres
- **Hosting**: Vercel

## Setup Instructions

### Step 1: Install Vercel CLI

If you don't have the Vercel CLI installed:

```bash
npm install -g vercel
```

### Step 2: Install Dependencies

Navigate to the project folder and install dependencies:

```bash
cd whistle
npm install
```

### Step 3: Create a Vercel Project

Link this folder to a new Vercel project:

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

### Step 6: Run Locally

Start the development server:

```bash
vercel dev
```

Open http://localhost:3000 in your browser.

### Step 7: Deploy

When you're ready to deploy to production:

```bash
vercel --prod
```

Vercel will give you a URL like `https://whistle-xxx.vercel.app`.

## Project Structure

```
whistle/
├── api/                    # Backend API endpoints
│   ├── _helpers.js         # Shared helper functions
│   ├── auth/
│   │   ├── register.js     # Create new account
│   │   ├── login.js        # Log in
│   │   ├── logout.js       # Log out
│   │   └── me.js           # Get current user
│   ├── time/
│   │   ├── clock-in.js     # Start working
│   │   ├── clock-out.js    # Stop working
│   │   ├── status.js       # Current status + year total
│   │   ├── entries.js      # All entries (for export)
│   │   └── heatmap.js      # Daily totals (for heatmap)
│   └── account/
│       └── delete.js       # Delete account
├── public/                 # Frontend files
│   ├── index.html          # Login/register page
│   ├── app.html            # Main punch clock page
│   ├── profile.html        # Profile & export page
│   ├── css/
│   │   └── style.css       # All styles
│   └── js/
│       ├── auth.js         # Login/register logic
│       ├── app.js          # Punch clock logic
│       └── profile.js      # Profile page logic
├── db/
│   └── schema.sql          # Database table definitions
├── package.json
├── vercel.json             # Vercel configuration
└── README.md               # This file!
```

## Understanding the Code

### How Authentication Works

1. When you register, your password is hashed (turned into a secure code that can't be reversed)
2. A random "session token" is created and stored in both:
   - The database (linked to your user account)
   - A cookie in your browser
3. When you visit any page, the app checks if you have a valid session cookie
4. On logout, the cookie is deleted and the token is removed from the database

### How Time Tracking Works

1. When you clock in:
   - A new time entry is created with your user ID and the current time
   - The entry has no end time yet (NULL)
2. When you clock out:
   - The open entry is found and updated with the end time
   - If you've been clocked in for over 15 hours, it auto-clocks you out at 15 hours
3. The heatmap shows the sum of hours worked each day
4. The year total shows the sum of all completed sessions this calendar year

### Key Files to Explore

- `api/_helpers.js` - Reusable functions used across all API endpoints
- `api/auth/login.js` - Good example of how an API endpoint works
- `public/js/app.js` - Main punch clock logic with lots of comments
- `public/css/style.css` - All the styling with the Art Nouveau touches

## Customization

### Change the Admin Email

In `public/index.html`, find the "Forgot password?" line and update the email:

```html
<p class="forgot-password">
    Forgot your password? Contact <a href="mailto:your-email@example.com">your-email@example.com</a>
</p>
```

### Change Colors

All colors are defined at the top of `public/css/style.css`. The main ones:

```css
- Background: #F5F0E6 (aged cream)
- Primary text: #2C2416 (deep brown)
- Accent: #8B4513 (saddle brown / brick)
- Secondary: #D4A574 (warm ochre)
- Button: #5C4033 (dark earth)
```

### Add More Decorative Elements

The CSS includes some subtle Art Nouveau touches using Unicode characters:
- `\2766` - Floral heart
- `\2619` - Reversed rotated floral heart
- `\2726` - Four-pointed star

You can find more at: https://unicode-table.com/en/sets/flowers/

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

## License

MIT - Feel free to use this however you like!
