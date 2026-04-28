/* F42 — feed.js · feed interactions */

/* ── Reactions ── */
function addReaction(btn, emoji) {
  const countEl = btn.querySelector('span');
  const isReacted = btn.classList.contains('reacted');
  const count = parseInt(countEl.textContent, 10);

  if (isReacted) {
    btn.classList.remove('reacted');
    countEl.textContent = Math.max(0, count - 1);
  } else {
    btn.classList.add('reacted');
    countEl.textContent = count + 1;
  }
}

const EMOJI_OPTIONS = ['🔥', '❤️', '👏', '💪', '😍', '🥗'];

function showReactPicker(addBtn) {
  // Remove existing pickers
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
      // Check if this reaction already exists
      let existing = Array.from(reactions.querySelectorAll('.react-btn'))
        .find(b => b.textContent.startsWith(emoji));

      if (existing && existing !== addBtn) {
        addReaction(existing, emoji);
      } else {
        // Create a new reaction button before the + button
        const newBtn = document.createElement('button');
        newBtn.className = 'react-btn';
        newBtn.innerHTML = `${emoji} <span>1</span>`;
        newBtn.onclick = () => addReaction(newBtn, emoji);
        reactions.insertBefore(newBtn, addBtn);
        newBtn.classList.add('reacted');
      }
      picker.remove();
    };
    picker.appendChild(btn);
  });

  addBtn.after(picker);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', () => picker.remove(), { once: true });
  }, 0);
}

/* ── Log modal ── */
function openLogModal(type) {
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  title.textContent = type === 'meal' ? 'Log a meal' : 'Log a workout';
  body.innerHTML = type === 'meal' ? mealForm() : workoutForm();
  overlay.classList.add('open');

  // Focus first input
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
    <button class="form-submit" onclick="submitMeal()">Add to feed</button>
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
    <button class="form-submit" onclick="submitWorkout()">Add to feed</button>
  `;
}

function submitMeal() {
  const name   = document.getElementById('meal-name')?.value.trim();
  const kcal   = document.getElementById('meal-kcal')?.value;
  const protein = document.getElementById('meal-protein')?.value;
  const carbs  = document.getElementById('meal-carbs')?.value;
  const fat    = document.getElementById('meal-fat')?.value;

  if (!name) { document.getElementById('meal-name').focus(); return; }

  const now = new Date();
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const macros = [
    kcal   ? `${kcal} kcal`   : null,
    protein ? `${protein}g protein` : null,
    carbs  ? `${carbs}g carbs`  : null,
    fat    ? `${fat}g fat`     : null,
  ].filter(Boolean).join(' · ');

  const entry = buildEntry({
    who: 'Alex', avatar: 'AL', cls: 'a',
    type: 'logged a meal', time,
    content: `<div class="entry-meal-name">${escHtml(name)}</div>
      ${macros ? `<div class="entry-macros"><span>${macros}</span></div>` : ''}`
  });

  prependEntry(entry);
  closeModal();
}

function submitWorkout() {
  const name = document.getElementById('workout-name')?.value.trim();
  const min  = document.getElementById('workout-min')?.value;
  const kcal = document.getElementById('workout-kcal')?.value;
  const km   = document.getElementById('workout-km')?.value;

  if (!name) { document.getElementById('workout-name').focus(); return; }

  const now = new Date();
  const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const stats = [
    km   ? `<div class="wstat"><div class="wstat-val">${km}</div><div class="wstat-lbl">km</div></div>` : '',
    min  ? `<div class="wstat"><div class="wstat-val">${min}</div><div class="wstat-lbl">min</div></div>` : '',
    kcal ? `<div class="wstat"><div class="wstat-val">${kcal}</div><div class="wstat-lbl">kcal</div></div>` : '',
  ].join('');

  const entry = buildEntry({
    who: 'Alex', avatar: 'AL', cls: 'a',
    type: 'completed a workout', time,
    content: `<div class="entry-meal-name">${escHtml(name)}</div>
      ${stats ? `<div class="entry-workout-stats">${stats}</div>` : ''}`
  });

  prependEntry(entry);
  closeModal();
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
        <button class="react-btn" onclick="addReaction(this,'🔥')">🔥 <span>0</span></button>
        <button class="react-btn" onclick="addReaction(this,'❤️')">❤️ <span>0</span></button>
        <button class="react-btn react-btn--add" onclick="showReactPicker(this)">+</button>
      </div>
    </div>
  `;
  return div;
}

function prependEntry(el) {
  const feed = document.getElementById('feed');
  feed.insertBefore(el, feed.firstChild);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});
