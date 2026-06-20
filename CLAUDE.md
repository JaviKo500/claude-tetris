# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build step required. Open `index.html` directly in a browser, or serve it with any static file server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

On Windows: `start index.html`

## Architecture

Three files — no dependencies, no bundler, no framework:

- **`index.html`** — DOM structure: a `300×600` `<canvas id="board">` for the main grid, a `120×120` `<canvas id="next-canvas">` for the preview, HUD elements (`#score`, `#lines`, `#level`), and a `#overlay` div used for both PAUSE and GAME OVER states.
- **`style.css`** — Dark/retro theme using flexbox layout. The overlay uses `backdrop-filter: blur` and is toggled via `.hidden` class.
- **`game.js`** — All game logic (~305 lines, `'use strict'`).

### game.js internals

**State**: a handful of module-level `let` variables — `board` (2D array `ROWS×COLS`, values 0 or piece color index 1–8), `current`/`next` (piece objects with `{type, shape, x, y}`), plus `score`, `lines`, `level`, `paused`, `gameOver`, `dropAccum`, `dropInterval`, `animId`, `lastTime`.

**Key functions and their roles:**
- `collide(shape, ox, oy)` — bounds + overlap check against the frozen board
- `rotateCW(shape)` — transpose + reverse rows; returns a new matrix
- `tryRotate()` — applies `rotateCW` with wall-kick offsets `[0, -1, 1, -2, 2]`
- `lockPiece()` — calls `merge()` → `clearLines()` → `spawn()`
- `clearLines()` — iterates bottom-up, splices full rows and unshifts empty ones
- `ghostY()` — drops a probe until `collide` triggers, returns the Y position
- `loop(ts)` — `requestAnimationFrame` loop; accumulates `dropAccum`, locks piece when gravity fires
- `draw()` — clears canvas, draws grid lines, frozen board, ghost (alpha 0.2), then current piece
- `init()` — resets all state, starts the `requestAnimationFrame` loop

**Speed formula**: `dropInterval = Math.max(100, 1000 − (level − 1) × 90)` ms. Level increases every 10 lines.

**Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` × current level. Soft drop adds 1 pt/row, hard drop adds 2 pts/cell fallen.

### Tunable constants (top of `game.js`)

| Constant | Default | Note |
|---|---|---|
| `COLS` / `ROWS` | 10 / 20 | If changed, update canvas `width`/`height` in `index.html` (`COLS×BLOCK` / `ROWS×BLOCK`) |
| `BLOCK` | 30 | Pixel size per cell |
| `COLORS` | 8-color array | Index-matched to `PIECES` (index 0 is unused/null); index 8 = tuerca (plata claro) |
| `LINE_SCORES` | `[0,100,300,500,800]` | Points for 1–4 simultaneous line clears |
| `NUT_PROBABILITY` | `0.12` | Probability (0–1) that any given piece is the "tuerca" (nut) challenge piece |
