// ============================================
// PROFILE.JS — Set Up
// ============================================

document.addEventListener('DOMContentLoaded', function() {

    const mastheadDate = document.getElementById('masthead-date');
    const setupAvatar = document.getElementById('setup-avatar');
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const userCuteId = document.getElementById('user-cute-id');
    const userShiftLength = document.getElementById('user-shift-length');
    const shiftEditBtn = document.getElementById('shift-edit-btn');
    const shiftEditForm = document.getElementById('shift-edit-form');
    const shiftInput = document.getElementById('shift-input');
    const shiftSaveBtn = document.getElementById('shift-save-btn');
    const shiftCancelBtn = document.getElementById('shift-cancel-btn');
    const shiftChangesInfo = document.getElementById('shift-changes-info');

    const userLink = document.getElementById('user-link');
    const userLinkEmpty = document.getElementById('user-link-empty');
    const linkEditBtn = document.getElementById('link-edit-btn');
    const linkEditForm = document.getElementById('link-edit-form');
    const linkInput = document.getElementById('link-input');
    const linkSaveBtn = document.getElementById('link-save-btn');
    const linkCancelBtn = document.getElementById('link-cancel-btn');

    const statsText = document.getElementById('stats-text');
    const statsYear = document.getElementById('stats-year');
    const sessionsList = document.getElementById('sessions-list');
    const sessionsCount = document.getElementById('sessions-count');
    const editsInfo = document.getElementById('edits-info');

    const exportButton = document.getElementById('export-button');
    const deleteButton = document.getElementById('delete-button');
    const deleteModal = document.getElementById('delete-modal');
    const cancelDelete = document.getElementById('cancel-delete');
    const confirmDelete = document.getElementById('confirm-delete');
    const modalExportButton = document.getElementById('modal-export-button');
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-form');
    const cancelEdit = document.getElementById('cancel-edit');
    const editError = document.getElementById('edit-error');
    const editWarning = document.getElementById('edit-warning');
    const passwordForm = document.getElementById('password-form');
    const passwordMessage = document.getElementById('password-message');
    const logoutButton = document.getElementById('logout-button');
    const deleteSessionModal = document.getElementById('delete-session-modal');
    const cancelDeleteSession = document.getElementById('cancel-delete-session');
    const confirmDeleteSession = document.getElementById('confirm-delete-session');

    let currentEditsRemaining = 3;
    let currentShiftLength = 8;
    let deleteSessionEntryId = null;

    // Masthead date
    var today = new Date();
    mastheadDate.textContent = today.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric'
    });
    statsYear.textContent = today.getFullYear();

    // Random Mucha avatar
    var imgNum = Math.floor(Math.random() * 9) + 1;
    setupAvatar.style.backgroundImage = 'url(/pics/profile-headers/mucha-' + imgNum + '.png)';

    // Section nav active state
    document.querySelectorAll('.setup__nav-link').forEach(function(link) {
        link.addEventListener('click', function() {
            document.querySelectorAll('.setup__nav-link').forEach(function(l) {
                l.classList.remove('is-active');
            });
            link.classList.add('is-active');
        });
    });

    checkAuth();

    async function checkAuth() {
        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();

            if (!data.user) {
                window.location.href = '/index.html';
                return;
            }

            userName.textContent = data.user.name;
            userEmail.textContent = data.user.email;
            userCuteId.textContent = '№ ' + data.user.cute_id;

            currentShiftLength = data.user.shift_length || 8;
            userShiftLength.textContent = currentShiftLength + ' hours';

            var remaining = data.user.shift_changes_remaining;
            if (remaining !== undefined) {
                shiftChangesInfo.hidden = false;
                if (remaining > 0) {
                    shiftChangesInfo.textContent = remaining + ' change' + (remaining !== 1 ? 's' : '') + ' remaining this month';
                    shiftEditBtn.hidden = false;
                } else {
                    shiftChangesInfo.textContent = 'You can change your shift length at the start of next month';
                    shiftEditBtn.hidden = true;
                }
            }

            displayLink(data.user.link || '');

            loadStats();
            loadSessions();
            loadHeatmap();
        } catch (error) {
            console.error('Auth check error:', error);
            window.location.href = '/index.html';
        }
    }

    // LINK

    function displayLink(linkVal) {
        if (linkVal) {
            userLink.href = linkVal;
            userLink.textContent = linkVal.replace(/^https?:\/\//, '');
            userLink.hidden = false;
            userLinkEmpty.hidden = true;
            linkEditBtn.hidden = false;
        } else {
            userLink.hidden = true;
            userLinkEmpty.hidden = false;
            linkEditBtn.hidden = true;
        }
    }

    linkEditBtn.addEventListener('click', function() {
        linkInput.value = userLink.hidden ? '' : userLink.href;
        linkEditForm.hidden = false;
        linkEditBtn.hidden = true;
        userLink.hidden = true;
        userLinkEmpty.hidden = true;
    });

    userLinkEmpty.addEventListener('click', function() {
        linkInput.value = '';
        linkEditForm.hidden = false;
        userLinkEmpty.hidden = true;
    });

    linkCancelBtn.addEventListener('click', function() {
        linkEditForm.hidden = true;
        if (userLink.href && userLink.textContent) {
            userLink.hidden = false;
            linkEditBtn.hidden = false;
        } else {
            userLinkEmpty.hidden = false;
        }
    });

    linkSaveBtn.addEventListener('click', async function() {
        var newLink = linkInput.value.trim();
        linkSaveBtn.disabled = true;
        try {
            const response = await fetch('/api/auth/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ link: newLink })
            });
            const data = await response.json();
            if (response.ok) {
                displayLink(data.link || '');
                linkEditForm.hidden = true;
            } else {
                alert(data.error || 'Failed to save link.');
            }
        } catch (error) {
            console.error('Link save error:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            linkSaveBtn.disabled = false;
        }
    });

    // SHIFT

    shiftEditBtn.addEventListener('click', function() {
        shiftInput.value = currentShiftLength;
        shiftEditForm.hidden = false;
        shiftEditBtn.hidden = true;
        userShiftLength.hidden = true;
    });

    shiftCancelBtn.addEventListener('click', function() {
        shiftEditForm.hidden = true;
        shiftEditBtn.hidden = false;
        userShiftLength.hidden = false;
    });

    shiftSaveBtn.addEventListener('click', async function() {
        var newLength = parseInt(shiftInput.value, 10);
        if (newLength === currentShiftLength) {
            shiftEditForm.hidden = true;
            shiftEditBtn.hidden = false;
            userShiftLength.hidden = false;
            return;
        }
        shiftSaveBtn.disabled = true;
        try {
            var response = await fetch('/api/auth/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shift_length: newLength })
            });
            var data = await response.json();
            if (response.ok) {
                currentShiftLength = data.shift_length;
                userShiftLength.textContent = currentShiftLength + ' hours';
                userShiftLength.hidden = false;
                shiftEditForm.hidden = true;

                if (data.changes_remaining > 0) {
                    shiftChangesInfo.textContent = data.changes_remaining + ' change' + (data.changes_remaining !== 1 ? 's' : '') + ' remaining this month';
                    shiftEditBtn.hidden = false;
                } else {
                    shiftChangesInfo.textContent = 'You can change your shift length at the start of next month';
                    shiftEditBtn.hidden = true;
                }
            } else {
                alert(data.error || 'Failed to update shift length.');
                userShiftLength.hidden = false;
                shiftEditForm.hidden = true;
                shiftEditBtn.hidden = false;
            }
        } catch (error) {
            console.error('Shift length error:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            shiftSaveBtn.disabled = false;
        }
    });

    // STATS

    function formatMinutesToTime(totalMinutes) {
        var h = Math.floor(totalMinutes / 60);
        var m = totalMinutes % 60;
        var ampm = h >= 12 ? 'PM' : 'AM';
        var displayH = h % 12 || 12;
        return displayH + ':' + String(m).padStart(2, '0') + ' ' + ampm;
    }

    async function loadStats() {
        try {
            const response = await fetch('/api/time/stats');
            const data = await response.json();

            const medianHours = Math.floor(data.median_minutes / 60);
            const medianMins = data.median_minutes % 60;
            let medianStr = '';
            if (medianHours > 0) {
                medianStr = medianHours + ' hour' + (medianHours !== 1 ? 's' : '');
                if (medianMins > 0) medianStr += ' and ' + medianMins + ' minute' + (medianMins !== 1 ? 's' : '');
            } else {
                medianStr = medianMins + ' minute' + (medianMins !== 1 ? 's' : '');
            }

            var html =
                'In <strong>' + data.year + '</strong> you have clocked in on ' +
                '<strong>' + data.total_days + ' day' + (data.total_days !== 1 ? 's' : '') + '</strong> and completed ' +
                '<strong>' + data.total_hours + ' hour' + (data.total_hours !== 1 ? 's' : '') + '</strong> of work. ' +
                'On a median day you worked <strong>' + medianStr + '</strong>.';

            if (data.median_clock_in_minutes !== null && data.median_clock_out_minutes !== null) {
                html += ' You usually clock in at <strong>' +
                    formatMinutesToTime(data.median_clock_in_minutes) +
                    '</strong> and clock out at <strong>' +
                    formatMinutesToTime(data.median_clock_out_minutes) +
                    '</strong>.';
            }

            statsText.innerHTML = html;
        } catch (error) {
            console.error('Stats error:', error);
            statsText.textContent = 'Unable to load statistics.';
        }
    }

    // SESSIONS

    async function loadSessions() {
        try {
            const response = await fetch('/api/time/sessions');
            const data = await response.json();

            currentEditsRemaining = data.edits_remaining;
            sessionsCount.textContent = data.sessions.length + ' entries';

            if (data.edits_remaining < 3) {
                editsInfo.hidden = false;
                editsInfo.textContent = data.edits_remaining + ' edit' + (data.edits_remaining !== 1 ? 's' : '') + ' remaining this month.';
            } else {
                editsInfo.hidden = true;
            }

            if (data.sessions.length === 0) {
                sessionsList.innerHTML = '<div class="sessions-empty">No sessions yet.</div>';
                return;
            }

            sessionsList.innerHTML = data.sessions.map(function(session) {
                const startDate = new Date(session.start_time);
                const endDate = new Date(session.end_time);
                const dateStr = startDate.toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric'
                }).toUpperCase();
                const startTimeStr = startDate.toLocaleTimeString('en-US', {
                    hour: 'numeric', minute: '2-digit', hour12: true
                });
                const endTimeStr = endDate.toLocaleTimeString('en-US', {
                    hour: 'numeric', minute: '2-digit', hour12: true
                });
                const durationStr = session.duration_hours.toFixed(1) + 'h';

                var actions = '';
                if (session.editable && currentEditsRemaining > 0) {
                    actions += '<button class="session-row__btn" data-act="edit"' +
                        ' data-id="' + session.id +
                        '" data-start="' + escapeAttr(session.start_time) +
                        '" data-end="' + escapeAttr(session.end_time) + '">Edit</button>';
                }
                actions += '<button class="session-row__btn session-row__btn--danger" data-act="delete" data-id="' + session.id + '">Delete</button>';

                return '<div class="session-row">' +
                    '<div class="session-row__date">' + dateStr + '</div>' +
                    '<div class="session-row__times">' + startTimeStr + ' → ' + endTimeStr + '</div>' +
                    '<div class="session-row__dur">' + durationStr + '</div>' +
                    '<div class="session-row__star">' + (session.shift_met ? '★' : '') + '</div>' +
                    '<div class="session-row__actions">' + actions + '</div>' +
                '</div>';
            }).join('');

            sessionsList.querySelectorAll('[data-act="edit"]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    openEditModal(btn.dataset.id, btn.dataset.start, btn.dataset.end);
                });
            });
            sessionsList.querySelectorAll('[data-act="delete"]').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    deleteSessionEntryId = parseInt(btn.dataset.id, 10);
                    deleteSessionModal.hidden = false;
                });
            });
        } catch (error) {
            console.error('Sessions error:', error);
            sessionsList.innerHTML = '<div class="sessions-empty">Failed to load sessions.</div>';
        }
    }

    cancelDeleteSession.addEventListener('click', function() {
        deleteSessionModal.hidden = true;
        deleteSessionEntryId = null;
    });

    deleteSessionModal.addEventListener('click', function(event) {
        if (event.target === deleteSessionModal) {
            deleteSessionModal.hidden = true;
            deleteSessionEntryId = null;
        }
    });

    confirmDeleteSession.addEventListener('click', async function() {
        if (!deleteSessionEntryId) return;
        confirmDeleteSession.disabled = true;
        confirmDeleteSession.textContent = 'Deleting…';
        try {
            const response = await fetch('/api/time/sessions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entry_id: deleteSessionEntryId })
            });
            const data = await response.json();
            if (response.ok) {
                deleteSessionModal.hidden = true;
                deleteSessionEntryId = null;
                loadSessions();
                loadStats();
                loadHeatmap();
            } else {
                alert(data.error || 'Failed to delete session.');
            }
        } catch (error) {
            console.error('Delete session error:', error);
            alert('Something went wrong. Please try again.');
        } finally {
            confirmDeleteSession.disabled = false;
            confirmDeleteSession.textContent = 'Yes, Delete';
        }
    });

    // EDIT MODAL

    function openEditModal(entryId, startTime, endTime) {
        document.getElementById('edit-entry-id').value = entryId;
        editError.hidden = true;

        editWarning.textContent = 'You have ' + currentEditsRemaining +
            ' edit' + (currentEditsRemaining !== 1 ? 's' : '') +
            ' remaining this month. This action cannot be undone.';

        const start = new Date(startTime);
        const end = new Date(endTime);
        document.getElementById('edit-start-time').value = formatDatetimeLocal(start);
        document.getElementById('edit-end-time').value = formatDatetimeLocal(end);

        editModal.hidden = false;
    }

    function formatDatetimeLocal(date) {
        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        var hours = String(date.getHours()).padStart(2, '0');
        var minutes = String(date.getMinutes()).padStart(2, '0');
        return year + '-' + month + '-' + day + 'T' + hours + ':' + minutes;
    }

    cancelEdit.addEventListener('click', function() { editModal.hidden = true; });
    editModal.addEventListener('click', function(event) {
        if (event.target === editModal) editModal.hidden = true;
    });

    editForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        editError.hidden = true;

        const entryId = document.getElementById('edit-entry-id').value;
        const startTime = new Date(document.getElementById('edit-start-time').value);
        const endTime = new Date(document.getElementById('edit-end-time').value);

        try {
            const response = await fetch('/api/time/sessions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entry_id: parseInt(entryId),
                    start_time: startTime.toISOString(),
                    end_time: endTime.toISOString()
                })
            });
            const data = await response.json();
            if (response.ok) {
                editModal.hidden = true;
                loadSessions();
                loadStats();
                loadHeatmap();
            } else {
                editError.textContent = data.error || 'Failed to save changes.';
                editError.hidden = false;
            }
        } catch (error) {
            console.error('Edit error:', error);
            editError.textContent = 'Something went wrong. Please try again.';
            editError.hidden = false;
        }
    });

    // PASSWORD

    passwordForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        passwordMessage.hidden = true;

        const currentPwd = document.getElementById('current-password').value;
        const newPwd = document.getElementById('new-password').value;
        const confirmPwd = document.getElementById('confirm-new-password').value;

        if (newPwd !== confirmPwd) {
            showPasswordMessage('New passwords do not match.', true);
            return;
        }

        try {
            const response = await fetch('/api/auth/me', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password: currentPwd, new_password: newPwd })
            });
            const data = await response.json();
            if (response.ok) {
                showPasswordMessage('Password changed successfully.', false);
                passwordForm.reset();
            } else {
                showPasswordMessage(data.error || 'Failed to change password.', true);
            }
        } catch (error) {
            console.error('Change password error:', error);
            showPasswordMessage('Something went wrong. Please try again.', true);
        }
    });

    function showPasswordMessage(message, isError) {
        passwordMessage.textContent = message;
        passwordMessage.className = isError ? 'error-message' : 'success-message';
        passwordMessage.hidden = false;
    }

    // EXPORT

    async function exportCSV() {
        try {
            const response = await fetch('/api/time/sessions?export=csv');
            const data = await response.json();
            if (!response.ok) {
                alert(data.error || 'Failed to export data');
                return;
            }
            const csv = convertToCSV(data.entries);
            downloadCSV(csv, userEmail.textContent + '-whistle-time-entries.csv');
        } catch (error) {
            console.error('Export error:', error);
            alert('Something went wrong. Please try again.');
        }
    }

    exportButton.addEventListener('click', async function() {
        exportButton.disabled = true;
        exportButton.textContent = 'Exporting…';
        await exportCSV();
        exportButton.disabled = false;
        exportButton.textContent = 'Export CSV';
    });

    modalExportButton.addEventListener('click', async function() {
        modalExportButton.disabled = true;
        modalExportButton.textContent = 'Downloading…';
        await exportCSV();
        modalExportButton.disabled = false;
        modalExportButton.textContent = 'Download CSV First';
    });

    function convertToCSV(entries) {
        const headers = ['Date', 'Day', 'Start Time', 'End Time', 'Duration (Hours)'];
        const rows = entries.map(function(e) {
            return [e.date, e.day_of_week, e.start_time, e.end_time, e.duration_hours];
        });
        return [headers].concat(rows).map(function(row) {
            return row.map(function(v) {
                return '"' + String(v).replace(/"/g, '""') + '"';
            }).join(',');
        }).join('\n');
    }

    function downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    // DELETE ACCOUNT

    deleteButton.addEventListener('click', function() { deleteModal.hidden = false; });
    cancelDelete.addEventListener('click', function() { deleteModal.hidden = true; });
    deleteModal.addEventListener('click', function(event) {
        if (event.target === deleteModal) deleteModal.hidden = true;
    });

    confirmDelete.addEventListener('click', async function() {
        confirmDelete.disabled = true;
        confirmDelete.textContent = 'Deleting…';
        try {
            const response = await fetch('/api/account/delete', { method: 'DELETE' });
            const data = await response.json();
            if (response.ok) {
                alert('Your account has been deleted.');
                window.location.href = '/index.html';
            } else {
                alert(data.error || 'Failed to delete account');
                deleteModal.hidden = true;
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('Something went wrong. Please try again.');
            deleteModal.hidden = true;
        } finally {
            confirmDelete.disabled = false;
            confirmDelete.textContent = 'Yes, Delete My Account';
        }
    });

    // HEATMAP

    async function loadHeatmap() {
        try {
            const response = await fetch('/api/time/heatmap');
            const data = await response.json();
            window.WhistleHeatmap.render({
                year: data.year,
                days: data.days,
                shiftLength: data.shift_length || currentShiftLength,
                gridEl: document.getElementById('profile-heatmap-grid'),
                monthsEl: document.getElementById('profile-heatmap-months'),
                hoverEl: document.getElementById('profile-heatmap-hover')
            });
        } catch (e) { console.error('Load heatmap error:', e); }
    }

    // LOGOUT

    logoutButton.addEventListener('click', async function() {
        try {
            var statusRes = await fetch('/api/time/status');
            var statusData = await statusRes.json();
            if (statusData.is_working) {
                if (!confirm('Signing out will clock you out. Continue?')) return;
            }
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/index.html';
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/index.html';
        }
    });

    // HELPERS
    function escapeAttr(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
            .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

});
