/**
 * Renders auth header block: Sign in | Sign up, or Signed in as <email> | Log out.
 * Expects DOM elements with ids: auth-loading, auth-guest, auth-user, auth-user-email, auth-btn-login, auth-btn-signup, auth-btn-logout.
 */
(function () {
  function getEl(id) {
    return document.getElementById(id);
  }

  function showLoading() {
    var loading = getEl('auth-loading');
    var guest = getEl('auth-guest');
    var user = getEl('auth-user');
    if (loading) loading.style.display = '';
    if (guest) guest.style.display = 'none';
    if (user) user.style.display = 'none';
  }

  function showGuest() {
    var loading = getEl('auth-loading');
    var guest = getEl('auth-guest');
    var user = getEl('auth-user');
    if (loading) loading.style.display = 'none';
    if (guest) guest.style.display = '';
    if (user) user.style.display = 'none';
  }

  function getInitial(str) {
    if (!str || typeof str !== 'string') return '?';
    var trimmed = str.trim();
    if (!trimmed) return '?';
    var first = trimmed[0].toUpperCase();
    return /[A-Z0-9]/.test(first) ? first : '?';
  }

  function showUser(email) {
    var loading = getEl('auth-loading');
    var guest = getEl('auth-guest');
    var user = getEl('auth-user');
    var emailEl = getEl('auth-user-email');
    var profileEmailEl = getEl('auth-profile-email');
    var initialEl = getEl('auth-user-initial');
    if (loading) loading.style.display = 'none';
    if (guest) guest.style.display = 'none';
    if (user) user.style.display = 'flex';
    var text = email || 'Signed in';
    if (emailEl) emailEl.textContent = text;
    if (profileEmailEl) profileEmailEl.textContent = text;
    if (initialEl) initialEl.textContent = getInitial(text);
  }

  function setupProfileDropdown() {
    var trigger = getEl('auth-profile-trigger');
    var menu = getEl('auth-profile-menu');
    if (!trigger || !menu) return;
    function isOpen() { return trigger.getAttribute('aria-expanded') === 'true'; }
    function open() {
      trigger.setAttribute('aria-expanded', 'true');
      menu.removeAttribute('hidden');
    }
    function close() {
      trigger.setAttribute('aria-expanded', 'false');
      menu.setAttribute('hidden', '');
    }
    function toggle() {
      if (isOpen()) close(); else open();
    }
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      toggle();
    });
    menu.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () {
      if (isOpen()) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) close();
    });
  }

  function bindButtons() {
    var loginBtn = getEl('auth-btn-login');
    var signupBtn = getEl('auth-btn-signup');
    var logoutBtn = getEl('auth-btn-logout');
    function onLogin() {
      if (!window.auth0Api) return;
      window.auth0Api.login().catch(function () {
        console.warn('Auth0 not configured. Set window.__auth0Config in js/auth0-config.js');
      });
    }
    function onSignup() {
      if (!window.auth0Api) return;
      window.auth0Api.signup().catch(function () {
        console.warn('Auth0 not configured. Set window.__auth0Config in js/auth0-config.js');
      });
    }
    if (loginBtn) loginBtn.addEventListener('click', onLogin);
    if (signupBtn) signupBtn.addEventListener('click', onSignup);
    if (logoutBtn) logoutBtn.addEventListener('click', function () { window.auth0Api && window.auth0Api.logout(); });
  }

  function updateHeader() {
    if (!window.auth0Api) {
      showGuest();
      return;
    }
    window.auth0Api.ready
      .then(function (client) {
        if (!client) {
          showGuest();
          return;
        }
        return window.auth0Api.isAuthenticated();
      })
      .then(function (authenticated) {
        if (authenticated) {
          return window.auth0Api.getUser().then(function (u) {
            var email = (u && (u.email || u.name)) || 'Signed in';
            showUser(email);
          });
        }
        showGuest();
      })
      .catch(function () {
        showGuest();
      });
  }

  function init() {
    showLoading();
    bindButtons();
    setupProfileDropdown();
    if (window.auth0Api && window.auth0Api.ready) {
      window.auth0Api.ready.then(updateHeader).catch(showGuest);
    } else {
      showGuest();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
