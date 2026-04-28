/* F42 — feed.js · feed interactions (classic script, global scope) */

/* ── Reactions ── */

async function addReaction(btn, emoji) {
  const countEl   = btn.querySelector('span');
  const isReacted = btn.classList.contains('reacted');
  const count     = parseInt(countEl.textContent, 10);

  // Optimistic DOM update
  if (isReacted) {
    btn.classList.remove('reacted');
    countEl.textContent = Math.max(0, count - 1);
  } else {
    btn.classList.add('reacted');
    countEl.textContent = count + 1;
  }

  const entryId = btn.closest('[data-entry-id]')?.dataset.entryId;
  if (!entryId) return;

  const { supabase, profile } = window.__f42;
  if (isReacted) {
    await supabase.from('reactions').delete()
      .eq('entry_id', entryId).eq('user_id', profile.id).eq('emoji', emoji);
  } else {
    await supabase.from('reactions').insert({ entry_id: entryId, user_id: profile.id, emoji });
  }
}

const EMOJI_OPTIONS = ['🔥', '❤️', '👏', '💪', '😍', '🥗'];

function showReactPicker(addBtn) {
  document.querySelectorAll('.react-picker').forEach(p => p.remove());

  const picker = document.createElement('div');
  picker.className = 'react-picker';
  picker.style.cssText = `
    display:inline-flex;gap:4px;align-items:center;
    background:var(--bg-card);border:1px solid var(--border);
    border-radius:99px;padding:4px 8px;margin-left:4px;
    animation:entryIn 0.15s ease both;
  `;

  EMOJI_OPTIONS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.className = 'react-btn';
    btn.style.cssText = 'border:none;background:none;padding:2px 4px;font-size:1rem;cursor:pointer;';
    btn.textContent = emoji;
    btn.onclick = () => {
      const reactions = addBtn.closest('.entry-reactions');
      const existing = Array.from(reactions.querySelectorAll('.react-btn'))
        .find(b => b.querySelector('span') && b.textContent.trimStart().startsWith(emoji));

      if (existing && existing !== addBtn) {
        addReaction(existing, emoji);
      } else {
        const entryId = addBtn.closest('[data-entry-id]')?.dataset.entryId;
        const newBtn = document.createElement('button');
        newBtn.className = 'react-btn reacted';
        newBtn.innerHTML = `${emoji} <span>1</span>`;
        newBtn.onclick = () => addReaction(newBtn, emoji);
        reactions.insertBefore(newBtn, addBtn);

        if (entryId) {
          const { supabase, profile } = window.__f42;
          supabase.from('reactions').insert({ entry_id: entryId, user_id: profile.id, emoji });
        }
      }
      picker.remove();
    };
    picker.appendChild(btn);
  });

  addBtn.after(picker);
  setTimeout(() => {
    document.addEventListener('click', () => picker.remove(), { once: true });
  }, 0);
}

/* ── Log modal ── */

function openLogModal(type) {
  const overlay = document.getElementById('modal-overlay');
  const title   = document.getElementById('modal-title');
  const body    = document.getElementById('modal-body');

  title.textContent = type === 'meal' ? 'Log a meal' : 'Log a workout';
  body.innerHTML    = type === 'meal' ? mealForm() : workoutForm();
  overlay.classList.add('open');

  setTimeout(() => body.querySelector('input')?.focus(), 80);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

function mealForm() {
  return `
    <div class="form-group">
      <label class="form-label">Meal name</label>
      <input class="form-input" type="text" id="meal-name" placeholder="e.g. Grilled salmon with rice" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Calories (kcal)</label>
        <input class="form-input" type="number" id="meal-kcal" placeholder="500" min="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Protein (g)</label>
        <input class="form-input" type="number" id="meal-protein" placeholder="30" min="0" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Carbs (g)</label>
        <input class="form-input" type="number" id="meal-carbs" placeholder="50" min="0" />
      </div>
      <div class="form-group">
        <label class="form-label">Fat (g)</label>
        <input class="form-input" type="number" id="meal-fat" placeholder="15" min="0" />
      </div>
    </div>
    <button class="form-submit" id="form-submit-btn" onclick="submitMeal()">Add to feed</button>
  `;
}

function workoutForm() {
  return `
    <div class="form-group">
      <label class="form-label">Activity</label>
      <input class="form-input" type="text" id="workout-name" placeholder="e.g. Morning run, Yoga, Gym session" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Duration (min)</label>
        <input class="form-input" type="number" id="workout-min" placeholder="45" min="1" />
      </div>
      <div class="form-group">
        <label class="form-label">Calories burned</label>
        <input class="form-input" type="number" id="workout-kcal" placeholder="300" min="0" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Distance (km, optional)</label>
      <input class="form-input" type="number" id="workout-km" placeholder="5.0" step="0.1" min="0" />
    </div>
    <button class="form-submit" id="form-submit-btn" onclick="submitWorkout()">Add to feed</button>
  `;
}

/* ── Submit handlers ── */

async function submitMeal() {
  const name    = document.getElementById('meal-name')?.value.trim();
  const kcal    = parseInt(document.getElementById('meal-kcal')?.value)    || null;
  const protein = parseInt(document.getElementById('meal-protein')?.value) || null;
  const carbs   = parseInt(document.getElementById('meal-carbs')?.value)   || null;
  const fat     = parseInt(document.getElementById('meal-fat')?.value)     || null;

  if (!name) { document.getElementById('meal-name').focus(); return; }

  const btn = document.getElementById('form-submit-btn');
  btn.disabled    = true;
  btn.textContent = 'Adding…';

  const { supabase, profile, reloadSummary } = window.__f42;

  const { error } = await supabase.from('feed_entries').insert({
    couple_id:  profile.couple_id,
    user_id:    profile.id,
    entry_type: 'meal',
    title:      name,
    kcal,
    protein_g:  protein,
    carbs_g:    carbs,
    fat_g:      fat,
  });

  if (error) {
    btn.disabled    = false;
    btn.textContent = 'Add to feed';
    console.error('submitMeal:', error);
    return;
  }

  closeModal();
  await reloadSummary(); // update bars immediately; realtime subscription renders the new entry
}

async function submitWorkout() {
  const name = document.getElementById('workout-name')?.value.trim();
  const min  = parseInt(document.getElementById('workout-min')?.value)   || null;
  const kcal = parseInt(document.getElementById('workout-kcal')?.value)  || null;
  const km   = parseFloat(document.getElementById('workout-km')?.value)  || null;

  if (!name) { document.getElementById('workout-name').focus(); return; }

  const btn = document.getElementById('form-submit-btn');
  btn.disabled    = true;
  btn.textContent = 'Adding…';

  const { supabase, profile } = window.__f42;

  const { error } = await supabase.from('feed_entries').insert({
    couple_id:    profile.couple_id,
    user_id:      profile.id,
    entry_type:   'workout',
    title:        name,
    duration_min: min,
    kcal,
    distance_km:  km,
  });

  if (error) {
    btn.disabled    = false;
    btn.textContent = 'Add to feed';
    console.error('submitWorkout:', error);
    return;
  }

  closeModal();
  // realtime subscription renders the new entry and updates couple score
}

/* ── Entry rendering ── */

function buildEntryFromRow(row, myId) {
  const isMe = row.user_id === myId;
  const cls  = isMe ? 'a' : 'b';
  const time = new Date(row.logged_at).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  });

  let content = `<div class="entry-meal-name">${escHtml(row.title)}</div>`;

  if (row.entry_type === 'meal') {
    const macros = [
      row.kcal      ? `${row.kcal} kcal`           : null,
      row.protein_g ? `${row.protein_g}g protein`   : null,
      row.carbs_g   ? `${row.carbs_g}g carbs`       : null,
      row.fat_g     ? `${row.fat_g}g fat`            : null,
    ].filter(Boolean);
    if (macros.length) {
      content += `<div class="entry-macros">${macros.map(m => `<span>${escHtml(m)}</span>`).join('')}</div>`;
    }
  } else {
    const stats = [
      row.distance_km  ? `<div class="wstat"><div class="wstat-val">${row.distance_km}</div><div class="wstat-lbl">km</div></div>`   : '',
      row.duration_min ? `<div class="wstat"><div class="wstat-val">${row.duration_min}</div><div class="wstat-lbl">min</div></div>` : '',
      row.kcal         ? `<div class="wstat"><div class="wstat-val">${row.kcal}</div><div class="wstat-lbl">kcal</div></div>`        : '',
    ].join('');
    if (stats) content += `<div class="entry-workout-stats">${stats}</div>`;
  }

  const el = buildEntry({
    who:    row.profile.display_name,
    avatar: row.profile.initials,
    cls,
    type:   row.entry_type === 'meal' ? 'logged a meal' : 'completed a workout',
    time,
    content,
  });
  el.dataset.entryId = row.id;
  return el;
}

function buildEntry({ who, avatar, cls, type, time, content }) {
  const div = document.createElement('div');
  div.className = 'feed-entry';
  div.style.animationDelay = '0ms';
  div.innerHTML = `
    <div class="entry-avatar entry-avatar--${cls}">${escHtml(avatar)}</div>
    <div class="entry-body">
      <div class="entry-header">
        <span class="entry-who">${escHtml(who)}</span>
        <span class="entry-type">${escHtml(type)}</span>
        <span class="entry-time">${escHtml(time)}</span>
      </div>
      <div class="entry-content">${content}</div>
      <div class="entry-reactions">
        <button class="react-btn" data-preset onclick="addReaction(this,'🔥')">🔥 <span>0</span></button>
        <button class="react-btn" data-preset onclick="addReaction(this,'❤️')">❤️ <span>0</span></button>
        <button class="react-btn react-btn--add" onclick="showReactPicker(this)">+</button>
      </div>
    </div>
  `;
  return div;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});
