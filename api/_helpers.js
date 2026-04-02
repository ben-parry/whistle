// ============================================
// SHARED HELPER FUNCTIONS
// ============================================
// This file contains helper functions used by multiple API endpoints.
// The underscore prefix (_helpers.js) tells Vercel this is NOT an API route.
// ============================================

const { Pool } = require('pg');
const cookie = require('cookie');

// ============================================
// DATABASE CONNECTION
// ============================================

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

// ============================================
// SQL TAGGED TEMPLATE FUNCTION
// ============================================

async function sql(strings, ...values) {
    let query = '';
    for (let i = 0; i < strings.length; i++) {
        query += strings[i];
        if (i < values.length) {
            query += `$${i + 1}`;
        }
    }
    const result = await pool.query(query, values);
    return result;
}

// ============================================
// CONSTANTS
// ============================================

const WORK_START_HOUR = 5;   // 5:00 AM
const WORK_END_HOUR = 21;    // 9:00 PM
const MAX_DAILY_HOURS = 12;
const MIN_SHIFT_LENGTH = 4;
const MAX_SHIFT_LENGTH = 10;
const DEFAULT_SHIFT_LENGTH = 8;
const MAX_SHIFT_CHANGES_PER_MONTH = 2;

// ============================================
// CUTE ID WORD LISTS
// ============================================

const ADJECTIVES = [
    'Nimble', 'Quiet', 'Steady', 'Swift', 'Keen', 'Bold', 'True', 'Fair',
    'Bright', 'Gentle', 'Noble', 'Merry', 'Deft', 'Warm', 'Clear', 'Fine',
    'Grand', 'Able', 'Calm', 'Kind', 'Pure', 'Wise', 'Rare', 'Quick',
    'Light', 'Deep', 'Stout', 'Sure', 'Hale', 'Brave'
];

const CRAFT_WORDS = [
    'Mason', 'Tinker', 'Smith', 'Carver', 'Joiner', 'Wright', 'Cooper',
    'Weaver', 'Artificer', 'Thatcher', 'Turner', 'Glazier', 'Sawyer',
    'Chandler', 'Fletcher', 'Potter', 'Tanner', 'Dyer', 'Scribe', 'Fuller',
    'Gilder', 'Warden', 'Caulker', 'Graver'
];

const NOUNS = [
    'Oak', 'Stone', 'Lark', 'Fox', 'Elm', 'Bell', 'Fern', 'Wren',
    'Birch', 'Brook', 'Dawn', 'Frost', 'Glen', 'Hare', 'Heath', 'Ivy',
    'Jay', 'Lake', 'Moss', 'Pine', 'Rain', 'Reed', 'Rose', 'Snow',
    'Star', 'Thorn', 'Vale', 'Vine', 'Sage', 'Flint'
];

// ============================================
// CUTE ID GENERATION
// ============================================

function generateCuteIdCandidate() {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const craft = CRAFT_WORDS[Math.floor(Math.random() * CRAFT_WORDS.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    return `${adj}-${craft}-${noun}`;
}

async function generateUniqueCuteId() {
    // Try up to 20 times to find a unique combination
    for (let i = 0; i < 20; i++) {
        const candidate = generateCuteIdCandidate();
        const existing = await sql`
            SELECT id FROM users WHERE cute_id = ${candidate}
        `;
        if (existing.rows.length === 0) {
            return candidate;
        }
    }
    // Fallback: append a random 2-digit number
    const fallback = generateCuteIdCandidate() + '-' + Math.floor(Math.random() * 100);
    return fallback;
}

// ============================================
// NAME VALIDATION
// ============================================

function isValidName(name) {
    if (!name || typeof name !== 'string') return false;

    const trimmed = name.trim();

    // Must be between 1 and 100 characters
    if (trimmed.length < 1 || trimmed.length > 100) return false;

    // No numbers allowed
    if (/\d/.test(trimmed)) return false;

    // No more than one consecutive space
    if (/\s{2,}/.test(trimmed)) return false;

    // Must contain at least one Unicode letter
    // \p{L} matches any kind of letter from any language
    if (!/\p{L}/u.test(trimmed)) return false;

    // Only allow Unicode letters, spaces, hyphens, apostrophes, periods, and commas
    // These cover: O'Brien, Mary-Jane, Jr., María José, 李明, etc.
    if (!/^[\p{L}\s\-'.·,]+$/u.test(trimmed)) return false;

    return true;
}

async function validateNameWithLLM(name) {
    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'content-type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 10,
                messages: [{
                    role: 'user',
                    content: `Is "${name}" a plausible real human name from any language or culture? Answer only "yes" or "no". Names can be from any culture, language, or tradition. Be generous — if it could reasonably be someone's name, say yes.`
                }]
            })
        });

        const data = await res.json();
        const answer = data.content[0].text.toLowerCase().trim();
        return answer.startsWith('yes');
    } catch (error) {
        // Fail open: if the API is unavailable, accept the name
        console.error('LLM name validation error (failing open):', error.message);
        return true;
    }
}

// ============================================
// TIME RESTRICTION HELPERS
// ============================================

// Get the current hour and day of week in a given timezone
function getTimeInTimezone(timezone) {
    try {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'short',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
        });
        const parts = formatter.formatToParts(now);

        const weekday = parts.find(p => p.type === 'weekday').value;
        const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
        const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);

        return { weekday, hour, minute };
    } catch (error) {
        console.error('Timezone parse error:', error);
        return null;
    }
}

// Check if a given time in a timezone falls within working hours
// Returns an error message if restricted, null if OK
function checkTimeRestrictions(timezone) {
    const time = getTimeInTimezone(timezone);
    if (!time) return null; // Fail open if timezone is invalid

    // Sunday — all day restricted
    if (time.weekday === 'Sun') {
        return 'sunday';
    }

    // Before 5am — restricted
    if (time.hour < WORK_START_HOUR) {
        return 'before_hours';
    }

    // At or after 9pm — restricted
    if (time.hour >= WORK_END_HOUR) {
        return 'after_hours';
    }

    return null;
}

function getRestrictionMessage(restrictionType) {
    switch (restrictionType) {
        case 'sunday':
            return 'It is Sunday, let us seize the means of relaxation.';
        case 'before_hours':
            return 'Clock in/out is available from 5:00 AM.';
        case 'after_hours':
            return 'Clock in/out is not available after 9:00 PM.';
        case 'daily_limit':
            return 'You have reached the 12-hour daily maximum.';
        default:
            return 'Clock in/out is currently unavailable.';
    }
}

// Get a specific time on a specific date in a timezone, returned as UTC Date
function getTimezoneDateTime(date, timezone, hour, minute) {
    try {
        // Format the date in the target timezone to get the date parts
        const dateFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const dateStr = dateFormatter.format(date); // YYYY-MM-DD

        // Create an ISO string for the desired time in the timezone
        // We'll use a temporary date and adjust for the timezone offset
        const tempDate = new Date(`${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`);

        // Get the offset for this timezone at this time
        const utcFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });

        // Use a known reference point to calculate offset
        const parts = utcFormatter.formatToParts(tempDate);
        const tzYear = parseInt(parts.find(p => p.type === 'year').value);
        const tzMonth = parseInt(parts.find(p => p.type === 'month').value) - 1;
        const tzDay = parseInt(parts.find(p => p.type === 'day').value);
        const tzHour = parseInt(parts.find(p => p.type === 'hour').value);
        const tzMinute = parseInt(parts.find(p => p.type === 'minute').value);

        const tzTime = new Date(Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMinute));
        const offset = tzTime - tempDate;

        // Return the UTC time that corresponds to the desired local time
        return new Date(tempDate.getTime() - offset);
    } catch (error) {
        console.error('getTimezoneDateTime error:', error);
        return null;
    }
}

// Get the 9pm cutoff time for a session based on its start_time and timezone
function get9pmCutoff(startTime, timezone) {
    return getTimezoneDateTime(new Date(startTime), timezone, WORK_END_HOUR, 0);
}

// Auto-close a stale open session
// End time = min(start + 12h, 9pm cutoff)
async function autoCloseStaleSession(entry) {
    const now = new Date();
    const startTime = new Date(entry.start_time);

    // Calculate both caps
    const cutoff9pm = get9pmCutoff(entry.start_time, entry.start_timezone);
    const cutoff12h = new Date(startTime.getTime() + MAX_DAILY_HOURS * 60 * 60 * 1000);

    // Determine the effective end time (earliest cap that's in the past)
    let endTime = cutoff12h;
    if (cutoff9pm && cutoff9pm < endTime) {
        endTime = cutoff9pm;
    }

    // Only close if the cap has passed
    if (now > endTime) {
        await sql`
            UPDATE time_entries
            SET end_time = ${endTime.toISOString()}
            WHERE id = ${entry.id}
            AND end_time IS NULL
        `;
        return true;
    }
    return false;
}

// ============================================
// AUTO-CLOSE ALL STALE SESSIONS
// ============================================

async function autoCloseAllStaleSessions() {
    const openSessions = await sql`
        SELECT id, start_time, start_timezone
        FROM time_entries
        WHERE end_time IS NULL
    `;
    for (const entry of openSessions.rows) {
        await autoCloseStaleSession(entry);
    }
}

// Hidden users — these users are excluded from the public leaderboard
const HIDDEN_USERS = ['ben@benparry.ca'];

// ============================================
// PARSE COOKIES FROM REQUEST
// ============================================

function parseCookies(request) {
    const cookieHeader = request.headers.cookie || '';
    return cookie.parse(cookieHeader);
}

// ============================================
// GET CURRENT USER FROM SESSION
// ============================================

async function getCurrentUser(request) {
    const cookies = parseCookies(request);
    let sessionToken = cookies.session;

    // Also check Authorization header for iOS app support
    if (!sessionToken) {
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            sessionToken = authHeader.substring(7);
        }
    }

    if (!sessionToken) {
        return null;
    }

    const result = await sql`
        SELECT id, email, name, cute_id, shift_length, created_at
        FROM users
        WHERE session_token = ${sessionToken}
    `;

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0];
}

// ============================================
// SESSION COOKIE HELPERS
// ============================================

function createSessionCookie(sessionToken) {
    return cookie.serialize('session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,  // 30 days
        path: '/'
    });
}

function createLogoutCookie() {
    return cookie.serialize('session', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/'
    });
}

// ============================================
// RESPONSE HELPERS
// ============================================

function sendJson(response, statusCode, data) {
    response.status(statusCode).json(data);
}

function sendError(response, statusCode, message) {
    response.status(statusCode).json({ error: message });
}

// ============================================
// VALIDATION HELPERS
// ============================================

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    sql,
    WORK_START_HOUR,
    WORK_END_HOUR,
    MAX_DAILY_HOURS,
    HIDDEN_USERS,
    MIN_SHIFT_LENGTH,
    MAX_SHIFT_LENGTH,
    DEFAULT_SHIFT_LENGTH,
    MAX_SHIFT_CHANGES_PER_MONTH,
    generateUniqueCuteId,
    isValidName,
    validateNameWithLLM,
    checkTimeRestrictions,
    getRestrictionMessage,
    getTimezoneDateTime,
    get9pmCutoff,
    autoCloseStaleSession,
    autoCloseAllStaleSessions,
    getCurrentUser,
    createSessionCookie,
    createLogoutCookie,
    sendJson,
    sendError,
    isValidEmail
};
