// Единое ядро NZB chess: визуал, навигация, поиск, звуки, дебюты, оценка, срубленные фигуры и сенсор

export const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%232a2823'/><circle cx='50' cy='38' r='16' fill='%238b8987'/><path d='M22 86c0-16 12-26 28-26s28 10 28 26' fill='%238b8987'/></svg>";

const BOT_DIRECTORY = [
  { code: 'TM', name: 'Тёма', elo: 400 }, { code: 'RX', name: 'Рекс', elo: 500 },
  { code: 'MZ', name: 'Мурзик', elo: 600 }, { code: 'HM', name: 'Хома', elo: 650 },
  { code: 'AL', name: 'Алиса', elo: 700 }, { code: 'EN', name: 'Енот', elo: 725 },
  { code: 'PT', name: 'Потап', elo: 750 }, { code: 'WL', name: 'Волк', elo: 800 },
  { code: 'SK', name: 'Сокол', elo: 900 }, { code: 'VK', name: 'Виктор', elo: 1100 },
  { code: 'KG', name: 'Каге', elo: 1400 }, { code: 'VL', name: 'Влад', elo: 1900 },
  { code: 'PR', name: 'Профессор', elo: 2000 }, { code: 'OR', name: 'Оракул', elo: 2300 },
  { code: 'MG', name: 'Магнус NZB', elo: 2500 }
];

// --- БАЗА ДЕБЮТОВ (OPENING EXPLORER) ---
const OPENINGS_DB = [
  { moves: 'e4 e5 Nf3 Nc6 Bb5', name: 'C60 Испанская партия (Руй Лопес)' },
  { moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5', name: 'C50 Итальянская партия (Тишайшая игра)' },
  { moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6', name: 'C55 Защита двух коней' },
  { moves: 'e4 e5 Nf3 Nc6 d4', name: 'C44 Шотландская партия' },
  { moves: 'e4 e5 Nf3 Nf6', name: 'C42 Русская партия (Защита Петрова)' },
  { moves: 'e4 e5 f4', name: 'C30 Королевский гамбит' },
  { moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6', name: 'B90 Сицилианская защита: Вариант Найдорфа' },
  { moves: 'e4 c5 Nf3 Nc6', name: 'B30 Сицилианская защита' },
  { moves: 'e4 c5', name: 'B20 Сицилианская защита' },
  { moves: 'e4 e6 d4 d5', name: 'C00 Французская защита' },
  { moves: 'e4 c6 d4 d5', name: 'B10 Защита Каро-Канн' },
  { moves: 'e4 d5', name: 'B01 Скандинавская защита' },
  { moves: 'e4 Nf6', name: 'B02 Защита Алехина' },
  { moves: 'e4 d6 d4 Nf6 Nc3 g6', name: 'B07 Защита Пирца-Уфимцева' },
  { moves: 'd4 d5 c4 e6', name: 'D30 Отказанный ферзевый гамбит' },
  { moves: 'd4 d5 c4 dxc4', name: 'D20 Принятый ферзевый гамбит' },
  { moves: 'd4 d5 c4 c6', name: 'D10 Славянская защита' },
  { moves: 'd4 d5 Bf4', name: 'D02 Лондонская система' },
  { moves: 'd4 Nf6 c4 g6 Nc3 Bg7', name: 'E60 Староиндийская защита' },
  { moves: 'd4 Nf6 c4 e6 Nc3 Bb4', name: 'E20 Защита Нимцовича' },
  { moves: 'c4', name: 'A10 Английское начало' },
  { moves: 'Nf3', name: 'A04 Дебют Рети' },
  { moves: 'e4 e5', name: 'C20 Открытый дебют' },
  { moves: 'e4', name: 'B00 Дебют королевской пешки' },
  { moves: 'd4', name: 'A40 Дебют ферзевой пешки' }
];

export function detectOpeningName(historySanArray) {
  if (!historySanArray || !historySanArray.length) return 'Начальная позиция';
  const line = historySanArray.join(' ');
  for (let op of OPENINGS_DB) {
    if (line.startsWith(op.moves)) return op.name;
  }
  return 'Мительшпиль / Нестандартный дебют';
}

// --- ПОДСЧЁТ СРУБЛЕННЫХ ФИГУР И МАТЕРИАЛЬНОГО ПЕРЕВЕСА ---
export function getCapturedMaterial(chessInstance) {
  const initial = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const currentW = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  const currentB = { p: 0, n: 0, b: 0, r: 0, q: 0 };

  const board = chessInstance.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell || cell.type === 'k') continue;
      if (cell.color === 'w') currentW[cell.type]++;
      else currentB[cell.type]++;
    }
  }

  // Фигуры, срубленные белыми (потерянные чёрными) и срубленные чёрными (потерянные белыми)
  const capturedByWhite = [];
  const capturedByBlack = [];
  const glyphsForBlackPieces = { q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const glyphsForWhitePieces = { q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };
  const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };

  let whiteScore = 0;
  let blackScore = 0;

  ['q', 'r', 'b', 'n', 'p'].forEach(t => {
    whiteScore += currentW[t] * values[t];
    blackScore += currentB[t] * values[t];

    const lostB = Math.max(0, initial[t] - currentB[t]);
    const lostW = Math.max(0, initial[t] - currentW[t]);

    for (let i = 0; i < lostB; i++) capturedByWhite.push(glyphsForBlackPieces[t]);
    for (let i = 0; i < lostW; i++) capturedByBlack.push(glyphsForWhitePieces[t]);
  });

  return {
    byWhiteHtml: capturedByWhite.map(g => `<span class="captured-piece-glyph">${g}</span>`).join('') +
      (whiteScore > blackScore ? `<span class="mat-adv">+${whiteScore - blackScore}</span>` : ''),
    byBlackHtml: capturedByBlack.map(g => `<span class="captured-piece-glyph">${g}</span>`).join('') +
      (blackScore > whiteScore ? `<span class="mat-adv">+${blackScore - whiteScore}</span>` : '')
  };
}

// --- ЗВУКОВОЙ СИНТЕЗАТОР (WEB AUDIO API) ---
let audioCtx = null;

export function playChessSound(type = 'move') {
  if (localStorage.getItem('nzb_sfx') === 'off') return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'move' || type === 'premove') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(type === 'premove' ? 220 : 155, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.065);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.065);
      osc.start(now);
      osc.stop(now + 0.07);
    } else if (type === 'capture') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(290, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.09);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
      osc.start(now);
      osc.stop(now + 0.095);
    } else if (type === 'check') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.setValueAtTime(720, now + 0.08);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.23);
    } else if (type === 'end') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554, now + 0.12);
      osc.frequency.setValueAtTime(659, now + 0.24);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc.start(now);
      osc.stop(now + 0.46);
    }
  } catch (e) {}
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function applySavedVisuals() {
  const root = document.documentElement.style;
  root.setProperty('--accent', localStorage.getItem('nzb_accent') || '#629924');
  root.setProperty('--bg-main', localStorage.getItem('nzb_bg_main') || '#161512');
  root.setProperty('--sq-light', localStorage.getItem('nzb_sq_light') || '#dee3e6');
  root.setProperty('--sq-dark', localStorage.getItem('nzb_sq_dark') || '#8ca2ad');

  const bgImg = localStorage.getItem('nzb_bg_img');
  document.body.style.backgroundImage = bgImg ? `url('${bgImg}')` : 'none';

  const pTheme = localStorage.getItem('nzb_piece_theme') || 'cburnett';
  let styleTag = document.getElementById('pieceOverride');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'pieceOverride';
    document.head.appendChild(styleTag);
  }

  if (pTheme === 'cburnett') {
    styleTag.innerHTML = '';
  } else {
    const map = [
      ['pawn.white', 'wP'], ['knight.white', 'wN'], ['bishop.white', 'wB'],
      ['rook.white', 'wR'], ['queen.white', 'wQ'], ['king.white', 'wK'],
      ['pawn.black', 'bP'], ['knight.black', 'bN'], ['bishop.black', 'bB'],
      ['rook.black', 'bR'], ['queen.black', 'bQ'], ['king.black', 'bK']
    ];
    styleTag.innerHTML = map.map(([cls, code]) =>
      `.cg-wrap piece.${cls} { background-image: url('https://lichess1.org/assets/piece/${pTheme}/${code}.svg') !important; }`
    ).join('\n');
  }
}

export function renderSidebar(activePage) {
  const nav = document.getElementById('sidebarMount');
  if (!nav) return;

  const nick = localStorage.getItem('nzb_nick') || 'Player_NZB';
  const elo = localStorage.getItem('nzb_elo') || '800';
  const xp = parseInt(localStorage.getItem('nzb_xp')) || 0;
  const level = Math.floor(xp / 200) + 1;
  const avatar = localStorage.getItem('nzb_avatar') || DEFAULT_AVATAR;

  const items = [
    { id: 'index', href: 'index.html', label: 'Главная', icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
    { id: 'bots', href: 'bots.html', label: 'Игра с ботами', icon: '<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>' },
    { id: 'online', href: 'online.html', label: '1 на 1 (Сеть LAN)', icon: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>' },
    { id: 'puzzles', href: 'puzzles.html', label: 'Тактика и задачи', icon: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
    { id: 'editor', href: 'editor.html', label: 'Редактор доски', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>' },
    { id: 'themes', href: 'themes.html', label: 'Оформление', icon: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>' }
  ];

  nav.className = 'nav-sidebar';
  nav.innerHTML = `
    <a href="index.html" class="brand">
      <img src="logo.png" alt="NZB chess">
      <div class="brand-text">NZB <span>chess</span></div>
    </a>
    ${items.map(item => `
      <a href="${item.href}" class="nav-item ${activePage === item.id ? 'active' : ''}">
        <svg viewBox="0 0 24 24">${item.icon}</svg>
        <span>${item.label}</span>
      </a>
    `).join('')}
    <div class="profile-mini">
      <img id="sideAvatar" class="avatar-circle" src="${avatar}" alt="Avatar">
      <div style="overflow: hidden;">
        <div style="font-weight: 600; font-size: 14px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;" id="sideNick">${nick}</div>
        <div style="color: var(--accent); font-size: 12px; font-weight: 600;" id="sideEloTxt">${elo} ELO • Ур. ${level}</div>
      </div>
    </div>
  `;

  const mainEl = document.querySelector('main.main-content');
  if (mainEl && !mainEl.parentElement.classList.contains('app-shell')) {
    const shell = document.createElement('div');
    shell.className = 'app-shell';
    mainEl.parentNode.insertBefore(shell, mainEl);

    const sfxOn = localStorage.getItem('nzb_sfx') !== 'off';
    const topBar = document.createElement('header');
    topBar.className = 'top-navbar';
    topBar.innerHTML = `
      <div class="search-wrapper">
        <div class="search-input-box">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="globalPlayerSearch" type="text" placeholder="Поиск игроков и ботов по имени..." autocomplete="off">
        </div>
        <div id="searchDropdown" class="search-dropdown"></div>
      </div>
      <div class="top-stats">
        <button id="globalSfxBtn" class="btn btn-secondary" style="padding: 5px 10px; font-size: 12px;">${sfxOn ? 'Звук: ВКЛ' : 'Звук: ВЫКЛ'}</button>
        <span>Ур. <b style="color:var(--text-main);" id="topLevel">${level}</b> (${xp % 200}/200 XP)</span>
        <span class="elo-tag" id="topEloTag">${elo} ELO</span>
      </div>
    `;
    shell.appendChild(topBar);
    shell.appendChild(mainEl);

    document.getElementById('globalSfxBtn').onclick = () => {
      const cur = localStorage.getItem('nzb_sfx') !== 'off';
      localStorage.setItem('nzb_sfx', cur ? 'off' : 'on');
      document.getElementById('globalSfxBtn').innerText = !cur ? 'Звук: ВКЛ' : 'Звук: ВЫКЛ';
      if (!cur) playChessSound('move');
    };

    initSearchLogic();
  }
}

function initSearchLogic() {
  const input = document.getElementById('globalPlayerSearch');
  const dropdown = document.getElementById('searchDropdown');
  if (!input || !dropdown) return;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { dropdown.style.display = 'none'; return; }

    const results = [];
    const myNick = localStorage.getItem('nzb_nick') || 'Player_NZB';
    const myElo = localStorage.getItem('nzb_elo') || '800';
    if (myNick.toLowerCase().includes(q)) {
      results.push({ name: myNick, tag: `${myElo} ELO`, sub: 'Ваш профиль', action: () => location.href = 'index.html' });
    }

    const knownPlayers = JSON.parse(localStorage.getItem('nzb_known_players') || '[]');
    knownPlayers.forEach(p => {
      if (p.nick.toLowerCase().includes(q)) {
        results.push({ name: p.nick, tag: `${p.elo || 800} ELO`, sub: 'Игрок (LAN)', action: () => location.href = 'online.html' });
      }
    });

    BOT_DIRECTORY.forEach(b => {
      if (b.name.toLowerCase().includes(q) || String(b.elo).includes(q)) {
        results.push({ name: b.name, tag: `${b.elo} ELO`, sub: 'Бот NZB chess', action: () => location.href = 'bots.html' });
      }
    });

    if (results.length === 0) {
      dropdown.innerHTML = `<div class="search-item" style="color:var(--text-muted);cursor:default;">Игрок «${input.value}» не найден</div>`;
    } else {
      dropdown.innerHTML = results.map((r, idx) => `
        <div class="search-item" data-idx="${idx}">
          <div>
            <div style="font-weight:600;">${r.name}</div>
            <div style="font-size:11px;color:var(--text-muted);">${r.sub}</div>
          </div>
          <span class="elo-tag">${r.tag}</span>
        </div>
      `).join('');
      dropdown.querySelectorAll('.search-item').forEach(el => {
        el.onclick = () => results[el.dataset.idx].action();
      });
    }
    dropdown.style.display = 'block';
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) dropdown.style.display = 'none';
  });
}

export function rememberNetworkPlayer(nick, elo = 800) {
  if (!nick || nick === 'Соперник' || nick === 'Хост') return;
  const list = JSON.parse(localStorage.getItem('nzb_known_players') || '[]');
  const existing = list.find(p => p.nick.toLowerCase() === nick.toLowerCase());
  if (existing) existing.elo = elo;
  else list.unshift({ nick, elo });
  localStorage.setItem('nzb_known_players', JSON.stringify(list.slice(0, 50)));
}

// --- ОЦЕНКА ПОЗИЦИИ ДЛЯ ИНДИКАТОРА ПЕРЕВЕСА (EVALUATION BAR) ---
export function getWhiteAdvantagePawns(chessInstance) {
  if (chessInstance.in_checkmate()) {
    return chessInstance.turn() === 'w' ? { text: '-M', whitePct: 0 } : { text: '+M', whitePct: 100 };
  }
  if (chessInstance.in_draw()) {
    return { text: '0.0', whitePct: 50 };
  }

  const val = { p: 1.0, n: 3.2, b: 3.3, r: 5.0, q: 9.0, k: 0 };
  const center = ['d4', 'e4', 'd5', 'e5'];
  let evalScore = 0;
  const board = chessInstance.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      let pts = val[cell.type];
      const sq = 'abcdefgh'[c] + (8 - r);
      if (center.includes(sq)) pts += 0.25;
      evalScore += (cell.color === 'w' ? pts : -pts);
    }
  }

  // Сигмоида для плавного заполнения полосы от 5% до 95%
  const clamped = Math.max(-10, Math.min(10, evalScore));
  const whitePct = Math.round(50 + (50 * (2 / (1 + Math.exp(-0.45 * clamped)) - 1)));
  const sign = evalScore > 0.05 ? '+' : '';
  return {
    text: `${sign}${evalScore.toFixed(1)}`,
    whitePct: Math.max(5, Math.min(95, whitePct)),
    isWhiteAdv: evalScore >= 0
  };
}

function staticEvalForSide(chess, side) {
  const val = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const center = ['d4', 'e4', 'd5', 'e5'];
  let score = 0;
  const board = chess.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      let pts = val[cell.type];
      const sq = 'abcdefgh'[c] + (8 - r);
      if (center.includes(sq)) pts += 25;
      score += (cell.color === side ? pts : -pts);
    }
  }

  if (chess.turn() !== side) {
    const replies = chess.moves({ verbose: true });
    let maxLoss = 0;
    for (let rep of replies) {
      if (rep.captured && val[rep.captured] > maxLoss) {
        maxLoss = val[rep.captured];
      }
    }
    score -= maxLoss * 0.85;
  }
  return score;
}

export function evaluateMoveQuality(fenBefore, moveObj, fenAfter) {
  const Ctor = window.Chess;
  const before = new Ctor(fenBefore);
  const after = new Ctor(fenAfter);
  const side = before.turn();

  const allMoves = before.moves({ verbose: true });
  let bestScore = -999999;
  let bestMove = allMoves[0] || moveObj;

  for (let m of allMoves) {
    before.move(m);
    if (before.in_checkmate()) {
      bestScore = 99999;
      bestMove = m;
      before.undo();
      break;
    }
    const sc = staticEvalForSide(before, side);
    if (sc > bestScore) {
      bestScore = sc;
      bestMove = m;
    }
    before.undo();
  }

  const bestOrig = bestMove.from;
  const bestDest = bestMove.to;
  const bestSan = bestMove.san;

  if (after.in_checkmate()) {
    return { symbol: '!!', label: 'Бриллиантовый мат', color: '#1baca6', brush: 'blue', bestOrig, bestDest, bestSan };
  }

  const playedScore = staticEvalForSide(after, side);
  const diff = playedScore - bestScore;

  const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900 };
  const movedPieceVal = pieceValues[moveObj.piece] || 0;
  const enemyReplies = after.moves({ verbose: true });
  const isSacrifice = movedPieceVal >= 320 && enemyReplies.some(r => r.to === moveObj.to && r.captured);

  if (isSacrifice && (after.in_check() || moveObj.captured) && diff >= -80) {
    return { symbol: '!!', label: 'Бриллиантовый ход', color: '#1baca6', brush: 'blue', bestOrig, bestDest, bestSan };
  }
  if (diff >= -15 && (after.in_check() || moveObj.captured || ['d4','e4','d5','e5'].includes(moveObj.to))) {
    return { symbol: '!', label: 'Сильный ход', color: '#629924', brush: 'green', bestOrig, bestDest, bestSan };
  }
  if (diff >= -35) {
    return { symbol: '★', label: 'Лучший ход', color: '#81b64c', brush: 'green', bestOrig, bestDest, bestSan };
  }
  if (diff >= -90) {
    return { symbol: '✓', label: 'Хороший ход', color: '#7fa650', brush: 'green', bestOrig, bestDest, bestSan };
  }
  if (diff >= -190) {
    return { symbol: '?!', label: 'Неточность', color: '#f0c15c', brush: 'yellow', bestOrig, bestDest, bestSan };
  }
  if (diff >= -360) {
    return { symbol: '?', label: 'Ошибка', color: '#e58f2a', brush: 'yellow', bestOrig, bestDest, bestSan };
  }
  return { symbol: '??', label: 'Зевок', color: '#cc3333', brush: 'red', bestOrig, bestDest, bestSan };
}

export function applyMatchRatingAndXp(result, opponentElo) {
  let currentElo = parseInt(localStorage.getItem('nzb_elo')) || 800;
  let currentXp = parseInt(localStorage.getItem('nzb_xp')) || 0;

  const expected = 1 / (1 + Math.pow(10, (opponentElo - currentElo) / 400));
  const actual = result === 'win' ? 1 : (result === 'draw' ? 0.5 : 0);
  let delta = Math.round(32 * (actual - expected));

  if (result === 'win' && delta < 8) delta = 8;
  if (result === 'loss' && delta > -8) delta = -8;

  const newElo = Math.max(100, currentElo + delta);
  const actualDelta = newElo - currentElo;

  const xpGain = result === 'win' ? Math.max(35, Math.round(opponentElo / 20)) : (result === 'draw' ? 20 : 10);
  const newXp = currentXp + xpGain;

  localStorage.setItem('nzb_elo', newElo);
  localStorage.setItem('nzb_xp', newXp);

  const level = Math.floor(newXp / 200) + 1;
  if (document.getElementById('sideEloTxt')) document.getElementById('sideEloTxt').innerText = `${newElo} ELO • Ур. ${level}`;
  if (document.getElementById('topEloTag')) document.getElementById('topEloTag').innerText = `${newElo} ELO`;
  if (document.getElementById('topLevel')) document.getElementById('topLevel').innerText = level;

  return { newElo, delta: actualDelta, xpGain, newXp, level };
}

export function showMatchResultModal({ isWin, isDraw = false, reason, oppName, oppCodeOrAvatar, oppElo, onRematch }) {
  playChessSound('end');
  let overlay = document.getElementById('matchResultOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'matchResultOverlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }

  const outcome = isDraw ? 'draw' : (isWin ? 'win' : 'loss');
  const stats = applyMatchRatingAndXp(outcome, oppElo);
  const myNick = localStorage.getItem('nzb_nick') || 'Player_NZB';
  const myAvatar = localStorage.getItem('nzb_avatar') || DEFAULT_AVATAR;

  const deltaSign = stats.delta >= 0 ? `+${stats.delta}` : `${stats.delta}`;
  const deltaColor = stats.delta > 0 ? 'var(--accent)' : (stats.delta < 0 ? 'var(--danger)' : 'var(--text-muted)');
  const progressPercent = Math.round(((stats.newXp % 200) / 200) * 100);

  const oppMedia = oppCodeOrAvatar.startsWith('data:') || oppCodeOrAvatar.startsWith('http')
    ? `<img src="${oppCodeOrAvatar}" alt="Opp">`
    : `<div class="result-mono">${oppCodeOrAvatar}</div>`;

  const bannerClass = isDraw ? '' : (isWin ? '' : 'loss');
  const bannerStyle = isDraw ? 'background: #4a4843;' : '';
  const bannerTitle = isDraw ? 'Ничья' : (isWin ? 'Победа' : 'Поражение');

  overlay.innerHTML = `
    <div class="result-modal-card">
      <div class="result-banner ${bannerClass}" style="${bannerStyle}">
        <h2>${bannerTitle}</h2>
        <p>${reason}</p>
      </div>
      <div class="result-body">
        <div class="result-versus">
          <div class="result-player ${isWin && !isDraw ? 'winner' : ''}">
            <img src="${myAvatar}" alt="You">
            <div style="font-size:13px;font-weight:700;">${myNick}</div>
            <div class="elo-tag">${stats.newElo}</div>
          </div>
          <div style="font-weight:800;color:var(--text-muted);font-size:14px;">VS</div>
          <div class="result-player ${!isWin && !isDraw ? 'winner' : ''}">
            ${oppMedia}
            <div style="font-size:13px;font-weight:700;">${oppName}</div>
            <div class="elo-tag">${oppElo}</div>
          </div>
        </div>

        <div class="result-stat-box">
          <div class="stat-line">
            <span>Изменение рейтинга</span>
            <span style="color:${deltaColor};font-family:monospace;font-size:16px;">${deltaSign} ELO</span>
          </div>
          <div class="stat-line" style="margin-bottom:4px;">
            <span>Опыт профиля (Уровень ${stats.level})</span>
            <span style="color:var(--accent);font-family:monospace;">+${stats.xpGain} XP</span>
          </div>
          <div class="xp-bar-track">
            <div class="xp-bar-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </div>

        <div style="display:flex;gap:10px;">
          <button id="resRematchBtn" class="btn" style="flex:1;">Реванш</button>
          <button id="resCloseBtn" class="btn btn-secondary" style="flex:1;">Обзор доски</button>
        </div>
      </div>
    </div>
  `;

  overlay.style.display = 'flex';
  document.getElementById('resCloseBtn').onclick = () => overlay.style.display = 'none';
  document.getElementById('resRematchBtn').onclick = () => {
    overlay.style.display = 'none';
    if (onRematch) onRematch();
  };
}

// --- РИСОВАНИЕ СТРЕЛОК И КРУГОВ С ВЫБОРОМ ЦВЕТА НА ТЕЛЕФОНЕ И ПК ---
export function enableMobileDrawing(cgInstance, boardElementId = 'board') {
  const boardEl = document.getElementById(boardElementId);
  if (!boardEl || !cgInstance) return;

  let activeBrush = 'green';
  let toolbar = document.getElementById('mobileDrawToolbar');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.id = 'mobileDrawToolbar';
    toolbar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%; max-width: 640px; margin-bottom: 4px;';
    toolbar.innerHTML = `
      <button id="toggleDrawBtn" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">Стрелки: ВЫКЛ</button>
      <div class="brush-palette" title="Цвет стрелок">
        <div class="brush-dot active-brush" data-brush="green" style="background:#629924;"></div>
        <div class="brush-dot" data-brush="red" style="background:#cc3333;"></div>
        <div class="brush-dot" data-brush="blue" style="background:#1baca6;"></div>
        <div class="brush-dot" data-brush="yellow" style="background:#e58f2a;"></div>
      </div>
      <button id="clearShapesBtn" class="btn btn-secondary" style="padding: 6px 10px; font-size: 12px;">Очистить</button>
    `;
    const container = boardEl.closest('.board-with-eval') || boardEl;
    container.parentNode.insertBefore(toolbar, container);
  }

  let drawMode = false;
  let startSq = null;
  let shapes = [];

  const toggleBtn = document.getElementById('toggleDrawBtn');
  const clearBtn = document.getElementById('clearShapesBtn');

  toolbar.querySelectorAll('.brush-dot').forEach(dot => {
    dot.onclick = () => {
      activeBrush = dot.dataset.brush;
      toolbar.querySelectorAll('.brush-dot').forEach(d => d.classList.remove('active-brush'));
      dot.classList.add('active-brush');
    };
  });

  toggleBtn.onclick = () => {
    drawMode = !drawMode;
    toggleBtn.innerText = drawMode ? 'Стрелки: ВКЛ' : 'Стрелки: ВЫКЛ';
    toggleBtn.className = drawMode ? 'btn' : 'btn btn-secondary';
    cgInstance.set({ movable: { enabled: !drawMode } });
  };

  clearBtn.onclick = () => {
    shapes = [];
    cgInstance.setShapes([]);
  };

  function getSquareFromTouch(touch) {
    const rect = boardEl.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;

    const col = Math.floor((x / rect.width) * 8);
    const row = Math.floor((y / rect.height) * 8);
    const isBlack = cgInstance.state.orientation === 'black';

    const files = isBlack ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h'];
    const ranks = isBlack ? ['1','2','3','4','5','6','7','8'] : ['8','7','6','5','4','3','2','1'];
    return files[col] + ranks[row];
  }

  if (boardEl.dataset.touchBound) return;
  boardEl.dataset.touchBound = '1';

  boardEl.addEventListener('touchstart', (e) => {
    if (!drawMode || !e.touches.length) return;
    e.preventDefault();
    startSq = getSquareFromTouch(e.touches[0]);
  }, { passive: false });

  boardEl.addEventListener('touchend', (e) => {
    if (!drawMode || !startSq || !e.changedTouches.length) return;
    e.preventDefault();
    const endSq = getSquareFromTouch(e.changedTouches[0]);
    if (endSq) {
      const existingIdx = shapes.findIndex(s => s.orig === startSq && s.dest === (startSq === endSq ? undefined : endSq));
      if (existingIdx !== -1) {
        shapes.splice(existingIdx, 1);
      } else {
        shapes.push(startSq === endSq ? { orig: startSq, brush: activeBrush } : { orig: startSq, dest: endSq, brush: activeBrush });
      }
      cgInstance.setShapes([...shapes]);
    }
    startSq = null;
  }, { passive: false });
}