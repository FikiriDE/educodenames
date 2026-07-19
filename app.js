(() => {
  'use strict';

  const STORAGE_GAME_KEY = 'eduCodenames.game';

  const BOARD_SIZE = 25;
  const COUNT_RED = 9;
  const COUNT_BLUE = 8;
  const COUNT_NEUTRAL = 7;
  const COUNT_BLACK = 1;

  /**
   * game = {
   *   baseWords: string[25],
   *   words: string[25],
   *   colors: ('red'|'blue'|'neutral'|'black')[25],
   *   revealed: boolean[25],
   *   currentTeam: 'red'|'blue',
   *   mode: 'standard'|'rotation',
   *   clueWord: string|null,
   *   clueNumber: number|null,
   *   guessesMade: number,
   *   gameOver: boolean,
   *   winner: 'red'|'blue'|null,
   *   loserReason: 'assassin'|'allFound'|null
   * }
   */
  let game = null;

  let currentView = 'setup';

  /** true when this tab is a scanned, read-only external Spymaster view */
  let isReadOnlyExternal = false;

  // ---------- persistence ----------

  function loadGame() {
    try {
      const raw = localStorage.getItem(STORAGE_GAME_KEY);
      game = raw ? JSON.parse(raw) : null;
    } catch (e) {
      game = null;
    }
  }

  function saveGame() {
    if (game) {
      localStorage.setItem(STORAGE_GAME_KEY, JSON.stringify(game));
    } else {
      localStorage.removeItem(STORAGE_GAME_KEY);
    }
  }

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_GAME_KEY && !isReadOnlyExternal) {
      loadGame();
      renderGameViews();
    }
  });

  // ---------- helpers ----------

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function parseWords(text) {
    return text
      .split('\n')
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
  }

  function getWordsFromTextarea() {
    return parseWords(wordInput.value);
  }

  function getSelectedMode() {
    const checked = document.querySelector('input[name="gameMode"]:checked');
    return checked ? checked.value : 'standard';
  }

  // ---------- QR sharing (second-device Spymaster view) ----------

  const COLOR_CODE = { red: 'r', blue: 'b', neutral: 'n', black: 'k' };
  const COLOR_DECODE = { r: 'red', b: 'blue', n: 'neutral', k: 'black' };

  function encodeGameSnapshot(g) {
    const payload = {
      w: g.words,
      c: g.colors.map((c) => COLOR_CODE[c]).join(''),
      r: g.revealed.map((b) => (b ? '1' : '0')).join(''),
      t: g.currentTeam,
      m: g.mode,
      cw: g.clueWord,
      cn: g.clueNumber,
      go: g.gameOver,
      wn: g.winner,
      lr: g.loserReason,
    };
    const json = JSON.stringify(payload);
    return btoa(unescape(encodeURIComponent(json)));
  }

  function decodeGameSnapshot(str) {
    const json = decodeURIComponent(escape(atob(str)));
    const p = JSON.parse(json);
    return {
      words: p.w,
      colors: p.c.split('').map((ch) => COLOR_DECODE[ch]),
      revealed: p.r.split('').map((ch) => ch === '1'),
      currentTeam: p.t,
      mode: p.m,
      clueWord: p.cw,
      clueNumber: p.cn,
      gameOver: p.go,
      winner: p.wn,
      loserReason: p.lr,
    };
  }

  function buildShareUrl() {
    const base = location.origin + location.pathname;
    return `${base}?spy=${encodeGameSnapshot(game)}`;
  }

  function openQrModal() {
    if (!game) return;
    const url = buildShareUrl();
    qrLinkInput.value = url;
    qrCodeBox.innerHTML = '';
    new QRCode(qrCodeBox, {
      text: url,
      width: 240,
      height: 240,
      correctLevel: QRCode.CorrectLevel.L,
    });
    qrModalOverlay.classList.add('show');
  }

  function closeQrModal() {
    qrModalOverlay.classList.remove('show');
  }

  function initReadOnlyExternalViewIfPresent() {
    const params = new URLSearchParams(location.search);
    const spyParam = params.get('spy');
    if (!spyParam) return false;
    try {
      game = decodeGameSnapshot(spyParam);
    } catch (e) {
      return false;
    }
    isReadOnlyExternal = true;
    document.querySelectorAll('.view-btn, .footer-link').forEach((btn) => {
      if (btn.dataset.view !== 'spymaster') btn.style.display = 'none';
    });
    clueWordInput.disabled = true;
    clueNumberInput.disabled = true;
    submitClueBtn.style.display = 'none';
    document.querySelector('#view-spymaster .clue-panel').style.display = 'none';
    document.querySelector('#view-spymaster .controls').style.display = 'none';
    spyReadonlyBanner.classList.add('show');
    setView('spymaster');
    return true;
  }

  // ---------- board generation ----------

  function buildAssignment() {
    const colors = [
      ...Array(COUNT_RED).fill('red'),
      ...Array(COUNT_BLUE).fill('blue'),
      ...Array(COUNT_NEUTRAL).fill('neutral'),
      ...Array(COUNT_BLACK).fill('black'),
    ];
    return shuffle(colors);
  }

  function startGameFromWords(rawWords) {
    let pool = rawWords.slice();
    if (pool.length > BOARD_SIZE) {
      pool = shuffle(pool).slice(0, BOARD_SIZE);
    }
    const baseWords = pool;
    const words = shuffle(baseWords);
    const colors = buildAssignment();
    game = {
      baseWords,
      words,
      colors,
      revealed: Array(BOARD_SIZE).fill(false),
      currentTeam: 'red', // red has 9 cards, starts first
      mode: getSelectedMode(),
      clueWord: null,
      clueNumber: null,
      guessesMade: 0,
      gameOver: false,
      winner: null,
      loserReason: null,
    };
    saveGame();
    setView('spymaster');
  }

  function resetBoardSameWords() {
    if (!game) return;
    const baseWords = game.baseWords;
    const mode = game.mode;
    const words = shuffle(baseWords);
    const colors = buildAssignment();
    game = {
      baseWords,
      words,
      colors,
      revealed: Array(BOARD_SIZE).fill(false),
      currentTeam: 'red',
      mode,
      clueWord: null,
      clueNumber: null,
      guessesMade: 0,
      gameOver: false,
      winner: null,
      loserReason: null,
    };
    saveGame();
    renderGameViews();
  }

  // ---------- game logic ----------

  function remainingCount(team) {
    if (!game) return 0;
    let n = 0;
    for (let i = 0; i < BOARD_SIZE; i++) {
      if (game.colors[i] === team && !game.revealed[i]) n++;
    }
    return n;
  }

  function submitClue() {
    if (!game || game.gameOver) return;
    const word = clueWordInput.value.trim();
    const num = parseInt(clueNumberInput.value, 10);
    if (!word || isNaN(num) || num < 0) return;
    game.clueWord = word;
    game.clueNumber = num;
    game.guessesMade = 0;
    clueWordInput.value = '';
    clueNumberInput.value = '';
    saveGame();
    renderGameViews();
  }

  function reassignHiddenCards() {
    const hiddenIndices = [];
    const hiddenColors = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      if (!game.revealed[i]) {
        hiddenIndices.push(i);
        hiddenColors.push(game.colors[i]);
      }
    }
    const shuffledColors = shuffle(hiddenColors);
    hiddenIndices.forEach((idx, j) => {
      game.colors[idx] = shuffledColors[j];
    });
  }

  function switchTeam() {
    game.currentTeam = game.currentTeam === 'red' ? 'blue' : 'red';
    game.clueWord = null;
    game.clueNumber = null;
    game.guessesMade = 0;
    if (game.mode === 'rotation') {
      reassignHiddenCards();
    }
  }

  function handleCardClick(index) {
    if (isReadOnlyExternal) return;
    if (!game || game.gameOver) return;
    if (game.revealed[index]) return;
    if (!game.clueWord) return; // require an active clue before guessing

    game.revealed[index] = true;
    const color = game.colors[index];

    if (color === 'black') {
      game.gameOver = true;
      game.winner = game.currentTeam === 'red' ? 'blue' : 'red';
      game.loserReason = 'assassin';
    } else if (color === game.currentTeam) {
      game.guessesMade++;
      if (remainingCount(game.currentTeam) === 0) {
        game.gameOver = true;
        game.winner = game.currentTeam;
        game.loserReason = 'allFound';
      } else if (game.guessesMade >= game.clueNumber) {
        switchTeam();
      }
    } else {
      // wrong team's card or neutral -> immediate switch
      switchTeam();
    }

    saveGame();
    renderGameViews();
  }

  // ---------- rendering: setup view ----------

  function updateWordCount() {
    const words = getWordsFromTextarea();
    wordCountEl.textContent = `${words.length} Begriffe`;
    const ok = words.length >= BOARD_SIZE;
    startGameBtn.disabled = !ok;
    if (words.length === 0) {
      setupMessage.textContent = '';
      setupMessage.classList.remove('error');
    } else if (!ok) {
      setupMessage.textContent = `Es werden mindestens 25 Begriffe benötigt (aktuell ${words.length}).`;
      setupMessage.classList.add('error');
    } else {
      setupMessage.textContent = words.length > BOARD_SIZE
        ? `${words.length} Begriffe erfasst – beim Start werden zufällig 25 ausgewählt.`
        : '25 Begriffe bereit.';
      setupMessage.classList.remove('error');
    }
  }

  function handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const incoming = parseWords(text.replace(/,/g, '\n'));
      const existing = getWordsFromTextarea();
      const merged = existing.concat(incoming);
      wordInput.value = merged.join('\n');
      updateWordCount();
    };
    reader.readAsText(file);
  }

  // ---------- rendering: game views ----------

  function teamLabel(team) {
    return team === 'red' ? 'Rot' : 'Blau';
  }

  function renderBoard(boardEl, isSpymaster) {
    boardEl.innerHTML = '';
    if (!game) return;
    for (let i = 0; i < BOARD_SIZE; i++) {
      const tile = document.createElement('div');
      const revealed = game.revealed[i];
      tile.className = 'card-tile';
      if (isSpymaster || revealed) {
        tile.classList.add(`color-${game.colors[i]}`);
      }
      if (revealed) tile.classList.add('revealed');
      tile.textContent = game.words[i];
      tile.addEventListener('click', () => handleCardClick(i));
      boardEl.appendChild(tile);
    }
  }

  function renderClue(activeClueEl) {
    if (!game) {
      activeClueEl.innerHTML = '';
      return;
    }
    if (game.clueWord) {
      activeClueEl.innerHTML = `Hinweis: <span class="clue-value">${escapeHtml(game.clueWord)}</span> — <span class="clue-value">${game.clueNumber}</span>`;
    } else if (!game.gameOver) {
      activeClueEl.textContent = 'Warte auf Hinweis vom Spielleiter...';
    } else {
      activeClueEl.textContent = '';
    }
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function renderTurnAndCounts(turnEl, countsEl) {
    if (!game) {
      turnEl.textContent = '';
      countsEl.textContent = '';
      return;
    }
    turnEl.textContent = game.gameOver ? 'Spiel beendet' : `Team ${teamLabel(game.currentTeam)} ist am Zug`;
    turnEl.className = 'turn-indicator' + (game.gameOver ? '' : ` team-${game.currentTeam}`);
    countsEl.innerHTML = `<span class="count-red">Rot: ${remainingCount('red')}</span><span class="count-blue">Blau: ${remainingCount('blue')}</span>`;
  }

  function renderModeBadge(badgeEl) {
    if (!game || game.mode !== 'rotation') {
      badgeEl.textContent = '';
      badgeEl.classList.remove('show');
      return;
    }
    badgeEl.textContent = 'Modus: Spielleiter-Rotation';
    badgeEl.classList.add('show');
  }

  function renderGameOverBanner(bannerEl) {
    if (!game || !game.gameOver) {
      bannerEl.classList.remove('show', 'win-red', 'win-blue');
      bannerEl.textContent = '';
      return;
    }
    const winnerLabel = teamLabel(game.winner);
    const text = game.loserReason === 'assassin'
      ? `Todeskarte aufgedeckt! Team ${teamLabel(game.winner === 'red' ? 'blue' : 'red')} hat verloren. Team ${winnerLabel} gewinnt!`
      : `Team ${winnerLabel} hat alle eigenen Begriffe gefunden und gewinnt!`;
    bannerEl.textContent = text;
    bannerEl.classList.add('show', game.winner === 'red' ? 'win-red' : 'win-blue');
  }

  function renderGameViews() {
    renderBoard(spyBoard, true);
    renderBoard(teamBoard, false);
    renderClue(spyActiveClue);
    renderClue(teamActiveClue);
    renderTurnAndCounts(spyTurnIndicator, spyRemainingCounts);
    renderTurnAndCounts(teamTurnIndicator, teamRemainingCounts);
    renderGameOverBanner(spyGameOverBanner);
    renderGameOverBanner(teamGameOverBanner);
    renderModeBadge(spyModeBadge);
    renderModeBadge(teamModeBadge);

    const clueActive = !!(game && game.clueWord && !game.gameOver);
    submitClueBtn.disabled = !!(game && game.gameOver);
  }

  // ---------- view switching ----------

  function setView(view) {
    currentView = view;
    document.querySelectorAll('.view').forEach((el) => el.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    document.querySelectorAll('.view-btn, .footer-link').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });
    if (view === 'spymaster' || view === 'team') {
      renderGameViews();
    }
  }

  // ---------- DOM refs ----------

  const wordInput = document.getElementById('wordInput');
  const wordCountEl = document.getElementById('wordCount');
  const fileUpload = document.getElementById('fileUpload');
  const clearWordsBtn = document.getElementById('clearWordsBtn');
  const setupMessage = document.getElementById('setupMessage');
  const startGameBtn = document.getElementById('startGameBtn');

  const spyTurnIndicator = document.getElementById('spyTurnIndicator');
  const spyRemainingCounts = document.getElementById('spyRemainingCounts');
  const spyReadonlyBanner = document.getElementById('spyReadonlyBanner');
  const clueWordInput = document.getElementById('clueWordInput');
  const clueNumberInput = document.getElementById('clueNumberInput');
  const submitClueBtn = document.getElementById('submitClueBtn');
  const spyActiveClue = document.getElementById('spyActiveClue');
  const spyBoard = document.getElementById('spyBoard');
  const spyGameOverBanner = document.getElementById('spyGameOverBanner');
  const spyModeBadge = document.getElementById('spyModeBadge');
  const showQrBtn = document.getElementById('showQrBtn');
  const resetBoardBtnSpy = document.getElementById('resetBoardBtnSpy');
  const backToSetupBtnSpy = document.getElementById('backToSetupBtnSpy');
  const qrModalOverlay = document.getElementById('qrModalOverlay');
  const qrCodeBox = document.getElementById('qrCodeBox');
  const qrLinkInput = document.getElementById('qrLinkInput');
  const copyQrLinkBtn = document.getElementById('copyQrLinkBtn');
  const closeQrModalBtn = document.getElementById('closeQrModalBtn');

  const teamTurnIndicator = document.getElementById('teamTurnIndicator');
  const teamRemainingCounts = document.getElementById('teamRemainingCounts');
  const teamActiveClue = document.getElementById('teamActiveClue');
  const teamBoard = document.getElementById('teamBoard');
  const teamGameOverBanner = document.getElementById('teamGameOverBanner');
  const teamModeBadge = document.getElementById('teamModeBadge');
  const fullscreenBtn = document.getElementById('fullscreenBtn');

  // ---------- event bindings ----------

  document.querySelectorAll('.view-btn, .footer-link').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  wordInput.addEventListener('input', updateWordCount);

  clearWordsBtn.addEventListener('click', () => {
    wordInput.value = '';
    updateWordCount();
  });

  fileUpload.addEventListener('change', () => {
    const file = fileUpload.files && fileUpload.files[0];
    if (file) handleFileUpload(file);
    fileUpload.value = '';
  });

  startGameBtn.addEventListener('click', () => {
    const words = getWordsFromTextarea();
    if (words.length < BOARD_SIZE) return;
    startGameFromWords(words);
  });

  submitClueBtn.addEventListener('click', submitClue);
  clueWordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitClue(); });
  clueNumberInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitClue(); });

  resetBoardBtnSpy.addEventListener('click', () => {
    if (confirm('Neues, zufälliges Spielfeld mit denselben Begriffen erstellen?')) {
      resetBoardSameWords();
    }
  });

  backToSetupBtnSpy.addEventListener('click', () => setView('setup'));

  showQrBtn.addEventListener('click', openQrModal);
  closeQrModalBtn.addEventListener('click', closeQrModal);
  qrModalOverlay.addEventListener('click', (e) => {
    if (e.target === qrModalOverlay) closeQrModal();
  });
  copyQrLinkBtn.addEventListener('click', () => {
    qrLinkInput.select();
    navigator.clipboard.writeText(qrLinkInput.value).catch(() => {
      document.execCommand('copy');
    });
  });

  fullscreenBtn.addEventListener('click', () => {
    const el = document.getElementById('view-team');
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  });

  // ---------- init ----------

  if (!initReadOnlyExternalViewIfPresent()) {
    loadGame();
    updateWordCount();
    setView(game ? 'spymaster' : 'setup');
  }
})();
