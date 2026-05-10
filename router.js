/* F42 — router.js · hash-based SPA router */

import { supabase } from './supabase-client.js';

const ROUTES = {
  landing:  { el: '#view-landing',  shell: false, auth: false },
  login:    { el: '#view-login',    shell: false, auth: false },
  signup:   { el: '#view-signup',   shell: false, auth: false },
  pair:     { el: '#view-pair',     shell: false, auth: true  },
  feed:     { el: '#view-feed',     shell: true,  auth: true  },
  workouts: { el: '#view-workouts', shell: true,  auth: true  },
  goals:    { el: '#view-goals',    shell: true,  auth: true  },
};

const viewHandlers = {};
let teardownFn = null;

export function registerView(route, { init } = {}) {
  viewHandlers[route] = { init };
}

export function navigate(hash) {
  const route = (hash || '').replace(/^#/, '') || 'landing';
  if (location.hash !== '#' + route) history.pushState(null, '', '#' + route);
  _show(route);
}

async function _show(route) {
  const config = ROUTES[route];
  if (!config) return; // in-page anchor (e.g. #features), let browser handle it

  if (config.auth) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('#login'); return; }
  }

  if (teardownFn) { teardownFn(); teardownFn = null; }

  // Hide all view sections
  document.querySelectorAll('[data-view]').forEach(el => el.hidden = true);

  // Show/hide the app shell (sidebar + app views)
  const appShell = document.getElementById('app-shell');
  if (appShell) appShell.hidden = !config.shell;

  // Show the target view
  const viewEl = document.querySelector(config.el);
  if (viewEl) viewEl.hidden = false;

  // Update nav active state
  document.querySelectorAll('[data-route]').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route);
  });

  // Update page title
  const titles = {
    landing:  'F42 — Fit For Two',
    login:    'F42 — Sign in',
    signup:   'F42 — Create account',
    pair:     'F42 — Connect with partner',
    feed:     'F42 — Feed',
    workouts: 'F42 — Workouts',
    goals:    'F42 — Goals',
  };
  document.title = titles[route] ?? 'F42';

  // Run the view's init and store its teardown
  const handler = viewHandlers[route];
  if (handler?.init) teardownFn = (await handler.init()) ?? null;
}

window.addEventListener('hashchange', () => {
  _show(location.hash.replace(/^#/, '') || 'landing');
});

export function bootRouter() {
  const hash = location.hash;
  // Let Supabase consume auth-callback hashes (email confirmation, OAuth)
  if (hash.includes('access_token') || hash.includes('type=')) {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) navigate('#feed');
    });
    return;
  }
  _show(hash.replace(/^#/, '') || 'landing');
}
