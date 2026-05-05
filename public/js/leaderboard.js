// ============================================
// LEADERBOARD.JS — Factory Floor
// ============================================

let todayData = [];
let timerInterval = null;
let pollInterval = null;
let currentCuteId = null;

document.addEventListener('DOMContentLoaded', function() {

    // Masthead date
    var today = new Date();
    document.getElementById('masthead-date').textContent =
        today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    document.getElementById('floor-date').textContent =
        today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase();

    setupNav();

    if (!checkSunday()) {
        loadData();
        pollInterval = setInterval(loadData, 30000);
    }
});

async function setupNav() {
    var navItems = document.getElementById('nav-items');
    var navUser = document.getElementById('nav-user');

    try {
        var response = await fetch('/api/auth/me');
        var data = await response.json();

        if (data.user) {
            currentCuteId = data.user.cute_id;
            navItems.innerHTML =
                '<a href="/app.html" class="nav__item"><span class="nav__num">01</span>Punch Clock</a>' +
                '<a href="/leaderboard.html" class="nav__item is-active"><span class="nav__num">02</span>Factory Floor</a>' +
                '<a href="/profile.html" class="nav__item"><span class="nav__num">03</span>Set Up</a>' +
                '<a href="/about.html" class="nav__item"><span class="nav__num">04</span>About</a>';
            navUser.innerHTML = '<button id="logout-btn" type="button">Sign Out</button>';

            document.getElementById('logout-btn').addEventListener('click', async function() {
                try {
                    var statusRes = await fetch('/api/time/status');
                    var statusData = await statusRes.json();
                    if (statusData.is_working) {
                        if (!confirm('Signing out will clock you out. Continue?')) return;
                    }
                    await fetch('/api/auth/logout', { method: 'POST' });
                } catch (e) {}
                window.location.href = '/index.html';
            });
        } else {
            navItems.innerHTML =
                '<a href="/leaderboard.html" class="nav__item is-active"><span class="nav__num">02</span>Factory Floor</a>' +
                '<a href="/about.html" class="nav__item"><span class="nav__num">04</span>About</a>';
            navUser.innerHTML = '<a href="/index.html">Sign In</a>';
        }
    } catch (error) {
        navItems.innerHTML =
            '<a href="/leaderboard.html" class="nav__item is-active"><span class="nav__num">02</span>Factory Floor</a>' +
            '<a href="/about.html" class="nav__item"><span class="nav__num">04</span>About</a>';
        navUser.innerHTML = '<a href="/index.html">Sign In</a>';
    }
}

// SUNDAY

function getWeekNumber(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function checkSunday() {
    if (new Date().getDay() === 0) {
        document.getElementById('floor-table').hidden = true;
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

// DATA

async function loadData() {
    var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
        var todayRes = await fetch('/api/leaderboard?view=today&timezone=' + encodeURIComponent(timezone));
        var todayJson = await todayRes.json();
        todayData = todayJson.entries || [];
        renderRows();
        startActiveTimers();
    } catch (err) {
        console.error('Failed to load leaderboard:', err);
    }
}

// RENDER

function renderRows() {
    var body = document.getElementById('floor-body');

    var rows = todayData.filter(function(r) {
        return r.total_hours_today > 0 || r.is_active;
    });

    rows.sort(function(a, b) {
        var aHours = a.is_active ? getCurrentHours(a) : a.total_hours_today;
        var bHours = b.is_active ? getCurrentHours(b) : b.total_hours_today;
        return bHours - aHours;
    });

    if (rows.length === 0) {
        body.innerHTML = '<div class="floor__empty">No activity yet today.</div>';
        return;
    }

    body.innerHTML = rows.map(function(row, i) {
        var rank = i + 1;
        var isMe = row.cute_id === currentCuteId;
        var isTop = i < 3;

        var nameInner = escapeHtml(row.name);
        var nameHtml = row.link
            ? '<a href="' + escapeAttr(row.link) + '" target="_blank" rel="noopener">' + nameInner + '</a>'
            : nameInner;
        if (isMe) nameHtml += '<span class="floor__you">(YOU)</span>';

        var todayHtml;
        var todayCellAttrs = '';
        if (row.is_active) {
            var cur = getCurrentHours(row);
            todayHtml = formatHours(cur);
            todayCellAttrs = ' id="today-' + escapeAttr(row.cute_id) + '"';
        } else if (row.total_hours_today > 0) {
            todayHtml = formatHours(row.total_hours_today);
        } else {
            todayHtml = 'idle';
        }
        var todayClasses = 'floor__today';
        if (row.is_active) todayClasses += ' floor__today--active';
        else if (row.total_hours_today === 0) todayClasses += ' floor__today--off';

        var statusHtml;
        if (row.is_active) statusHtml = '<div class="floor__status floor__status--live">on the clock</div>';
        else if (row.total_hours_today > 0) statusHtml = '<div class="floor__status">punched out</div>';
        else statusHtml = '<div class="floor__status">absent</div>';

        return '<div class="floor__row' + (isMe ? ' is-active' : '') + '">' +
            '<div class="floor__rank' + (isTop ? ' is-top' : '') + '">' + String(rank).padStart(2, '0') + '</div>' +
            '<div>' +
                '<div class="floor__name">' + nameHtml + '</div>' +
                '<div class="floor__id">№ ' + escapeHtml(row.cute_id) + '</div>' +
            '</div>' +
            '<div class="' + todayClasses + '"' + todayCellAttrs + '>' + todayHtml + '</div>' +
            statusHtml +
        '</div>';
    }).join('');
}

// LIVE TIMERS

function getCurrentHours(row) {
    if (!row.is_active || !row.active_since) return row.total_hours_today;
    var elapsed = (Date.now() - new Date(row.active_since).getTime()) / 3600000;
    return row.total_hours_today + elapsed;
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
            var cell = document.getElementById('today-' + u.cute_id);
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

function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

function escapeAttr(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
