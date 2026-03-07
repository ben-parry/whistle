// ============================================
// LEADERBOARD.JS - Leaderboard Page Logic
// ============================================

document.addEventListener('DOMContentLoaded', function() {

    const navLinks = document.getElementById('nav-links');
    const yearTab = document.getElementById('year-tab');
    const todayTab = document.getElementById('today-tab');
    const yearView = document.getElementById('year-view');
    const todayView = document.getElementById('today-view');
    const yearBody = document.getElementById('year-body');
    const todayBody = document.getElementById('today-body');

    let todayPollTimer = null;
    let activeTimers = [];
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
    // TAB SWITCHING
    // ============================================

    yearTab.addEventListener('click', function() {
        yearView.hidden = false;
        todayView.hidden = true;
        yearTab.classList.add('active');
        todayTab.classList.remove('active');
        stopTodayPolling();
    });

    todayTab.addEventListener('click', function() {
        yearView.hidden = true;
        todayView.hidden = false;
        yearTab.classList.remove('active');
        todayTab.classList.add('active');
        loadToday();
        startTodayPolling();
    });

    // ============================================
    // YEARLY LEADERBOARD
    // ============================================

    loadYear();

    async function loadYear() {
        try {
            const response = await fetch('/api/leaderboard?view=year');
            const data = await response.json();

            if (data.rankings.length === 0) {
                yearBody.innerHTML = '<tr><td colspan="4" class="leaderboard-empty">No one has logged any time this year yet.</td></tr>';
                return;
            }

            yearBody.innerHTML = '';
            data.rankings.forEach(function(person) {
                const row = document.createElement('tr');
                row.innerHTML =
                    '<td class="leaderboard-rank">' + person.rank + '</td>' +
                    '<td><span class="leaderboard-name">' + escapeHtml(person.name) + '</span>' +
                        '<span class="leaderboard-cute-id">' + escapeHtml(person.cute_id) + '</span></td>' +
                    '<td class="leaderboard-sessions">' + person.total_sessions + '</td>' +
                    '<td class="leaderboard-hours">' + formatHours(person.total_hours) + '</td>';
                yearBody.appendChild(row);
            });
        } catch (error) {
            console.error('Year leaderboard error:', error);
            yearBody.innerHTML = '<tr><td colspan="4" class="leaderboard-empty">Failed to load leaderboard.</td></tr>';
        }
    }

    // ============================================
    // TODAY'S LEADERBOARD
    // ============================================

    async function loadToday() {
        try {
            const response = await fetch('/api/leaderboard?view=today&timezone=' + encodeURIComponent(userTimezone));
            const data = await response.json();

            // Clear existing timers
            activeTimers.forEach(function(timer) { clearInterval(timer); });
            activeTimers = [];

            if (data.entries.length === 0) {
                todayBody.innerHTML = '<tr><td colspan="3" class="leaderboard-empty">No one has logged any time today.</td></tr>';
                return;
            }

            todayBody.innerHTML = '';
            data.entries.forEach(function(person) {
                const row = document.createElement('tr');

                let hoursCell;
                let statusCell;

                if (person.is_active) {
                    const timerId = 'timer-' + escapeHtml(person.cute_id).replace(/[^a-zA-Z0-9]/g, '-');
                    hoursCell = '<td class="leaderboard-hours">' +
                        formatHours(person.total_hours_today) +
                        '<br><span class="active-timer" id="' + timerId + '"></span></td>';
                    statusCell = '<td><span class="active-indicator"></span>Working</td>';

                    // Start client-side timer for active session
                    const activeSince = new Date(person.active_since);
                    const timer = setInterval(function() {
                        const el = document.getElementById(timerId);
                        if (!el) { clearInterval(timer); return; }
                        const now = new Date();
                        const diff = Math.floor((now - activeSince) / 1000);
                        const h = Math.floor(diff / 3600);
                        const m = Math.floor((diff % 3600) / 60);
                        const s = diff % 60;
                        el.textContent = String(h).padStart(2, '0') + ':' +
                            String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
                    }, 1000);
                    activeTimers.push(timer);
                } else {
                    hoursCell = '<td class="leaderboard-hours">' + formatHours(person.total_hours_today) + '</td>';
                    statusCell = '<td style="color: #9D8F86;">Done</td>';
                }

                row.innerHTML =
                    '<td><span class="leaderboard-name">' + escapeHtml(person.name) + '</span>' +
                        '<span class="leaderboard-cute-id">' + escapeHtml(person.cute_id) + '</span></td>' +
                    hoursCell + statusCell;

                todayBody.appendChild(row);
            });
        } catch (error) {
            console.error('Today leaderboard error:', error);
            todayBody.innerHTML = '<tr><td colspan="3" class="leaderboard-empty">Failed to load today\'s data.</td></tr>';
        }
    }

    // ============================================
    // POLLING (every 30 seconds for today view)
    // ============================================

    function startTodayPolling() {
        stopTodayPolling();
        todayPollTimer = setInterval(function() {
            loadToday();
        }, 30000);
    }

    function stopTodayPolling() {
        if (todayPollTimer) {
            clearInterval(todayPollTimer);
            todayPollTimer = null;
        }
        activeTimers.forEach(function(timer) { clearInterval(timer); });
        activeTimers = [];
    }

    // ============================================
    // HELPERS
    // ============================================

    function formatHours(hours) {
        const rounded = Math.round(hours * 10) / 10;
        if (rounded === 0) return '0';
        if (rounded === Math.floor(rounded)) return rounded.toString();
        return rounded.toFixed(1);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

});
