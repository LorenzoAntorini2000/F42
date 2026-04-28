# F42 — Fit For Two

> The couples fitness app where you share what you eat, celebrate every workout, and grow stronger side by side.

## What is F42?

F42 is a lightweight, privacy-first fitness companion built for couples. Instead of competing alone on generic leaderboards, partners share a real-time feed of meals and workouts, react to each other's entries, and build a combined **Couple Score** together.

## MVP Features (v0.1)

- **Shared meal feed** — log meals with macros and see your partner's entries in real time
- **Workout logging** — log sessions with duration, distance, and calories
- **Reactions** — emoji reactions on any feed entry
- **Daily summary** — side-by-side calorie progress bars for both partners
- **Couple Score** — a combined weekly score that rises and falls together

## Pages

| Page | Description |
|------|-------------|
| `index.html` | Landing page |
| `feed.html` | Main app — shared feed |
| `workouts.html` | Workout sync (coming soon) |
| `goals.html` | Goals & couple score (coming soon) |

## Running locally

Just open `index.html` in your browser — no build step required.

```bash
git clone https://github.com/YOUR_USERNAME/f42.git
cd f42
open index.html
```

## GitHub Pages

To deploy:
1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source to **Deploy from branch → main → / (root)**
4. Your site will be live at `https://YOUR_USERNAME.github.io/f42`

## Tech stack

- Vanilla HTML, CSS, JavaScript — zero dependencies, zero build tools
- Google Fonts (DM Serif Display + DM Sans)
- Designed mobile-first, responsive

## Roadmap

- [ ] Backend / real-time sync (Firebase or Supabase)
- [ ] Partner pairing via invite code
- [ ] Workout calendar with shared slots
- [ ] AI meal & workout suggestions
- [ ] Apple Health / Google Fit integration
- [ ] Native mobile app (React Native or Flutter)

## Contributing

Pull requests are welcome. For major changes, open an issue first.

---

Built with ♥ for two.
