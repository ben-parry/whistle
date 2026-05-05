// ============================================
// AUTH.JS - Login and Registration Logic
// ============================================

document.addEventListener('DOMContentLoaded', function() {

    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');

    // Check if already logged in
    checkIfLoggedIn();

    async function checkIfLoggedIn() {
        try {
            const response = await fetch('/api/auth/me');
            const data = await response.json();
            if (data.user) {
                window.location.href = '/app.html';
            }
        } catch (error) {
            console.log('Not logged in');
        }
    }

    const formTitle = document.getElementById('auth-form-title');
    const formSub = document.getElementById('auth-form-sub');
    const altText = document.getElementById('auth-alt-text');
    const altLink = document.getElementById('auth-alt-link');

    function showSignIn() {
        loginForm.hidden = false;
        registerForm.hidden = true;
        loginTab.classList.add('is-active');
        registerTab.classList.remove('is-active');
        if (formTitle) formTitle.textContent = 'Return to your post';
        if (formSub) formSub.textContent = 'The whistle blows soon. Sign in to clock the day.';
        if (altText) altText.textContent = 'Forgot your password? ';
        if (altLink) {
            altLink.textContent = 'Contact ben@benparry.ca';
            altLink.href = 'mailto:ben@benparry.ca';
        }
        hideMessages();
    }

    function showRegister() {
        loginForm.hidden = true;
        registerForm.hidden = false;
        loginTab.classList.remove('is-active');
        registerTab.classList.add('is-active');
        if (formTitle) formTitle.textContent = 'Open your ledger';
        if (formSub) formSub.textContent = 'Tell us your name and the kind of day you keep.';
        if (altText) altText.textContent = 'Already keep a ledger? ';
        if (altLink) {
            altLink.textContent = 'Sign in instead';
            altLink.href = '#';
            altLink.onclick = function(e) { e.preventDefault(); showSignIn(); };
        }
        hideMessages();
    }

    loginTab.addEventListener('click', showSignIn);
    registerTab.addEventListener('click', showRegister);

    // Login
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        hideMessages();

        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                showSuccess('Login successful! Redirecting...');
                setTimeout(function() {
                    window.location.href = '/app.html';
                }, 500);
            } else {
                showError(data.error || 'Login failed. Please try again.');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Something went wrong. Please try again.');
        }
    });

    // Register
    registerForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        hideMessages();

        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const shiftLength = parseInt(document.getElementById('register-shift-length').value, 10);
        // Client-side name validation
        if (/\d/.test(name)) {
            showError('Names cannot contain numbers.');
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name, shift_length: shiftLength })
            });

            const data = await response.json();

            if (response.ok) {
                showSuccess('Account created! Redirecting...');
                setTimeout(function() {
                    window.location.href = '/app.html';
                }, 500);
            } else {
                showError(data.error || 'Registration failed. Please try again.');
            }
        } catch (error) {
            console.error('Registration error:', error);
            showError('Something went wrong. Please try again.');
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.hidden = false;
        successMessage.hidden = true;
    }

    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.hidden = false;
        errorMessage.hidden = true;
    }

    function hideMessages() {
        errorMessage.hidden = true;
        successMessage.hidden = true;
    }

});
