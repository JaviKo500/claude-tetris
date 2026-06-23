'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKINS = {
  retro: {
    colors: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#5B8DD9', '#ffb74d', '#cfd8dc', '#ef5350'],
    draw(ctx, x, y, ci, sz, alpha) {
      if (!ci) return;
      ctx.globalAlpha = alpha ?? 1;
      ctx.fillStyle = this.colors[ci];
      ctx.fillRect(x * sz + 1, y * sz + 1, sz - 2, sz - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x * sz + 1, y * sz + 1, sz - 2, 4);
      ctx.globalAlpha = 1;
    },
  },
  neon: {
    colors: [null, '#00f5ff', '#ffea00', '#e040fb', '#69ff47', '#ff1744', '#2979ff', '#ff9100', '#e0e0e0', '#ff1744'],
    draw(ctx, x, y, ci, sz, alpha) {
      if (!ci) return;
      const color = this.colors[ci];
      ctx.globalAlpha = alpha ?? 1;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = color;
      ctx.fillRect(x * sz + 1, y * sz + 1, sz - 2, sz - 2);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(x * sz + 2, y * sz + 2, sz - 4, 5);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    },
  },
  pastel: {
    colors: [null, '#a8d8ea', '#fff9ae', '#dab8f3', '#b5ead7', '#ffb3ba', '#b3d9ff', '#ffd0a0', '#e8e8e8', '#ffb3ba'],
    draw(ctx, x, y, ci, sz, alpha) {
      if (!ci) return;
      const color = this.colors[ci];
      ctx.globalAlpha = alpha ?? 1;
      const m = 2;
      ctx.fillStyle = color;
      ctx.fillRect(x * sz + m, y * sz + m, sz - m * 2, sz - m * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(x * sz + m, y * sz + m, sz - m * 2, 5);
      ctx.fillRect(x * sz + m, y * sz + m, 5, sz - m * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.fillRect(x * sz + m, y * sz + sz - m - 4, sz - m * 2, 4);
      ctx.fillRect(x * sz + sz - m - 4, y * sz + m, 4, sz - m * 2);
      ctx.globalAlpha = 1;
    },
  },
  pixel: {
    colors: [null, '#0099cc', '#ffcc00', '#9933cc', '#33aa33', '#cc2200', '#2266ff', '#ff7700', '#aabbcc', '#cc2200'],
    draw(ctx, x, y, ci, sz, alpha) {
      if (!ci) return;
      const color = this.colors[ci];
      ctx.globalAlpha = alpha ?? 1;
      const bx = x * sz, by = y * sz;
      ctx.fillStyle = color;
      ctx.fillRect(bx + 1, by + 1, sz - 2, sz - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx + 1, by + 1, sz - 2, 2);
      ctx.fillRect(bx + 1, by + 1, 2, sz - 2);
      ctx.fillRect(bx + 1, by + sz - 3, sz - 2, 2);
      ctx.fillRect(bx + sz - 3, by + 1, 2, sz - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(bx + 3, by + 3, 5, 5);
      ctx.globalAlpha = 1;
    },
  },
};

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Nut (tuerca, reto — hueco central sellado)
  [[9]],                                       // Bomb (bomba — celda única, destruye 3×3)
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const NUT_PROBABILITY   = 0.12; // ~12 % de las piezas es la tuerca (reto)
const BOMB_LINES_INTERVAL = 1; // cada cuántas líneas eliminadas aparece la bomba

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, bombPending;
let currentSkin = SKINS.retro;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  let type;
  if (bombPending) {
    bombPending = false;
    type = 9;
  } else {
    type = Math.random() < NUT_PROBABILITY
      ? 8
      : Math.floor(Math.random() * 7) + 1;
  }
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    const prevLines = lines;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    if (Math.floor(prevLines / BOMB_LINES_INTERVAL) !== Math.floor(lines / BOMB_LINES_INTERVAL)) {
      bombPending = true;
    }
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function explodeBomb() {
  const cx = current.x, cy = current.y; // celda única, shape [[9]]
  for (let r = cy - 1; r <= cy + 1; r++)
    for (let c = cx - 1; c <= cx + 1; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS)
        board[r][c] = 0;
}

function lockPiece() {
  if (current.type === 9) explodeBomb();
  else merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  currentSkin.draw(context, x, y, colorIndex, size, alpha);
}

function drawGrid() {
  ctx.shadowBlur = 0;
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--canvas-grid').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  bombPending = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

// ─── Skin selector ───────────────────────────────────────────────────────────

function applySkin(key) {
  currentSkin = SKINS[key] || SKINS.retro;
  document.body.classList.remove('skin-neon', 'skin-pastel', 'skin-pixel');
  if (key !== 'retro') document.body.classList.add(`skin-${key}`);
  localStorage.setItem('skin', key);
  document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.skin === key);
  });
  if ((paused || gameOver) && current) { draw(); drawNext(); }
}

document.getElementById('skin-picker').addEventListener('click', e => {
  const btn = e.target.closest('.skin-btn');
  if (btn) applySkin(btn.dataset.skin);
});

// ─── Theme toggle ────────────────────────────────────────────────────────────
// Adds or removes the .light-mode class on <body> based on the checkbox state.
// All colour changes are handled by CSS custom properties in style.css —
// no colour values are duplicated here. drawGrid() above reads --canvas-grid
// on every frame so the grid colour updates instantly when the theme changes.
// The chosen theme is saved to localStorage so it persists across sessions.

const themeCheckbox = document.getElementById('theme-toggle');
const themeModeText = document.getElementById('theme-mode-text');

function applyTheme(isLight) {
  document.body.classList.toggle('light-mode', isLight);
  themeCheckbox.checked = isLight;
  themeModeText.textContent = isLight ? 'Claro' : 'Oscuro';
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

themeCheckbox.addEventListener('change', () => applyTheme(themeCheckbox.checked));

// Restore last saved preference on page load (defaults to dark)
applyTheme(localStorage.getItem('theme') === 'light');
applySkin(localStorage.getItem('skin') || 'retro');

init();
