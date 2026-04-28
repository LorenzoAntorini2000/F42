/* F42 — auth.js · shared auth utilities (ES module) */

import { supabase } from './supabase-client.js';

/* Returns the current user's profile, or redirects to login.html if no session. */
export async function guardSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace('login.html');
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, initials, couple_id')
    .eq('id', session.user.id)
    .single();

  if (!profile) {
    window.location.replace('login.html');
    return null;
  }

  return profile;
}

/*
 * Fills the sidebar with real user data.
 * Expects elements with these IDs to exist in the page:
 *   #sidebar-avatar-me, #sidebar-avatar-partner, #btn-signout
 */
export async function populateSidebar(profile) {
  const meEl      = document.getElementById('sidebar-avatar-me');
  const partnerEl = document.getElementById('sidebar-avatar-partner');
  const signoutEl = document.getElementById('btn-signout');

  if (meEl) meEl.textContent = profile.initials;

  if (partnerEl && profile.couple_id) {
    const { data: partners } = await supabase
      .from('profiles')
      .select('initials')
      .eq('couple_id', profile.couple_id)
      .neq('id', profile.id);

    partnerEl.textContent = partners?.[0]?.initials ?? '?';
  } else if (partnerEl) {
    partnerEl.textContent = '?';
  }

  if (signoutEl) {
    signoutEl.addEventListener('click', signOut);
  }
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.replace('login.html');
}

/* Derives two-letter initials from a display name. */
export function computeInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
