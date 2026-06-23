'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS_RETRO = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#5B8DD9', // J - pale blue
  '#ffb74d', // L - orange
  '#cfd8dc', // Nut - plata claro (tuerca, reto)
  '#ef5350', // Bomb - rojo (bomba, destruye 3×3)
];

const COLORS_NEON = [
  null,
  '#00fff7', // I - cian eléctrico
  '#ffe600', // O - amarillo néon
  '#ff00e6', // T - magenta
  '#00ff41', // S - verde néon
  '#ff1744', // Z - rojo néon
  '#2979ff', // J - azul néon
  '#ff6d00', // L - naranja néon
  '#ffffff', // Nut - blanco
  '#ff1744', // Bomb - rojo brillante
];

const COLORS_PASTEL = [
  null,
  '#a8e6f0', // I - celeste pastel
  '#fff0a0', // O - amarillo pastel
  '#d4a8e8', // T - lila pastel
  '#b8e8b8', // S - verde pastel
  '#f5b8b8', // Z - rosa pastel
  '#a8b8f0', // J - azul pastel
  '#ffd4a8', // L - melocotón pastel
  '#e8ecf0', // Nut - gris muy claro
  '#f0a8a8', // Bomb - rojo pastel
];

const COLORS_PIXEL = [
  null,
  '#00aacc', // I
  '#ccaa00', // O
  '#882299', // T
  '#228844', // S
  '#aa2200', // Z
  '#224488', // J
  '#aa6600', // L
  '#889999', // Nut
  '#cc2200', // Bomb
];

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
let activeSkin = 'retro';

function getColors() {
  switch (activeSkin) {
    case 'neon':   return COLORS_NEON;
    case 'pastel': return COLORS_PASTEL;
    case 'pixel':  return COLORS_PIXEL;
    default:       return COLORS_RETRO;
  }
}

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
  if (!colorIndex) return;
  const color = getColors()[colorIndex];
  context.globalAlpha = alpha ?? 1;

  const bx = x * size + 1;
  const by = y * size + 1;
  const bw = size - 2;
  const bh = size - 2;

  if (activeSkin === 'neon') {
    const isGhost = (alpha ?? 1) < 1;
    if (!isGhost) {
      context.shadowBlur = 12;
      context.shadowColor = color;
    }
    context.fillStyle = color;
    context.fillRect(bx, by, bw, bh);
    context.shadowBlur = 0;
    context.shadowColor = 'transparent';
  } else if (activeSkin === 'pastel') {
    context.fillStyle = color;
    if (context.roundRect) {
      context.beginPath();
      context.roundRect(bx, by, bw, bh, 5);
      context.fill();
    } else {
      context.fillRect(bx, by, bw, bh);
    }
    context.fillStyle = 'rgba(255,255,255,0.25)';
    if (context.roundRect) {
      context.beginPath();
      context.roundRect(bx, by, bw, 4, [2, 2, 0, 0]);
      context.fill();
    } else {
      context.fillRect(bx, by, bw, 4);
    }
  } else if (activeSkin === 'pixel') {
    context.fillStyle = color;
    context.fillRect(bx, by, bw, bh);
    context.fillStyle = 'rgba(0,0,0,0.3)';
    for (let px = bx; px < bx + bw; px += 6) {
      context.fillRect(px, by, 1, bh);
    }
    for (let py = by; py < by + bh; py += 6) {
      context.fillRect(bx, py, bw, 1);
    }
    context.fillStyle = 'rgba(255,255,255,0.10)';
    context.fillRect(bx, by, bw, 2);
  } else {
    context.fillStyle = color;
    context.fillRect(bx, by, bw, bh);
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(bx, by, bw, 4);
  }

  context.globalAlpha = 1;
}

function drawGrid() {
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
  if (activeSkin === 'neon') {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
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

const skinSelect = document.getElementById('skin-select');

function applySkin(skinName) {
  activeSkin = skinName;
  localStorage.setItem('tetris-skin', skinName);
  if (skinSelect.value !== skinName) skinSelect.value = skinName;
}

skinSelect.addEventListener('change', () => applySkin(skinSelect.value));

applySkin(localStorage.getItem('tetris-skin') || 'retro');

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

init();
