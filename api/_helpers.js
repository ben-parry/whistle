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
// Create a connection pool using the POSTGRES_URL environment variable

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

// ============================================
// SQL TAGGED TEMPLATE FUNCTION
// ============================================
// This mimics the @vercel/postgres sql`` syntax so we don't have to change all queries

async function sql(strings, ...values) {
    // Convert tagged template to parameterized query
    // sql`SELECT * FROM users WHERE id = ${id}` becomes
    // query('SELECT * FROM users WHERE id = $1', [id])

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
// PARSE COOKIES FROM REQUEST
// ============================================
// Cookies are sent in the "Cookie" header as a string like "name=value; other=123"
// This function turns that string into an object like { name: "value", other: "123" }

function parseCookies(request) {
    // Get the Cookie header from the request
    const cookieHeader = request.headers.cookie || '';

    // Use the cookie library to parse it into an object
    return cookie.parse(cookieHeader);
}

// ============================================
// GET CURRENT USER FROM SESSION
// ============================================
// Checks if the request has a valid session cookie and returns the user
// Returns null if not logged in

async function getCurrentUser(request) {
    // Parse the cookies from the request
    const cookies = parseCookies(request);

    // Get the session token from cookies
    const sessionToken = cookies.session;

    // If there's no session cookie, user is not logged in
    if (!sessionToken) {
        return null;
    }

    // Look up the user by their session token in the database
    const result = await sql`
        SELECT id, email, created_at
        FROM users
        WHERE session_token = ${sessionToken}
    `;

    // If no user found with this session, they're not logged in
    if (result.rows.length === 0) {
        return null;
    }

    // Return the user object
    return result.rows[0];
}

// ============================================
// CREATE A SESSION COOKIE
// ============================================
// Creates the Set-Cookie header value for logging in

function createSessionCookie(sessionToken) {
    return cookie.serialize('session', sessionToken, {
        httpOnly: true,      // JavaScript can't access this cookie (security)
        secure: process.env.NODE_ENV === 'production',  // HTTPS only in production
        sameSite: 'lax',     // Prevents some cross-site attacks
        maxAge: 60 * 60 * 24 * 30,  // 30 days in seconds
        path: '/'            // Cookie works for all pages
    });
}

// ============================================
// CREATE A LOGOUT COOKIE
// ============================================
// Creates a Set-Cookie header that deletes the session cookie

function createLogoutCookie() {
    return cookie.serialize('session', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,           // Expires immediately (deletes the cookie)
        path: '/'
    });
}

// ============================================
// SEND JSON RESPONSE
// ============================================
// Helper to send a JSON response with proper headers

function sendJson(response, statusCode, data) {
    response.status(statusCode).json(data);
}

// ============================================
// SEND ERROR RESPONSE
// ============================================
// Helper to send an error response

function sendError(response, statusCode, message) {
    response.status(statusCode).json({ error: message });
}

// ============================================
// VALIDATE EMAIL FORMAT
// ============================================
// Simple check that email looks valid

function isValidEmail(email) {
    // This regex checks for: something@something.something
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ============================================
// EXPORTS
// ============================================
// Make these functions available to other files

module.exports = {
    sql,
    parseCookies,
    getCurrentUser,
    createSessionCookie,
    createLogoutCookie,
    sendJson,
    sendError,
    isValidEmail
};
