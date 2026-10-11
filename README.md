# fx-82MS Web — Scientific Calculator

A Casio **fx-82MS–style** scientific calculator that runs entirely in the browser.
Static HTML/CSS/JS only — no build step, no backend — so it deploys cleanly to **GitHub Pages**.

**Live demo: https://n-garai.github.io/Scientific-Calculator/**

## Features

- **fx-82MS layout**: SHIFT (yellow) / ALPHA (red) keys, replay cursor pad, `MODE`, `ON/AC`, `DEL`
- **Two-line S-V.P.A.M. display**: expression on top, result below, with `S A D/R/G FIX SCI M SD` indicators
- **Math engine** (`js/engine.js`, no `eval()`):
  - `+ − × ÷`, parentheses, implicit multiplication (`2π`, `2(3+4)`, `(2+3)(4+1)`)
  - Powers/roots: `x² x³ x⁻¹ ^ √ ³√ ˣ√`
  - `log ln 10ˣ eˣ π e Ans (−) Abs Rnd Ran#`
  - Trig + hyperbolic + inverse: `sin cos tan`, `hyp` variants, `sin⁻¹…`, degree/radian/gradian aware
  - `x! nPr nCr %`, fractions `aᵇ/c` ⇄ `d/c`, DMS `° ′ ″` entry (`30°15'`) and `° ′ ″` result view
  - `Pol(/Rec(` coordinate conversion (stores `X`,`Y`), `ENG` engineering notation
  - Variables `A–F M X Y`, `STO/RCL`, `M+ / M−`, COMP vs SD statistics (`Σx² Σx n x̄ σn σn−1`)
  - Display modes `Fix Sci Norm1/Norm2`, proper `Math ERROR` / `Syntax ERROR`
- **Light + dark theme** toggle (persisted in `localStorage`, respects OS preference)
- **Keyboard support**: digits, `+ - * / ^ ( ) , % !`, `Enter` (=), `Backspace` (DEL), `Esc` (AC), arrows (cursor/replay), `P` (π)
- **Responsive + accessible**: mobile layout, focus-visible rings, `aria-live` LCD, guide dialog
- **Pages-ready**: relative asset paths, `.nojekyll`, `404.html` fallback, Actions workflow with tests

## Project structure

```
.
├── index.html            # UI shell + keypad
├── css/styles.css        # light/dark themes + layout
├── js/engine.js          # tokenizer/parser/evaluator (browser + Node)
├── js/calculator.js      # key handling, modes, memory, rendering
├── js/engine.test.js     # `node js/engine.test.js`
├── package.json          # `npm test`
├── .github/workflows/deploy.yml  # test + GitHub Pages deploy
├── .nojekyll             # tell Pages: serve files as-is
└── 404.html              # SPA-style fallback back to ./
```

## Run locally

No dependencies required. Either:

```bash
# fastest: just open it
start index.html        # Windows
open index.html         # macOS
xdg-open index.html     # Linux
```

or serve it (recommended, avoids `file://` quirks):

```bash
npx serve .
# then visit the printed http://localhost:3000
```

Run the math tests:

```bash
node js/engine.test.js
# or
npm test
```

## Key map (like the real fx-82MS)

| Key | Normal | SHIFT | ALPHA |
|---|---|---|---|
| `x⁻¹` | reciprocal | `x!` | — |
| `nCr` | combinations | `nPr` | — |
| `Pol(` | polar | `Rec(` | `X` |
| `x³` | cube | `³√` | `Y` |
| `aᵇ/c` | fraction | toggle fraction view | — |
| `√ ^ log ln` | as labeled | `ˣ√ E 10ˣ eˣ` | `D E F` |
| `(−) ° ′ ″ hyp sin cos tan` | as labeled | `A B asin/acos/atan…` | `A B C sin cos tan` |
| `RCL ENG ( ) , M+` | as labeled | `STO ENG← % M− DT(in SD)` | recall var / `M` |
| `MODE` | COMP → angle → Fix/Sci/Norm menus | clear stats (`Scl`) | — |
| `0` / `.` / `EXP` / `Ans` | as labeled | `Rnd / Ran# / π / Abs(` | — |

In **SD mode**, `M+` becomes `DT` (data input, shows `n=`). `SHIFT 1–6` recalls `Σx² Σx n x̄ σn σn−1`.

Press **MODE** repeatedly (or tap the on-screen setup chips) for COMP/SD, Deg/Rad/Gra, Fix/Sci/Norm.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repo, `main` branch.
2. Go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   (The included workflow deploys automatically; no `gh-pages` branch needed.)
3. Push to `main` — the `Deploy to GitHub Pages` action runs tests (`node js/engine.test.js`), then publishes the repo root.
4. Your URL will be `https://<user>.github.io/<repo>/`.

Notes:

- All links are relative (`css/styles.css`, `js/*.js`), so project-page URLs work.
- `.nojekyll` disables Jekyll processing; `404.html` redirects unknown paths back to the app.

## How it works

- `js/engine.js` exposes `CalcEngine` with `tok/evaluate/applyDisplayFormat/decimalToFraction/...`.
  The parser precedence (low → high): `+ −` → `* /` → `nPr nCr` → implied `sin`-style multiply →
  implied `(`/constant multiply → fractions → DMS folding → `^ ˣ√` → postfix (`² ³ ⁻¹ ! %`) → primaries.
- `js/calculator.js` owns the token buffer + cursor, SHIFT/ALPHA/HYP/STO/RCL state,
  COMP/SD + angle + Fix/Sci/Norm setup, variables, stats accumulator, replay history (last 32),
  and LCD/theme rendering.
- Theme: `data-theme` on `<html>`, toggled by `#theme-toggle`, saved as `fx82-theme`.

## Extending

- Add a function: new `pre`/`post` token in `calculator.js` + case in `Parser.prototype.applyPrefix/applyPostfix` in `engine.js` + test in `js/engine.test.js`.
- Change digits shown: edit `applyDisplayFormat(x, {norm, fix, sci})`.
- Restyle: CSS variables at the top of `css/styles.css` (`[data-theme="dark"]` block for dark mode).
