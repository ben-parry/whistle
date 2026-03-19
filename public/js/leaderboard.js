// ============================================
// LEADERBOARD.JS - Leaderboard Page Logic
// ============================================

let currentSort = 'year';
let yearData = [];
let todayData = [];
let timerInterval = null;
let pollInterval = null;
let dataLoaded = false;
let lastFetchTime = null;

function setSort(sort) {
    currentSort = sort;
    document.getElementById('sort-year').classList.toggle('active', sort === 'year');
    document.getElementById('sort-today').classList.toggle('active', sort === 'today');
    renderTable();
}

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
                    '<a href="/leaderboard.html" class="nav-link">Leaderboard</a>' +
                    '<a href="/about.html" class="nav-link">About</a>' +
                    '<a href="/profile.html" class="nav-link">Profile</a>' +
                    '<button id="logout-btn" class="nav-link button-link">Sign Out</button>';

                document.getElementById('logout-btn').addEventListener('click', async function() {
                    try {
                        await fetch('/api/auth/logout', { method: 'POST' });
                        window.location.href = '/index.html';
                    } catch (e) {
                        window.location.href = '/index.html';
                    }
                });
            } else {
                navLinks.innerHTML =
                    '<a href="/leaderboard.html" class="nav-link">Leaderboard</a>' +
                    '<a href="/about.html" class="nav-link">About</a>' +
                    '<a href="/index.html" class="nav-link">Sign In</a>';
            }
        } catch (error) {
            navLinks.innerHTML =
                '<a href="/leaderboard.html" class="nav-link">Leaderboard</a>' +
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
        // Hide table and toggle
        document.getElementById('leaderboard-table').hidden = true;
        document.getElementById('leaderboard-toggle').hidden = true;

        // Show poem
        const sundayContent = document.getElementById('sunday-content');
        sundayContent.hidden = false;

        if (window.poems && window.poems.length > 0) {
            const weekNum = getWeekNumber(new Date());
            const poem = window.poems[weekNum % window.poems.length];
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
        const [yearRes, todayRes] = await Promise.all([
            fetch('/api/leaderboard?view=year'),
            fetch('/api/leaderboard?view=today&timezone=' + encodeURIComponent(timezone))
        ]);

        const yearJson = await yearRes.json();
        const todayJson = await todayRes.json();

        yearData = yearJson.rankings || [];
        todayData = todayJson.entries || [];
        lastFetchTime = Date.now();
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

    // Merge year and today data by cute_id
    const merged = new Map();

    yearData.forEach(function(u) {
        merged.set(u.cute_id, {
            name: u.name,
            cute_id: u.cute_id,
            year_hours: parseFloat(u.total_hours) || 0,
            today_hours: 0,
            is_active: false,
            active_since: null
        });
    });

    todayData.forEach(function(u) {
        if (merged.has(u.cute_id)) {
            var existing = merged.get(u.cute_id);
            existing.today_hours = parseFloat(u.total_hours_today) || 0;
            existing.is_active = u.is_active;
            existing.active_since = u.active_since;
        } else {
            merged.set(u.cute_id, {
                name: u.name,
                cute_id: u.cute_id,
                year_hours: 0,
                today_hours: parseFloat(u.total_hours_today) || 0,
                is_active: u.is_active,
                active_since: u.active_since
            });
        }
    });

    var rows = Array.from(merged.values());

    // Sort based on current toggle
    if (currentSort === 'year') {
        rows.sort(function(a, b) { return b.year_hours - a.year_hours; });
    } else {
        rows.sort(function(a, b) {
            var aHours = a.is_active ? getCurrentHoursSimple(a) : a.today_hours;
            var bHours = b.is_active ? getCurrentHoursSimple(b) : b.today_hours;
            return bHours - aHours;
        });
    }

    // Filter out rows with zero in both columns
    rows = rows.filter(function(r) { return r.year_hours > 0 || r.today_hours > 0 || r.is_active; });

    if (rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="leaderboard-empty">No activity yet.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map(function(row, i) {
        var rank = i + 1;
        var yearFormatted = row.year_hours.toFixed(1);

        var todayFormatted;
        var todayCellClass = '';
        var todayCellId = '';

        if (row.is_active) {
            var currentHours = getCurrentHoursSimple(row);
            todayFormatted = formatHours(currentHours);
            todayCellClass = ' class="today-active"';
            todayCellId = ' id="today-' + CSS.escape(row.cute_id) + '"';
        } else {
            todayFormatted = row.today_hours > 0 ? formatHours(row.today_hours) : '\u2014';
        }

        return '<tr>' +
            '<td class="leaderboard-rank">' + rank + '</td>' +
            '<td><span class="leaderboard-name">' + escapeHtml(row.name) + '</span>' +
                '<span class="leaderboard-cute-id">' + escapeHtml(row.cute_id) + '</span></td>' +
            '<td class="leaderboard-hours">' + yearFormatted + '</td>' +
            '<td' + todayCellClass + todayCellId + '>' + todayFormatted + '</td>' +
        '</tr>';
    }).join('');
}

// ============================================
// ACTIVE TIMERS
// ============================================

function getCurrentHoursSimple(row) {
    if (!row.is_active || !row.active_since) return row.today_hours;
    var activeElapsed = (Date.now() - new Date(row.active_since).getTime()) / (1000 * 60 * 60);
    return row.today_hours + activeElapsed;
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
                var hours = getCurrentHoursSimple({
                    today_hours: parseFloat(u.total_hours_today) || 0,
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
