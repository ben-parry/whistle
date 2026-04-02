// ============================================
// LEADERBOARD.JS - Factory Floor Page Logic
// ============================================

let todayData = [];
let timerInterval = null;
let pollInterval = null;
let dataLoaded = false;

document.addEventListener('DOMContentLoaded', function() {

    const navLinks = document.getElementById('nav-links');

    // ============================================
    // SETUP NAV BASED ON AUTH STATUS
    // ============================================

    setupNav();

    async function setupNav() {
        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();

            if (data.user) {
                navLinks.innerHTML =
                    '<a href="/leaderboard.html" class="nav-link">Factory Floor</a>' +
                    '<a href="/about.html" class="nav-link">About</a>' +
                    '<a href="/profile.html" class="nav-link">Profile</a>' +
                    '<button id="logout-btn" class="nav-link button-link">Sign Out</button>';

                document.getElementById('logout-btn').addEventListener('click', async function() {
                    try {
                        const statusRes = await fetch('/api/time/status');
                        const statusData = await statusRes.json();
                        if (statusData.is_working) {
                            if (!confirm('Signing out will clock you out. Continue?')) return;
                        }
                        await fetch('/api/auth/logout', { method: 'POST' });
                        window.location.href = '/index.html';
                    } catch (e) {
                        window.location.href = '/index.html';
                    }
                });
            } else {
                navLinks.innerHTML =
                    '<a href="/leaderboard.html" class="nav-link">Factory Floor</a>' +
                    '<a href="/about.html" class="nav-link">About</a>' +
                    '<a href="/index.html" class="nav-link">Sign In</a>';
            }
        } catch (error) {
            navLinks.innerHTML =
                '<a href="/leaderboard.html" class="nav-link">Factory Floor</a>' +
                '<a href="/about.html" class="nav-link">About</a>' +
                '<a href="/index.html" class="nav-link">Sign In</a>';
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    if (!checkSunday()) {
        loadData();
        pollInterval = setInterval(loadData, 30000);
    }

});

// ============================================
// SUNDAY POEM
// ============================================

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function checkSunday() {
    if (new Date().getDay() === 0) {
        document.getElementById('leaderboard-table').hidden = true;

        var sundayContent = document.getElementById('sunday-content');
        sundayContent.hidden = false;

        if (window.poems && window.poems.length > 0) {
            var weekNum = getWeekNumber(new Date());
            var poem = window.poems[weekNum % window.poems.length];
            document.getElementById('poem-title').textContent = poem.title;
            document.getElementById('poem-text').textContent = poem.text;
            document.getElementById('poem-attribution').textContent = poem.poet + ', ' + poem.year;
        }
        return true;
    }
    return false;
}

// ============================================
// DATA LOADING
// ============================================

async function loadData() {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
        const todayRes = await fetch('/api/leaderboard?view=today&timezone=' + encodeURIComponent(timezone));
        const todayJson = await todayRes.json();

        todayData = todayJson.entries || [];
        dataLoaded = true;

        renderTable();
        startActiveTimers();
    } catch (err) {
        console.error('Failed to load leaderboard:', err);
    }
}

// ============================================
// RENDERING
// ============================================

function renderTable() {
    if (!dataLoaded) return;

    const tbody = document.getElementById('leaderboard-body');

    var rows = todayData.filter(function(r) {
        return r.total_hours_today > 0 || r.is_active;
    });

    // Sort by current hours (active users get live calculation)
    rows.sort(function(a, b) {
        var aHours = a.is_active ? getCurrentHours(a) : a.total_hours_today;
        var bHours = b.is_active ? getCurrentHours(b) : b.total_hours_today;
        return bHours - aHours;
    });

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="leaderboard-empty">No activity yet today.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map(function(row, i) {
        var rank = i + 1;

        // Name with optional link
        var nameHtml;
        if (row.link) {
            nameHtml = '<a href="' + escapeAttr(row.link) + '" target="_blank" rel="noopener" class="leaderboard-name">' + escapeHtml(row.name) + '</a>';
        } else {
            nameHtml = '<span class="leaderboard-name">' + escapeHtml(row.name) + '</span>';
        }

        var todayFormatted;
        var todayCellClass = '';
        var todayCellId = '';

        if (row.is_active) {
            var currentHours = getCurrentHours(row);
            todayFormatted = formatHours(currentHours);
            todayCellClass = ' class="today-active"';
            todayCellId = ' id="today-' + CSS.escape(row.cute_id) + '"';
        } else {
            todayFormatted = row.total_hours_today > 0 ? formatHours(row.total_hours_today) : '\u2014';
        }

        return '<tr>' +
            '<td class="leaderboard-rank">' + rank + '</td>' +
            '<td>' + nameHtml +
                '<span class="leaderboard-cute-id">' + escapeHtml(row.cute_id) + '</span></td>' +
            '<td' + todayCellClass + todayCellId + '>' + todayFormatted + '</td>' +
        '</tr>';
    }).join('');
}

// ============================================
// ACTIVE TIMERS
// ============================================

function getCurrentHours(row) {
    if (!row.is_active || !row.active_since) return row.total_hours_today;
    var activeElapsed = (Date.now() - new Date(row.active_since).getTime()) / (1000 * 60 * 60);
    return row.total_hours_today + activeElapsed;
}

function formatHours(hours) {
    var h = Math.floor(hours);
    var m = Math.floor((hours - h) * 60);
    var s = Math.floor(((hours - h) * 60 - m) * 60);
    if (h > 0) {
        return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    return '0:' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function startActiveTimers() {
    if (timerInterval) clearInterval(timerInterval);

    var hasActive = todayData.some(function(u) { return u.is_active; });
    if (!hasActive) return;

    timerInterval = setInterval(function() {
        todayData.forEach(function(u) {
            if (!u.is_active) return;
            var cell = document.getElementById('today-' + CSS.escape(u.cute_id));
            if (cell) {
                var hours = getCurrentHours({
                    total_hours_today: parseFloat(u.total_hours_today) || 0,
                    is_active: true,
                    active_since: u.active_since
                });
                cell.textContent = formatHours(hours);
            }
        });
    }, 1000);
}

// ============================================
// HELPERS
// ============================================

function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
