'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const SKIN_COLORS = {
  retro: [null, '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#5B8DD9', '#ffb74d', '#cfd8dc', '#ef5350'],
  neon:  [null, '#00ffff', '#ffff00', '#ff00ff', '#39ff14', '#ff0055', '#0088ff', '#ff6600', '#bbbbbb', '#ff2200'],
  pastel:[null, '#a8dde9', '#f9e4a4', '#d4b0e2', '#b8e5bb', '#f5b0b0', '#a8c0e8', '#f8d0a0', '#dde8ec', '#f5a0a0'],
  pixel: [null, '#44aacc', '#ddbb44', '#9944aa', '#55aa55', '#cc5544', '#4466cc', '#ee9933', '#aabbcc', '#dd3333'],
};

let activeSkin = 'retro';
let activeColors = SKIN_COLORS.retro;

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

const LEADERBOARD_KEY = 'tetris_records';
const MAX_RECORDS = 5;

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
const saveScoreBtn = document.getElementById('save-score-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const playerNameInput = document.getElementById('player-name');
const gameoverContent = document.getElementById('gameover-content');
const nameEntry = document.getElementById('name-entry');
const newRecordMsg = document.getElementById('new-record-msg');
const leaderboardBody = document.getElementById('leaderboard-body');
const pauseOverlay = document.getElementById('pause-overlay');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsToggleBtn = document.getElementById('controls-toggle-btn');
const controlsPanel = document.getElementById('controls-panel');
const startLevelSelect = document.getElementById('start-level-select');

let board, current, next, score, lines, level, startLevel, paused, gameOver, lastTime, dropAccum, dropInterval, animId, bombPending, comboStreak, maxCombo;

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || [];
  } catch {
    return [];
  }
}

function isNewHighScore() {
  const records = loadRecords();
  return records.length < MAX_RECORDS || score > records[records.length - 1].score;
}

function saveRecord(name) {
  const records = loadRecords();
  const trimmedName = (name || '').trim() || 'Anónimo';
  const entry = { name: trimmedName, score, lines, maxCombo };
  records.push(entry);
  records.sort((a, b) => b.score - a.score);
  if (records.length > MAX_RECORDS) records.splice(MAX_RECORDS);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(records));
  return records.indexOf(entry);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderLeaderboard(tbody, highlightIndex = -1) {
  const records = loadRecords();
  tbody.innerHTML = '';
  if (records.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="5" class="no-records-cell">Sin records aún</td>';
    tbody.appendChild(tr);
    return;
  }
  records.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i === highlightIndex) tr.classList.add('record-highlight');
    tr.innerHTML = `<td>${i + 1}</td><td class="td-name">${escapeHtml(r.name)}</td><td>${r.score.toLocaleString()}</td><td>${r.lines}</td><td>×${r.maxCombo}</td>`;
    tbody.appendChild(tr);
  });
}

function renderPanelLeaderboard() {
  const container = document.getElementById('panel-records');
  if (!container) return;
  const records = loadRecords();
  container.innerHTML = '';
  if (records.length === 0) {
    const p = document.createElement('p');
    p.className = 'no-records';
    p.textContent = 'Sin records';
    container.appendChild(p);
    return;
  }
  records.forEach((r, i) => {
    const div = document.createElement('div');
    div.className = 'panel-record-row';
    div.innerHTML = `<span class="pr-rank">${i + 1}.</span><span class="pr-name">${escapeHtml(r.name)}</span><span class="pr-score">${r.score.toLocaleString()}</span>`;
    container.appendChild(div);
  });
}

// ─── Board & pieces ────────────────────────────────────────────────────────────

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
    comboStreak++;
    if (comboStreak > maxCombo) maxCombo = comboStreak;
    const prevLines = lines;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    if (Math.floor(prevLines / BOMB_LINES_INTERVAL) !== Math.floor(lines / BOMB_LINES_INTERVAL)) {
      bombPending = true;
    }
    updateHUD();
  } else {
    comboStreak = 0;
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
  const cx = current.x, cy = current.y;
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

// ─── Drawing ───────────────────────────────────────────────────────────────────

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = activeColors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  const px = x * size + 1;
  const py = y * size + 1;
  const sz = size - 2;

  if (activeSkin === 'neon') {
    context.fillStyle = 'rgba(0,0,10,0.9)';
    context.fillRect(px, py, sz, sz);
    context.shadowColor = color;
    context.shadowBlur = 10;
    context.strokeStyle = color;
    context.lineWidth = 2;
    context.strokeRect(px + 1, py + 1, sz - 2, sz - 2);
    context.fillStyle = color + '28';
    context.fillRect(px + 2, py + 2, sz - 4, sz - 4);
    context.shadowBlur = 0;
  } else if (activeSkin === 'pastel') {
    const r = 5;
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(px, py, sz, sz, r);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.35)';
    context.beginPath();
    context.roundRect(px, py, sz, sz * 0.4, [r, r, 2, 2]);
    context.fill();
  } else if (activeSkin === 'pixel') {
    context.fillStyle = color;
    context.fillRect(px, py, sz, sz);
    context.fillStyle = 'rgba(255,255,255,0.4)';
    context.fillRect(px, py, sz, 3);
    context.fillRect(px, py, 3, sz);
    context.fillStyle = 'rgba(0,0,0,0.4)';
    context.fillRect(px, py + sz - 3, sz, 3);
    context.fillRect(px + sz - 3, py, 3, sz);
    const g = Math.floor(sz / 3);
    context.fillStyle = 'rgba(0,0,0,0.2)';
    for (let gx = g; gx < sz; gx += g) context.fillRect(px + gx, py, 1, sz);
    for (let gy = g; gy < sz; gy += g) context.fillRect(px, py + gy, sz, 1);
  } else {
    context.fillStyle = color;
    context.fillRect(px, py, sz, sz);
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(px, py, sz, 4);
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

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

// ─── Game state ────────────────────────────────────────────────────────────────

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()} · Líneas: ${lines} · Combo: ×${maxCombo}`;

  gameoverContent.classList.remove('hidden');

  if (isNewHighScore()) {
    nameEntry.classList.remove('hidden');
    newRecordMsg.textContent = '¡Nuevo record! Ingresa tu nombre:';
    playerNameInput.value = '';
    setTimeout(() => playerNameInput.focus(), 50);
  } else {
    nameEntry.classList.add('hidden');
  }

  renderLeaderboard(leaderboardBody);
  overlay.classList.remove('hidden');
}

function resumeGame() {
  if (!paused || gameOver) return;
  paused = false;
  pauseOverlay.classList.add('hidden');
  lastTime = performance.now();
  loop(lastTime);
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseOverlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseOverlay.classList.remove('hidden');
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
  startLevel = parseInt(startLevelSelect.value, 10) || 1;
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  bombPending = false;
  dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
  dropAccum = 0;
  comboStreak = 0;
  maxCombo = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// ─── Input ─────────────────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    togglePause();
    return;
  }
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
resumeBtn.addEventListener('click', resumeGame);
pauseRestartBtn.addEventListener('click', init);
controlsToggleBtn.addEventListener('click', () => {
  controlsPanel.classList.toggle('hidden');
});

saveScoreBtn.addEventListener('click', () => {
  const newIndex = saveRecord(playerNameInput.value);
  nameEntry.classList.add('hidden');
  renderLeaderboard(leaderboardBody, newIndex);
  renderPanelLeaderboard();
});

playerNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveScoreBtn.click();
});

resetRecordsBtn.addEventListener('click', () => {
  if (confirm('¿Borrar todos los records?')) {
    localStorage.removeItem(LEADERBOARD_KEY);
    renderLeaderboard(leaderboardBody);
    renderPanelLeaderboard();
  }
});

// ─── Skin selector ───────────────────────────────────────────────────────────

function applySkin(skin) {
  if (!SKIN_COLORS[skin]) return;
  activeSkin = skin;
  activeColors = SKIN_COLORS[skin];
  document.body.className = document.body.className.replace(/\bskin-\w+\b/g, '').trim();
  document.body.classList.add('skin-' + skin);
  document.querySelectorAll('.skin-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.skin === skin);
  });
  localStorage.setItem('skin', skin);
  if (current && !gameOver) draw();
  if (next) drawNext();
}

document.querySelectorAll('.skin-btn').forEach(btn => {
  btn.addEventListener('click', () => applySkin(btn.dataset.skin));
});

applySkin(localStorage.getItem('skin') || 'retro');

renderPanelLeaderboard();
init();
