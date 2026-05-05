// ============================================
// APP.JS — Punch Clock
// ============================================

const ANNUAL_HOURS_GOAL = 2333;
const WORK_END_HOUR = 21;
const MAX_DAILY_HOURS = 12;

let elapsedTimer = null;
let sessionStartTime = null;
let shiftLength = 8;
let shiftCompleted = false;
let isWorking = false;

document.addEventListener('DOMContentLoaded', function() {

    const punchSection = document.getElementById('punch-section');
    const sundaySection = document.getElementById('sunday-content');

    const mastheadDate = document.getElementById('masthead-date');
    const punchDay = document.getElementById('punch-day');
    const punchDate = document.getElementById('punch-date');
    const punchShiftNum = document.getElementById('punch-shift-num');
    const punchStatus = document.getElementById('punch-status');
    const punchStatusText = document.getElementById('punch-status-text');
    const punchElapsedReady = document.getElementById('punch-elapsed-ready');
    const punchElapsed = document.getElementById('punch-elapsed');
    const punchBlockedMsg = document.getElementById('punch-blocked-msg');
    const punchInTime = document.getElementById('punch-in-time');
    const punchOutTime = document.getElementById('punch-out-time');
    const shiftBarFill = document.getElementById('shift-bar-fill');
    const shiftTicks = document.getElementById('shift-ticks');
    const shiftTargetText = document.getElementById('shift-target-text');
    const punchButton = document.getElementById('punch-button');
    const punchButtonText = document.getElementById('punch-button-text');
    const punchCornerDay = document.getElementById('punch-corner-day');
    const punchCornerYear = document.getElementById('punch-corner-year');

    const yearTotal = document.getElementById('year-total');
    const currentYearSpan = document.getElementById('current-year');
    const progressBar = document.getElementById('progress-bar');
    const yearPct = document.getElementById('year-pct');
    const yearCaption = document.getElementById('year-caption');
    const yearPace = document.getElementById('year-pace');

    const logoutButton = document.getElementById('logout-button');

    // Masthead date
    var today = new Date();
    mastheadDate.textContent = today.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric'
    });

    // Punch day/date
    var dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
    punchDay.textContent = dayName;
    punchDate.textContent = today.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
    }).toUpperCase();

    // Day-of-year shift number
    var startOfYear = new Date(today.getFullYear(), 0, 0);
    var dayOfYear = Math.floor((today - startOfYear) / 86400000);
    punchShiftNum.textContent = '№ ' + dayOfYear;

    // Punch button corners
    punchCornerDay.textContent = '№ ' + String(today.getDate()).padStart(2, '0');
    punchCornerYear.textContent = String(today.getFullYear());

    checkAuth();

    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible' && sessionStartTime) {
            loadStatus();
        }
    });

    async function checkAuth() {
        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();
            if (!data.user) {
                window.location.href = '/index.html';
                return;
            }

            if (new Date().getDay() === 0) {
                punchSection.hidden = true;
                sundaySection.hidden = false;
                // still load year/heatmap so the lower sections render
                loadYear();
                loadHeatmap();
                return;
            }

            loadStatus();
            loadHeatmap();
        } catch (error) {
            console.error('Auth check error:', error);
            window.location.href = '/index.html';
        }
    }

    async function loadYear() {
        try {
            const response = await fetch('/api/time/status');
            const data = await response.json();
            shiftLength = data.shift_length || 8;
            renderYear(data.year_total_hours);
            renderShiftTarget();
        } catch (e) { console.error(e); }
    }

    async function loadStatus() {
        try {
            const response = await fetch('/api/time/status');
            const data = await response.json();

            shiftLength = data.shift_length || 8;

            renderYear(data.year_total_hours);
            renderShiftTarget();

            if (data.is_working && data.current_session) {
                sessionStartTime = new Date(data.current_session.start_time);
                isWorking = true;
                showWorkingState();
                startElapsedTimer();
                scheduleAutoCloseCheck();
            } else if (data.today_session) {
                showCompletedState(data.today_session);
            } else if (data.restriction) {
                showRestrictionState(data.restriction);
            } else {
                showReadyState();
            }
        } catch (error) {
            console.error('Load status error:', error);
            setStatus('blocked', 'Error');
            punchBlockedMsg.textContent = 'Error loading status';
            punchBlockedMsg.hidden = false;
            punchElapsedReady.hidden = true;
            punchElapsed.hidden = true;
        }
    }

    function renderYear(hours) {
        var year = new Date().getFullYear();
        currentYearSpan.textContent = year;
        yearTotal.textContent = formatHoursDisplay(hours);

        var pct = Math.min((hours / ANNUAL_HOURS_GOAL) * 100, 100);
        progressBar.style.width = pct + '%';
        yearPct.textContent = Math.round(pct) + '%';

        var remaining = Math.max(0, Math.round(ANNUAL_HOURS_GOAL - hours));
        yearCaption.textContent = remaining.toLocaleString() + ' hrs to whistle';

        var elapsedDays = Math.floor((new Date() - new Date(year, 0, 1)) / 86400000);
        var yearPctElapsed = (elapsedDays / 365) * 100;
        yearPace.textContent = pct >= yearPctElapsed ? 'On pace' : 'Behind pace';
    }

    function renderShiftTarget() {
        // ticks: one per shift hour
        shiftTicks.innerHTML = '';
        for (var i = 0; i < shiftLength; i++) {
            shiftTicks.appendChild(document.createElement('span'));
        }
        shiftTargetText.textContent = 'Target ' + shiftLength + 'h';
    }

    function scheduleAutoCloseCheck() {
        var now = new Date();
        if (now.getHours() < WORK_END_HOUR) {
            var ninePm = new Date(now);
            ninePm.setHours(WORK_END_HOUR, 0, 0, 0);
            setTimeout(loadStatus, ninePm - now + 2000);
        }
    }

    // STATE HELPERS

    function setStatus(kind, text) {
        var classes = ['punch__status'];
        if (kind === 'live')    classes.push('punch__status--live');
        if (kind === 'ready')   classes.push('punch__status--ready');
        if (kind === 'blocked') classes.push('punch__status--blocked');
        if (kind === 'done')    classes.push('punch__status--done');
        punchStatus.className = classes.join(' ');
        punchStatusText.textContent = text;
    }

    function showWorkingState() {
        punchSection.dataset.state = 'working';
        setStatus('live', 'On the clock');

        punchElapsedReady.hidden = true;
        punchElapsed.hidden = false;
        punchBlockedMsg.hidden = true;

        if (sessionStartTime) {
            punchInTime.textContent = formatTime(sessionStartTime);
            punchInTime.classList.remove('punch__time-value--empty');
        }
        punchOutTime.textContent = '— : —';
        punchOutTime.classList.add('punch__time-value--empty');

        punchButton.hidden = false;
        punchButton.disabled = false;
        punchButton.className = 'punch-btn punch-btn--clock-out';
        punchButtonText.textContent = 'Clock Out';
        punchButton.dataset.label = 'Clock Out';
    }

    function showCompletedState(session) {
        stopElapsedTimer();
        isWorking = false;
        var start = new Date(session.start_time);
        var end = new Date(session.end_time);

        punchSection.dataset.state = 'done';
        setStatus('done', 'Shift logged');

        punchElapsedReady.hidden = true;
        punchElapsed.hidden = false;
        punchBlockedMsg.hidden = true;

        var durationMs = end - start;
        punchElapsed.textContent = formatClock(durationMs);

        punchInTime.textContent = formatTime(start);
        punchInTime.classList.remove('punch__time-value--empty');
        punchOutTime.textContent = formatTime(end);
        punchOutTime.classList.remove('punch__time-value--empty');

        var durationHours = durationMs / 3600000;
        var pct = Math.min((durationHours / shiftLength) * 100, 100);
        shiftBarFill.style.width = pct + '%';
        shiftBarFill.classList.toggle('is-complete', durationHours >= shiftLength);
        punchSection.classList.toggle('is-complete', durationHours >= shiftLength);

        punchButton.hidden = true;
        shiftCompleted = false;
    }

    function showReadyState() {
        punchSection.dataset.state = 'ready';
        setStatus('ready', 'Ready');

        punchElapsedReady.hidden = false;
        punchElapsed.hidden = true;
        punchBlockedMsg.hidden = true;

        punchInTime.textContent = '— : —';
        punchInTime.classList.add('punch__time-value--empty');
        punchOutTime.textContent = '— : —';
        punchOutTime.classList.add('punch__time-value--empty');

        shiftBarFill.style.width = '0%';
        shiftBarFill.classList.remove('is-complete');
        punchSection.classList.remove('is-complete');

        punchButton.hidden = false;
        punchButton.disabled = false;
        punchButton.className = 'punch-btn';
        punchButtonText.textContent = 'Clock In';
        punchButton.dataset.label = 'Clock In';
        shiftCompleted = false;
    }

    function showRestrictionState(restriction) {
        punchSection.dataset.state = 'blocked';
        setStatus('blocked', 'Blocked');

        var msg = '';
        if (restriction === 'sunday')         msg = 'It is Sunday, let us seize the means of relaxation.';
        else if (restriction === 'before_hours') msg = 'Clock in/out is available from 5:00 AM.';
        else if (restriction === 'after_hours')  msg = 'Clock in/out is not available after 9:00 PM.';

        punchElapsedReady.hidden = true;
        punchElapsed.hidden = true;
        punchBlockedMsg.textContent = msg;
        punchBlockedMsg.hidden = false;

        punchInTime.textContent = '— : —';
        punchInTime.classList.add('punch__time-value--empty');
        punchOutTime.textContent = '— : —';
        punchOutTime.classList.add('punch__time-value--empty');

        shiftBarFill.style.width = '0%';
        shiftBarFill.classList.remove('is-complete');
        punchSection.classList.remove('is-complete');

        punchButton.hidden = true;
        shiftCompleted = false;
    }

    function formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
        }).toUpperCase();
    }

    function formatClock(ms) {
        var total = Math.floor(ms / 1000);
        var h = String(Math.floor(total / 3600)).padStart(2, '0');
        var m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
        var s = String(total % 60).padStart(2, '0');
        return h + ':' + m + ':' + s;
    }

    function formatHoursDisplay(hours) {
        var rounded = Math.round(hours * 10) / 10;
        if (rounded === 0) return '0';
        if (rounded === Math.floor(rounded)) return rounded.toString();
        return rounded.toFixed(1);
    }

    // PUNCH

    punchButton.addEventListener('click', async function() {
        if (punchButton.disabled) return;
        punchButton.disabled = true;

        try {
            if (isWorking) {
                if (sessionStartTime && !shiftCompleted) {
                    var elapsedHours = (new Date() - sessionStartTime) / 3600000;
                    if (elapsedHours < shiftLength) {
                        var remaining = shiftLength - elapsedHours;
                        var remH = Math.floor(remaining);
                        var remM = Math.round((remaining - remH) * 60);
                        var remStr = '';
                        if (remH > 0) remStr += remH + ' hour' + (remH !== 1 ? 's' : '');
                        if (remH > 0 && remM > 0) remStr += ' and ';
                        if (remM > 0 || remH === 0) remStr += remM + ' minute' + (remM !== 1 ? 's' : '');
                        if (!confirm('You still have ' + remStr + ' left on your shift. Clock out anyway?')) {
                            punchButton.disabled = false;
                            return;
                        }
                    }
                }
                await clockOut();
            } else {
                await clockIn();
            }
        } catch (error) {
            console.error('Punch error:', error);
            alert('Something went wrong. Please try again.');
            punchButton.disabled = false;
        }
    });

    async function clockIn() {
        var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        var response = await fetch('/api/time/clock-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone: timezone })
        });
        var data = await response.json();

        if (response.ok) {
            sessionStartTime = new Date(data.entry.start_time);
            isWorking = true;
            showWorkingState();
            startElapsedTimer();
            scheduleAutoCloseCheck();
        } else {
            alert(data.error || 'Failed to clock in');
            punchButton.disabled = false;
        }
    }

    async function clockOut() {
        var response = await fetch('/api/time/clock-out', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        var data = await response.json();

        if (response.ok) {
            stopElapsedTimer();
            isWorking = false;
            showCompletedState({
                start_time: data.entry.start_time,
                end_time: data.entry.end_time
            });
            loadStatus();
            loadHeatmap();
        } else {
            alert(data.error || 'Failed to clock out');
            punchButton.disabled = false;
        }
    }

    // ELAPSED TIMER

    function startElapsedTimer() {
        stopElapsedTimer();
        updateElapsedTime();
        elapsedTimer = setInterval(updateElapsedTime, 1000);
    }

    function stopElapsedTimer() {
        if (elapsedTimer) {
            clearInterval(elapsedTimer);
            elapsedTimer = null;
        }
    }

    function updateElapsedTime() {
        if (!sessionStartTime) return;

        var now = new Date();
        var diffMs = now - sessionStartTime;
        if (diffMs < 0) diffMs = 0;

        var maxMs = MAX_DAILY_HOURS * 3600000;
        var ninePm = new Date(sessionStartTime);
        ninePm.setHours(WORK_END_HOUR, 0, 0, 0);
        if (ninePm <= sessionStartTime) ninePm.setDate(ninePm.getDate() + 1);
        var ninePmMs = ninePm - sessionStartTime;
        if (ninePmMs > 0 && ninePmMs < maxMs) maxMs = ninePmMs;

        if (diffMs >= maxMs) {
            stopElapsedTimer();
            loadStatus();
            return;
        }

        punchElapsed.textContent = formatClock(diffMs);

        var elapsedHours = diffMs / 3600000;
        var pct = Math.min((elapsedHours / shiftLength) * 100, 100);
        shiftBarFill.style.width = pct + '%';

        if (elapsedHours >= shiftLength && !shiftCompleted) {
            shiftCompleted = true;
            shiftBarFill.classList.add('is-complete');
            punchSection.classList.add('is-complete');
            shiftTargetText.textContent = 'Whistle blown';
        }
    }

    // HEATMAP

    async function loadHeatmap() {
        try {
            var response = await fetch('/api/time/heatmap');
            var data = await response.json();
            window.WhistleHeatmap.render({
                year: data.year,
                days: data.days,
                shiftLength: data.shift_length || shiftLength,
                gridEl: document.getElementById('app-heatmap-grid'),
                monthsEl: document.getElementById('app-heatmap-months'),
                hoverEl: document.getElementById('app-heatmap-hover')
            });
        } catch (e) { console.error('Heatmap error:', e); }
    }

    // LOGOUT

    logoutButton.addEventListener('click', async function() {
        try {
            if (isWorking) {
                if (!confirm('Signing out will clock you out. Continue?')) return;
            }
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) { console.error('Logout error:', e); }
        window.location.href = '/index.html';
    });

});
