/* F42 — auth.js · shared auth utilities (ES module) */

import { supabase } from './supabase-client.js';
import { navigate } from './router.js';

/* Returns the current user's profile, or navigates to #login if no session. */
export async function guardSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { navigate('#login'); return null; }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, initials, couple_id')
    .eq('id', session.user.id)
    .single();

  if (!profile) { navigate('#login'); return null; }
  return profile;
}

/*
 * Fills the sidebar with real user data.
 * Expects elements with these IDs to exist in the page:
 *   #sidebar-avatar-me, #sidebar-avatar-partner
 */
export async function populateSidebar(profile) {
  const meEl      = document.getElementById('sidebar-avatar-me');
  const partnerEl = document.getElementById('sidebar-avatar-partner');

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
}

export async function signOut() {
  await supabase.auth.signOut();
  navigate('#landing');
}

/* Derives two-letter initials from a display name. */
export function computeInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
