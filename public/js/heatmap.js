// ============================================
// HEATMAP — shared renderer
// ============================================

(function() {
    var MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

    function getHeatLevel(hours) {
        if (hours === 0) return 0;
        if (hours < 3) return 1;
        if (hours < 6) return 2;
        if (hours < 10) return 3;
        return 4;
    }

    function getOrdinalSuffix(n) {
        var s = ['th', 'st', 'nd', 'rd'];
        var v = n % 100;
        return (s[(v - 20) % 10] || s[v] || s[0]);
    }

    function render(opts) {
        var year = opts.year;
        var days = opts.days || {};
        var shiftLength = opts.shiftLength || 8;
        var gridEl = opts.gridEl;
        var monthsEl = opts.monthsEl;
        var hoverEl = opts.hoverEl;

        gridEl.innerHTML = '';
        if (monthsEl) monthsEl.innerHTML = '';

        var firstDay = new Date(year, 0, 1);
        var lastDay = new Date(year, 11, 31);
        var today = new Date();
        var totalDays = Math.floor((lastDay - firstDay) / 86400000) + 1;

        // Pad cells before Jan 1 to align to the column-major grid
        var firstDow = firstDay.getDay();
        var weekIndexByMonth = {};
        var weekCounter = 0;
        var dayInWeek = firstDow;

        for (var i = 0; i < firstDow; i++) {
            var pad = document.createElement('div');
            pad.className = 'heatmap__cell heatmap__cell--empty';
            gridEl.appendChild(pad);
        }

        for (var i = 0; i < totalDays; i++) {
            var date = new Date(year, 0, 1 + i);
            var dateStr = date.toISOString().split('T')[0];
            var hours = days[dateStr] || 0;
            var isFuture = date > today;
            var dow = date.getDay();
            var isSunday = dow === 0;

            // Track first week index per month for labels (Sunday = start of new column)
            if (dow === 0 || i === 0) {
                var monthIdx = date.getMonth();
                if (!(monthIdx in weekIndexByMonth)) {
                    weekIndexByMonth[monthIdx] = weekCounter;
                }
            }
            if (dow === 6) weekCounter++;

            var cell = document.createElement('div');
            var classes = ['heatmap__cell'];
            if (isSunday) classes.push('heatmap__cell--sunday');
            else if (isFuture) classes.push('heatmap__cell--future');
            else {
                var level = getHeatLevel(hours);
                classes.push('heatmap__cell--lvl' + level);
                if (hours >= shiftLength && hours > 0) classes.push('heatmap__cell--shift-met');
            }
            cell.className = classes.join(' ');
            cell.title = dateStr + (isSunday ? ' (Sunday)' : isFuture ? '' : ': ' + hours.toFixed(1) + 'h');

            if (hoverEl && !isSunday && !isFuture) {
                (function(d, h) {
                    cell.addEventListener('mouseenter', function() {
                        var dt = new Date(d);
                        var day = dt.getDate();
                        var month = dt.toLocaleString('en-US', { month: 'long' });
                        var yr = dt.getFullYear();
                        var hr = Math.floor(h);
                        var mn = Math.round((h - hr) * 60);
                        hoverEl.textContent = 'On the ' + day + getOrdinalSuffix(day) + ' of ' +
                            month + ', ' + yr + ' you worked ' + hr + ' hours and ' + mn + ' minutes.';
                    });
                    cell.addEventListener('mouseleave', function() {
                        hoverEl.innerHTML = '&nbsp;';
                    });
                })(dateStr, hours);
            }

            gridEl.appendChild(cell);
        }

        // Month labels — span ~4.34 columns each
        if (monthsEl) {
            for (var m = 0; m < 12; m++) {
                var label = document.createElement('span');
                label.textContent = MONTHS_SHORT[m];
                label.style.gridColumn = (m * 4.34 + 1) + ' / span 4';
                monthsEl.appendChild(label);
            }
        }
    }

    window.WhistleHeatmap = { render: render, getHeatLevel: getHeatLevel };
})();
