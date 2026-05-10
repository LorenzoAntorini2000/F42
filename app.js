/* F42 — app.js · SPA entry point */

import { supabase } from './supabase-client.js';
import { guardSession, populateSidebar, signOut, computeInitials } from './auth.js';
import { registerView, navigate, bootRouter } from './router.js';

// Wire sign-out button once (shared sidebar element)
document.getElementById('btn-signout').addEventListener('click', signOut);

/* ════════════════════════════════════════════════
   LANDING VIEW
   ════════════════════════════════════════════════ */

async function initLanding() {
  // If already signed in, skip landing and go to the app
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const { data: profile } = await supabase
      .from('profiles').select('couple_id').eq('id', session.user.id).single();
    navigate(profile?.couple_id ? '#feed' : '#pair');
  }
}

/* ════════════════════════════════════════════════
   LOGIN VIEW
   ════════════════════════════════════════════════ */

async function initLogin() {
  // If already signed in, redirect
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const { profile } = await resolveProfile(session.user);
    if (profile) { navigate(profile.couple_id ? '#feed' : '#pair'); return; }
    await supabase.auth.signOut();
  }

  const btn   = document.getElementById('btn-login');
  const error = document.getElementById('login-error');

  function showError(msg) {
    error.textContent = msg;
    error.classList.add('visible');
  }

  async function handleLogin() {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    error.classList.remove('visible');
    if (!email || !password) { showError('Please fill in all fields.'); return; }

    btn.disabled    = true;
    btn.textContent = 'Signing in…';

    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });

    if (authErr) {
      showError(authErr.message);
      btn.disabled    = false;
      btn.textContent = 'Sign in';
      return;
    }

    const { profile, dbError } = await resolveProfile(data.user);
    if (profile) {
      navigate(profile.couple_id ? '#feed' : '#pair');
    } else {
      showError(dbError || 'Profile could not be loaded. Check the browser console for details.');
      btn.disabled    = false;
      btn.textContent = 'Sign in';
    }
  }

  function handleKeydown(e) { if (e.key === 'Enter') handleLogin(); }

  btn.addEventListener('click', handleLogin);
  document.getElementById('login-password').addEventListener('keydown', handleKeydown);

  return function teardown() {
    btn.removeEventListener('click', handleLogin);
    document.getElementById('login-password').removeEventListener('keydown', handleKeydown);
    error.classList.remove('visible');
    document.getElementById('login-email').value    = '';
    document.getElementById('login-password').value = '';
    btn.disabled    = false;
    btn.textContent = 'Sign in';
  };
}

/* ════════════════════════════════════════════════
   SIGNUP VIEW
   ════════════════════════════════════════════════ */

async function initSignup() {
  // If already signed in, redirect
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const { data: profile } = await supabase
      .from('profiles').select('couple_id').eq('id', session.user.id).single();
    navigate(profile?.couple_id ? '#feed' : '#pair');
    return;
  }

  const btn    = document.getElementById('btn-signup');
  const errEl  = document.getElementById('signup-error');
  const succEl = document.getElementById('signup-success');

  function showError(msg) {
    errEl.textContent = msg;
    errEl.classList.add('visible');
    succEl.classList.remove('visible');
  }

  async function handleSignup() {
    const name     = document.getElementById('signup-name').value.trim();
    const email    = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    errEl.classList.remove('visible');
    succEl.classList.remove('visible');

    if (!name || !email || !password) { showError('Please fill in all fields.'); return; }
    if (password.length < 6)          { showError('Password must be at least 6 characters.'); return; }

    btn.disabled    = true;
    btn.textContent = 'Creating account…';

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: name, initials: computeInitials(name) } },
    });

    if (error) {
      showError(error.message);
      btn.disabled    = false;
      btn.textContent = 'Create account';
      return;
    }

    if (data.session) {
      navigate('#pair');
    } else {
      succEl.textContent = 'Account created! Check your email and click the confirmation link, then come back to sign in.';
      succEl.classList.add('visible');
      btn.disabled    = false;
      btn.textContent = 'Create account';
    }
  }

  btn.addEventListener('click', handleSignup);

  return function teardown() {
    btn.removeEventListener('click', handleSignup);
    errEl.classList.remove('visible');
    succEl.classList.remove('visible');
    document.getElementById('signup-name').value     = '';
    document.getElementById('signup-email').value    = '';
    document.getElementById('signup-password').value = '';
    btn.disabled    = false;
    btn.textContent = 'Create account';
  };
}

/* ════════════════════════════════════════════════
   PAIR VIEW
   ════════════════════════════════════════════════ */

async function initPair() {
  const profile = await guardSession();
  if (!profile) return;

  let pollTimer = null;

  function generateCode() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  const formatCode    = c => c.slice(0, 4) + '-' + c.slice(4);
  const normalizeCode = s => s.toUpperCase().replace(/[-\s]/g, '');

  function showState(id) {
    ['state-create', 'state-waiting', 'state-connected'].forEach(s => {
      document.getElementById(s).style.display = s === id ? '' : 'none';
    });
  }

  function showCreateError(msg) {
    const el = document.getElementById('create-error');
    el.textContent = msg; el.classList.add('visible');
  }

  function showJoinError(msg) {
    const el = document.getElementById('join-error');
    el.textContent = msg; el.classList.add('visible');
  }

  function clearErrors() {
    document.querySelectorAll('.pair-error').forEach(e => e.classList.remove('visible'));
  }

  function startPolling(coupleId) {
    pollTimer = setInterval(async () => {
      const { data } = await supabase
        .from('couples').select('user_b_id').eq('id', coupleId).single();
      if (data?.user_b_id) partnerConnected();
    }, 3000);
  }

  function partnerConnected() {
    clearInterval(pollTimer);
    pollTimer = null;
    showState('state-connected');
    setTimeout(() => navigate('#feed'), 2200);
  }

  // Init: check if already in a couple
  let couple = null;
  if (profile.couple_id) {
    const { data } = await supabase
      .from('couples').select('id, user_a_id, user_b_id, invite_code')
      .eq('id', profile.couple_id).single();
    couple = data;
    if (couple?.user_b_id) { navigate('#feed'); return; }
  }

  if (couple) {
    document.getElementById('code-display').textContent = formatCode(couple.invite_code);
    showState('state-waiting');
    startPolling(couple.id);
  } else {
    showState('state-create');
  }

  // Generate code button
  async function handleGenerate() {
    clearErrors();
    const btn = document.getElementById('btn-generate');
    btn.disabled    = true;
    btn.textContent = 'Generating…';

    const code = generateCode();
    const { data: newCouple, error } = await supabase
      .from('couples').insert({ user_a_id: profile.id, invite_code: code }).select().single();

    if (error) {
      showCreateError(error.message);
      btn.disabled    = false;
      btn.textContent = 'Generate invite code';
      return;
    }

    const { error: profileErr } = await supabase
      .from('profiles').update({ couple_id: newCouple.id }).eq('id', profile.id);

    if (profileErr) {
      showCreateError('Failed to save your couple link. Please try again.');
      btn.disabled    = false;
      btn.textContent = 'Generate invite code';
      return;
    }

    document.getElementById('code-display').textContent = formatCode(newCouple.invite_code);
    showState('state-waiting');
    startPolling(newCouple.id);
  }

  // Join with code
  async function attemptJoin() {
    clearErrors();
    const raw  = document.getElementById('input-join-code').value;
    const code = normalizeCode(raw);

    if (!code)            { showJoinError('Please enter a code.'); return; }
    if (code.length !== 8){ showJoinError('Codes are 8 characters — check for typos.'); return; }

    const joinBtn = document.getElementById('btn-join');
    joinBtn.disabled    = true;
    joinBtn.textContent = 'Joining…';

    const { data: status, error: rpcErr } = await supabase.rpc('check_invite_code', { p_code: code });

    if (rpcErr || !status) {
      showJoinError('Something went wrong. Please try again.');
      joinBtn.disabled    = false;
      joinBtn.textContent = 'Join';
      return;
    }

    const errorMessages = {
      not_found: 'Code not found. Check it and try again.',
      used:      'This code has already been used.',
      own:       'This is your own invite code. Share it with your partner.',
    };
    if (errorMessages[status]) {
      showJoinError(errorMessages[status]);
      joinBtn.disabled    = false;
      joinBtn.textContent = 'Join';
      return;
    }

    const { data: rows } = await supabase
      .from('couples').select('id').eq('invite_code', code).is('user_b_id', null);

    if (!rows?.length) {
      showJoinError('This code has already been used.');
      joinBtn.disabled    = false;
      joinBtn.textContent = 'Join';
      return;
    }

    const { error: updateErr } = await supabase
      .from('couples').update({ user_b_id: profile.id }).eq('id', rows[0].id).is('user_b_id', null);

    if (updateErr) {
      showJoinError('This code has already been used.');
      joinBtn.disabled    = false;
      joinBtn.textContent = 'Join';
      return;
    }

    const { error: joinProfileErr } = await supabase
      .from('profiles').update({ couple_id: rows[0].id }).eq('id', profile.id);

    if (joinProfileErr) {
      showJoinError('Failed to save your couple link. Please try again.');
      joinBtn.disabled    = false;
      joinBtn.textContent = 'Join';
      return;
    }

    navigate('#feed');
  }

  function handleJoinKeydown(e) { if (e.key === 'Enter') attemptJoin(); }

  // Copy button
  async function handleCopy() {
    const code = document.getElementById('code-display').textContent;
    try { await navigator.clipboard.writeText(code); } catch {
      const ta = document.createElement('textarea');
      ta.value = code; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    const btn = document.getElementById('btn-copy');
    btn.textContent = '✓ Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Copy code`;
      btn.classList.remove('copied');
    }, 2000);
  }

  document.getElementById('btn-generate').addEventListener('click', handleGenerate);
  document.getElementById('btn-join').addEventListener('click', attemptJoin);
  document.getElementById('input-join-code').addEventListener('keydown', handleJoinKeydown);
  document.getElementById('btn-copy').addEventListener('click', handleCopy);
  document.getElementById('btn-switch-account').addEventListener('click', async (e) => {
    e.preventDefault(); await signOut();
  });

  return function teardown() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    document.getElementById('btn-generate').removeEventListener('click', handleGenerate);
    document.getElementById('btn-join').removeEventListener('click', attemptJoin);
    document.getElementById('input-join-code').removeEventListener('keydown', handleJoinKeydown);
    document.getElementById('btn-copy').removeEventListener('click', handleCopy);
    clearErrors();
    document.getElementById('input-join-code').value = '';
    showState('state-create');
  };
}

/* ════════════════════════════════════════════════
   FEED VIEW
   ════════════════════════════════════════════════ */

const DAILY_KCAL_GOAL    = 2000;
const WEEKLY_ENTRIES_MAX = 14;

async function initFeed() {
  const profile = await guardSession();
  if (!profile) return;

  if (!profile.couple_id) { navigate('#pair'); return; }

  const { data: partnerRow } = await supabase
    .from('profiles').select('id, display_name, initials')
    .eq('couple_id', profile.couple_id).neq('id', profile.id).maybeSingle();
  const partner = partnerRow;

  /* ── helpers ── */

  function skeletonHTML() {
    const card = `
      <div class="feed-skeleton">
        <div class="skeleton feed-skeleton-avatar"></div>
        <div class="feed-skeleton-body">
          <div class="skeleton feed-skeleton-line feed-skeleton-line--short"></div>
          <div class="skeleton feed-skeleton-line feed-skeleton-line--long"></div>
          <div class="skeleton feed-skeleton-line feed-skeleton-line--med"></div>
        </div>
      </div>`;
    return card + card + card;
  }

  function populateReactionCounts(reactions) {
    const grouped = {};
    for (const r of reactions) {
      const key = `${r.entry_id}::${r.emoji}`;
      if (!grouped[key]) grouped[key] = { entry_id: r.entry_id, emoji: r.emoji, users: [] };
      grouped[key].users.push(r.user_id);
    }
    for (const { entry_id, emoji, users } of Object.values(grouped)) {
      const entryEl = document.querySelector(`[data-entry-id="${entry_id}"]`);
      if (!entryEl) continue;
      const reactionsEl = entryEl.querySelector('.entry-reactions');
      const count    = users.length;
      const iReacted = users.includes(profile.id);
      const existing = Array.from(reactionsEl.querySelectorAll('.react-btn'))
        .find(b => b.querySelector('span') && b.textContent.trimStart().startsWith(emoji));
      if (existing) {
        existing.querySelector('span').textContent = count;
        if (iReacted) existing.classList.add('reacted');
      } else {
        const btn = document.createElement('button');
        btn.className = 'react-btn' + (iReacted ? ' reacted' : '');
        btn.innerHTML = `${emoji} <span>${count}</span>`;
        btn.onclick = () => addReaction(btn, emoji);
        const addBtn = reactionsEl.querySelector('.react-btn--add');
        reactionsEl.insertBefore(btn, addBtn);
      }
    }
  }

  async function loadFeed() {
    const feed = document.getElementById('feed');
    feed.innerHTML = skeletonHTML();

    const { data: entries, error } = await supabase
      .from('feed_entries')
      .select(`
        id, user_id, entry_type, title,
        kcal, protein_g, carbs_g, fat_g,
        duration_min, distance_km, logged_at,
        profile:profiles(display_name, initials)
      `)
      .eq('couple_id', profile.couple_id)
      .order('logged_at', { ascending: false })
      .limit(50);

    feed.innerHTML = '';

    if (error || !entries?.length) {
      feed.innerHTML = `
        <div class="feed-empty">
          <div class="feed-empty-icon">🥗</div>
          <div class="feed-empty-title">Nothing here yet</div>
          <p class="feed-empty-body">Log your first meal or workout to start your shared feed.</p>
        </div>`;
      return;
    }

    entries.forEach((row, i) => {
      const el = buildEntryFromRow(row, profile.id);
      if (!el) return;
      el.style.animationDelay = `${i * 60}ms`;
      feed.appendChild(el);
    });

    const { data: reactions } = await supabase
      .from('reactions').select('entry_id, user_id, emoji')
      .in('entry_id', entries.map(e => e.id));
    if (reactions?.length) populateReactionCounts(reactions);
  }

  async function loadSummary() {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const { data: entries } = await supabase
      .from('feed_entries').select('user_id, kcal')
      .eq('couple_id', profile.couple_id).eq('entry_type', 'meal')
      .gte('logged_at', start).lt('logged_at', end);

    const sum = (uid) =>
      (entries || []).filter(e => e.user_id === uid).reduce((s, e) => s + (e.kcal || 0), 0);

    const myKcal      = sum(profile.id);
    const partnerKcal = partner ? sum(partner.id) : 0;
    const pct         = v => `${Math.min(100, Math.round((v / DAILY_KCAL_GOAL) * 100))}%`;

    document.getElementById('summary-label-me').textContent      = `${profile.display_name} · calories`;
    document.getElementById('summary-bar-me').style.width        = pct(myKcal);
    document.getElementById('summary-val-me').textContent        = `${myKcal.toLocaleString()} / ${DAILY_KCAL_GOAL.toLocaleString()} kcal`;

    const partnerName = partner?.display_name ?? 'Partner';
    document.getElementById('summary-label-partner').textContent = `${partnerName} · calories`;
    document.getElementById('summary-bar-partner').style.width   = pct(partnerKcal);
    document.getElementById('summary-val-partner').textContent   = `${partnerKcal.toLocaleString()} / ${DAILY_KCAL_GOAL.toLocaleString()} kcal`;
  }

  async function updateCoupleScore() {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { count } = await supabase
      .from('feed_entries').select('id', { count: 'exact', head: true })
      .eq('couple_id', profile.couple_id).gte('logged_at', since.toISOString());

    const score = Math.min(100, Math.round(((count || 0) / WEEKLY_ENTRIES_MAX) * 100));
    const el    = document.getElementById('sidebar-score');
    if (el) el.textContent = score;
  }

  /* ── init ── */

  window.__f42 = { supabase, profile, partner, reloadFeed: loadFeed, reloadSummary: loadSummary };

  await Promise.all([populateSidebar(profile), loadFeed(), loadSummary(), updateCoupleScore()]);

  /* ── real-time subscriptions ── */

  const feedEl = document.getElementById('feed');

  const ch1 = supabase
    .channel('rt-feed-entries')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'feed_entries',
      filter: `couple_id=eq.${profile.couple_id}`,
    }, async (payload) => {
      const { data: row } = await supabase
        .from('feed_entries')
        .select(`
          id, user_id, entry_type, title,
          kcal, protein_g, carbs_g, fat_g,
          duration_min, distance_km, logged_at,
          profile:profiles(display_name, initials)
        `)
        .eq('id', payload.new.id).single();
      if (!row) return;

      const placeholder = feedEl.querySelector('.feed-empty, .feed-loading');
      if (placeholder) placeholder.remove();

      const el = buildEntryFromRow(row, profile.id);
      if (!el) return;
      el.style.animationDelay = '0ms';
      feedEl.prepend(el);

      if (row.entry_type === 'meal') await loadSummary();
      await updateCoupleScore();
    })
    .subscribe();

  const ch2 = supabase
    .channel('rt-reactions')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'reactions',
    }, (payload) => {
      const { entry_id, user_id, emoji } = payload.new;
      if (user_id === profile.id) return;
      const entryEl = feedEl.querySelector(`[data-entry-id="${entry_id}"]`);
      if (!entryEl) return;
      const reactionsEl = entryEl.querySelector('.entry-reactions');
      const existing = Array.from(reactionsEl.querySelectorAll('.react-btn'))
        .find(b => b.querySelector('span') && b.textContent.trimStart().startsWith(emoji));
      if (existing) {
        const span = existing.querySelector('span');
        span.textContent = parseInt(span.textContent, 10) + 1;
      } else {
        const btn = document.createElement('button');
        btn.className = 'react-btn';
        btn.innerHTML = `${emoji} <span>1</span>`;
        btn.onclick = () => addReaction(btn, emoji);
        reactionsEl.insertBefore(btn, reactionsEl.querySelector('.react-btn--add'));
      }
    })
    .on('postgres_changes', {
      event: 'DELETE', schema: 'public', table: 'reactions',
    }, (payload) => {
      const { entry_id, user_id, emoji } = payload.old;
      if (user_id === profile.id) return;
      const entryEl = feedEl.querySelector(`[data-entry-id="${entry_id}"]`);
      if (!entryEl) return;
      const reactionsEl = entryEl.querySelector('.entry-reactions');
      const btn = Array.from(reactionsEl.querySelectorAll('.react-btn'))
        .find(b => b.querySelector('span') && b.textContent.trimStart().startsWith(emoji));
      if (!btn) return;
      const span = btn.querySelector('span');
      const newCount = parseInt(span.textContent, 10) - 1;
      if (newCount <= 0 && !btn.hasAttribute('data-preset')) {
        btn.remove();
      } else {
        span.textContent = Math.max(0, newCount);
      }
    })
    .subscribe();

  return function teardown() {
    supabase.removeChannel(ch1);
    supabase.removeChannel(ch2);
    window.__f42 = null;
  };
}

/* ════════════════════════════════════════════════
   WORKOUTS VIEW
   ════════════════════════════════════════════════ */

async function initWorkouts() {
  const profile = await guardSession();
  if (!profile) return;
  await populateSidebar(profile);
}

/* ════════════════════════════════════════════════
   GOALS VIEW
   ════════════════════════════════════════════════ */

async function initGoals() {
  const profile = await guardSession();
  if (!profile) return;
  await populateSidebar(profile);
}

/* ════════════════════════════════════════════════
   SHARED HELPER — resolveProfile
   ════════════════════════════════════════════════ */

async function resolveProfile(user) {
  const { data: profile, error: selectErr } = await supabase
    .from('profiles').select('couple_id').eq('id', user.id).single();

  if (profile) return { profile, dbError: null };

  const isNotFound = selectErr?.code === 'PGRST116';
  if (selectErr && !isNotFound) {
    return { profile: null, dbError: `SELECT failed: ${selectErr.message} (${selectErr.code})` };
  }

  const name = user.user_metadata?.display_name || user.email.split('@')[0];
  const { error: insertErr } = await supabase.from('profiles').insert({
    id: user.id, display_name: name, initials: computeInitials(name),
  });

  if (insertErr) {
    return { profile: null, dbError: `INSERT failed: ${insertErr.message} (${insertErr.code})` };
  }

  const { data: refetched, error: refetchErr } = await supabase
    .from('profiles').select('couple_id').eq('id', user.id).single();

  if (refetchErr || !refetched) {
    return { profile: null, dbError: `Re-fetch after insert failed: ${refetchErr?.message}` };
  }

  return { profile: refetched, dbError: null };
}

/* ════════════════════════════════════════════════
   REGISTER + BOOT
   ════════════════════════════════════════════════ */

registerView('landing',  { init: initLanding  });
registerView('login',    { init: initLogin    });
registerView('signup',   { init: initSignup   });
registerView('pair',     { init: initPair     });
registerView('feed',     { init: initFeed     });
registerView('workouts', { init: initWorkouts });
registerView('goals',    { init: initGoals    });

bootRouter();
