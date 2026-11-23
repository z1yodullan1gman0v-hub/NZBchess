const tg = window.Telegram.WebApp;
tg.ready(); // Говорим ТГ, что сайт загрузился
tg.expand(); // Открываем на весь экран
tg.disableVerticalSwipes(); // Чтобы окно не закрывалось, когда двигаешь фигуры вниз

import { Chessground } from 'https://cdn.jsdelivr.net/npm/chessground@8.3.3/chessground.min.js';

// Подхватываем настройки темы и стиля фигур
document.documentElement.style.setProperty('--accent', localStorage.getItem('nzb_accent') || '#81b64c');
document.documentElement.style.setProperty('--bg-main', localStorage.getItem('nzb_bg_main') || '#262421');
document.documentElement.style.setProperty('--sq-light', localStorage.getItem('nzb_sq_light') || '#ebecd0');
document.documentElement.style.setProperty('--sq-dark', localStorage.getItem('nzb_sq_dark') || '#779556');
if (localStorage.getItem('nzb_bg_img')) document.body.style.backgroundImage = `url('${localStorage.getItem('nzb_bg_img')}')`;

const pTheme = localStorage.getItem('nzb_piece_theme') || 'cburnett';
if (pTheme !== 'cburnett') {
  const types = [['pawn.white','wP'],['knight.white','wN'],['bishop.white','wB'],['rook.white','wR'],['queen.white','wQ'],['king.white','wK'],['pawn.black','bP'],['knight.black','bN'],['bishop.black','bB'],['rook.black','bR'],['queen.black','bQ'],['king.black','bK']];
  document.getElementById('pieceOverride').innerHTML = types.map(([c, code]) => `.cg-wrap piece.${c} { background-image: url('https://lichess1.org/assets/piece/${pTheme}/${code}.svg') !important; }`).join('\n');
}

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23383531'/><circle cx='50' cy='38' r='18' fill='%2381b64c'/><path d='M20 88c0-18 14-28 30-28s30 10 30 28' fill='%2381b64c'/></svg>";

const game = new Chess();
let cg = null, peer = null, conn = null, myColor = 'w', pendingMove = null, isGameOver = false, pingInterval = null;

const myNick = localStorage.getItem('nzb_nick') || 'Игрок_NZB';
const myAvatar = localStorage.getItem('nzb_avatar') || DEFAULT_AVATAR;
let oppNickGlobal = 'Соперник';

// Буфер для фиксации упущенных матов в текущей партии
let missedMatesInCurrentGame = [];

const peerConfig = { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } };

document.getElementById('createBtn').addEventListener('click', () => {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  document.getElementById('roomCodeDisplay').innerText = code;
  document.getElementById('connectionStatus').innerText = 'Комната создана! Ждём второго игрока...';

  if (peer) peer.destroy();
  peer = new Peer('nzb-lan-' + code, peerConfig);

  peer.on('connection', (connection) => {
    conn = connection;
    myColor = 'w';
    setupConnection();
    conn.on('open', () => {
      conn.send({ type: 'handshake', nick: myNick, avatar: myAvatar });
      startMatch('Соперник', DEFAULT_AVATAR);
    });
  });
});

document.getElementById('joinBtn').addEventListener('click', () => {
  const code = document.getElementById('joinCodeInput').value.trim();
  if (code.length !== 4) {
    document.getElementById('connectionStatus').innerText = 'Введите 4 цифры кода!';
    return;
  }
  document.getElementById('connectionStatus').innerText = 'Подключение к ' + code + '...';

  if (peer) peer.destroy();
  peer = new Peer(peerConfig);

  peer.on('open', () => {
    conn = peer.connect('nzb-lan-' + code, { reliable: true });
    myColor = 'b';
    setupConnection();
    conn.on('open', () => {
      conn.send({ type: 'handshake', nick: myNick, avatar: myAvatar });
      startMatch('Хост', DEFAULT_AVATAR);
    });
  });
});

function setupConnection() {
  let lastPong = Date.now();
  clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    if (!conn || !conn.open || isGameOver) return;
    if (Date.now() - lastPong > 4000) {
      declareAutoWin('Соперник потерял соединение');
      return;
    }
    conn.send({ type: 'ping' });
  }, 1500);

  conn.on('data', (data) => {
    lastPong = Date.now();
    if (data.type === 'ping') conn.send({ type: 'pong' });
    else if (data.type === 'handshake') {
      oppNickGlobal = data.nick;
      renderPlayerBadge('oppName', data.nick, data.avatar || DEFAULT_AVATAR);
    } else if (data.type === 'move' && !isGameOver) {
      checkAndRecordMissedMate(data.move);
      game.move(data.move);
      syncBoard();
      updateUI();
    } else if (data.type === 'reset') {
      isGameOver = false;
      missedMatesInCurrentGame = [];
      game.reset();
      syncBoard();
      updateUI();
    } else if (data.type === 'leave') {
      declareAutoWin('Соперник покинул игру');
    } else if (data.type === 'new_puzzle') {
      saveCustomMatchPuzzle(data.puzzle);
    }
  });

  conn.on('close', () => declareAutoWin('Соперник отключился'));
}

// --- ДЕТЕКТОР УПУЩЕННОГО МАТА ---
function findForcedMateMove(chessInstance) {
  const moves = chessInstance.moves({ verbose: true });
  // 1. Проверяем мат в 1 ход
  for (let m of moves) {
    chessInstance.move(m);
    const isMate = chessInstance.in_checkmate();
    chessInstance.undo();
    if (isMate) return { uci: m.from + m.to, san: m.san, depth: 1 };
  }
  // 2. Проверяем форсированный мат в 2 хода
  for (let m of moves) {
    chessInstance.move(m);
    const replies = chessInstance.moves({ verbose: true });
    if (replies.length > 0 && replies.length <= 4) {
      let allRepliesLeadToMate = true;
      for (let r of replies) {
        chessInstance.move(r);
        let canMateNext = false;
        for (let m2 of chessInstance.moves({ verbose: true })) {
          chessInstance.move(m2);
          if (chessInstance.in_checkmate()) canMateNext = true;
          chessInstance.undo();
          if (canMateNext) break;
        }
        chessInstance.undo();
        if (!canMateNext) { allRepliesLeadToMate = false; break; }
      }
      if (allRepliesLeadToMate) {
        chessInstance.undo();
        return { uci: m.from + m.to, san: m.san, depth: 2 };
      }
    }
    chessInstance.undo();
  }
  return null;
}

function checkAndRecordMissedMate(actualMoveObj) {
  const fenBeforeMove = game.fen();
  const turnColor = game.turn(); // 'w' или 'b'
  const mateOpportunity = findForcedMateMove(game);

  if (mateOpportunity) {
    const playedUci = actualMoveObj.from + actualMoveObj.to;
    // Если игрок НЕ сделал матовый ход — запоминаем этот момент!
    if (playedUci !== mateOpportunity.uci) {
      const whitePlayer = myColor === 'w' ? myNick : oppNickGlobal;
      const blackPlayer = myColor === 'b' ? myNick : oppNickGlobal;
      const blunderer = turnColor === 'w' ? whitePlayer : blackPlayer;

      missedMatesInCurrentGame.push({
        fen: fenBeforeMove,
        solution: mateOpportunity.uci,
        san: mateOpportunity.san,
        depth: mateOpportunity.depth,
        turn: turnColor,
        white: whitePlayer,
        black: blackPlayer,
        blunderer: blunderer,
        date: new Date().toLocaleDateString('ru-RU')
      });
    }
  }
}

function saveCustomMatchPuzzle(puzzleObj) {
  const list = JSON.parse(localStorage.getItem('nzb_match_puzzles') || '[]');
  // Проверяем, чтобы такая же позиция не дублировалась
  if (!list.some(p => p.fen === puzzleObj.fen)) {
    list.unshift(puzzleObj);
    localStorage.setItem('nzb_match_puzzles', JSON.stringify(list));
  }
}

function renderPlayerBadge(elementId, nick, avatarUrl) {
  document.getElementById(elementId).innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 10px;">
      <img src="${avatarUrl}" class="avatar-small" alt="Avatar">
      <span>${nick}</span>
    </span>
  `;
}

window.addEventListener('beforeunload', () => {
  if (conn && conn.open && !isGameOver) conn.send({ type: 'leave' });
});

function declareAutoWin(reason) {
  if (isGameOver) return;
  isGameOver = true;
  clearInterval(pingInterval);
  const statusEl = document.getElementById('gameStatus');
  statusEl.innerText = `🏆 АВТОВИН! ${reason}`;
  statusEl.style.color = '#81b64c';
  if (cg) cg.set({ movable: { color: null } });
}

function getLegalDests() {
  const dests = new Map();
  game.SQUARES.forEach((sq) => {
    const moves = game.moves({ square: sq, verbose: true });
    if (moves.length) dests.set(sq, moves.map((m) => m.to));
  });
  return dests;
}

function startMatch(oppNick, oppAvatar) {
  isGameOver = false;
  missedMatesInCurrentGame = [];
  oppNickGlobal = oppNick;
  document.getElementById('lobbyScreen').style.display = 'none';
  document.getElementById('gameScreen').style.display = 'flex';

  const orientation = myColor === 'w' ? 'white' : 'black';
  renderPlayerBadge('myName', myNick, myAvatar);
  renderPlayerBadge('oppName', oppNick, oppAvatar);
  document.getElementById('myColorBadge').innerText = myColor === 'w' ? 'Белые' : 'Чёрные';
  document.getElementById('oppColorBadge').innerText = myColor === 'w' ? 'Чёрные' : 'Белые';

  game.reset();
  cg = Chessground(document.getElementById('board'), {
    fen: game.fen(),
    orientation: orientation,
    turnColor: 'white',
    movable: { color: orientation, free: false, dests: getLegalDests(), events: { after: handleUserMove } },
    drawable: { enabled: true, visible: true }
  });
  updateUI();
}

function syncBoard() {
  const myOrientation = myColor === 'w' ? 'white' : 'black';
  const canMove = !isGameOver && !game.game_over() && game.turn() === myColor;
  cg.set({
    fen: game.fen(),
    turnColor: game.turn() === 'w' ? 'white' : 'black',
    check: game.in_check(),
    movable: { color: canMove ? myOrientation : null, dests: getLegalDests() }
  });
}

function handleUserMove(orig, dest) {
  if (isGameOver) return;
  const piece = game.get(orig);
  if (piece && piece.type === 'p' && ((piece.color === 'w' && dest[1] === '8') || (piece.color === 'b' && dest[1] === '1'))) {
    pendingMove = { from: orig, to: dest };
    document.getElementById('promoModal').style.display = 'flex';
    return;
  }
  commitMove({ from: orig, to: dest });
}

document.querySelectorAll('#promoModal button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById('promoModal').style.display = 'none';
    commitMove({ from: pendingMove.from, to: pendingMove.to, promotion: btn.dataset.piece });
  });
});

function commitMove(moveObj) {
  if (isGameOver) return;
  // Проверяем, не упустил ли игрок мат этим ходом
  checkAndRecordMissedMate(moveObj);

  if (!game.move(moveObj)) return;
  if (conn && conn.open) conn.send({ type: 'move', move: moveObj });
  syncBoard();
  updateUI();
}

function updateUI() {
  if (isGameOver) return;
  const statusEl = document.getElementById('gameStatus');
  if (game.in_checkmate()) {
    isGameOver = true;
    const winnerColor = game.turn() === 'w' ? 'b' : 'w';
    const winnerName = winnerColor === 'w' ? 'Белые' : 'Чёрные';
    statusEl.innerText = `🏆 МАТ! Победили ${winnerName}!`;
    statusEl.style.color = '#ca3431';

    // Если победитель поставил мат ПОСЛЕ того, как проигравший упустил свой мат — сохраняем в Задачи!
    const fatalMiss = missedMatesInCurrentGame.reverse().find(m => m.turn !== winnerColor);
    if (fatalMiss) {
      saveCustomMatchPuzzle(fatalMiss);
      if (conn && conn.open) conn.send({ type: 'new_puzzle', puzzle: fatalMiss });
      statusEl.innerHTML += `<div style="font-size:12px; color:#81b64c; margin-top:5px;">🧩 Упущенный мат (${fatalMiss.blunderer}) добавлен в Задачи!</div>`;
    }
  } else if (game.in_draw()) {
    isGameOver = true;
    statusEl.innerText = '🤝 Ничья!';
    statusEl.style.color = '#aaa';
  } else {
    statusEl.innerText = (game.turn() === 'w' ? 'Ход белых' : 'Ход чёрных') + (game.in_check() ? ' (ШАХ!)' : '');
    statusEl.style.color = game.in_check() ? '#e58f2a' : 'var(--accent)';
  }

  const history = game.history();
  const listEl = document.getElementById('moveHistory');
  listEl.innerHTML = '';
  for (let i = 0; i < history.length; i += 2) {
    listEl.innerHTML += `<div class="move-row"><span class="move-num">${i / 2 + 1}.</span><span class="move-w">${history[i]}</span><span class="move-b">${history[i + 1] || ''}</span></div>`;
  }
  listEl.scrollTop = listEl.scrollHeight;
}

document.getElementById('resetBtn').addEventListener('click', () => {
  isGameOver = false;
  missedMatesInCurrentGame = [];
  game.reset();
  syncBoard();
  updateUI();
  if (conn && conn.open) conn.send({ type: 'reset' });
});

document.getElementById('leaveBtn').addEventListener('click', () => {
  if (conn && conn.open && !isGameOver) conn.send({ type: 'leave' });
  setTimeout(() => { if (peer) peer.destroy(); location.href = 'index.html'; }, 100);
});