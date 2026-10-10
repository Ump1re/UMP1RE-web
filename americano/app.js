'use strict';

const FIXED_4 = [
  { a: [0, 1], b: [2, 3], sit: [] },
  { a: [0, 2], b: [1, 3], sit: [] },
  { a: [0, 3], b: [1, 2], sit: [] },
];

const FIXED_5 = [
  { a: [0, 1], b: [2, 3], sit: [4] },
  { a: [0, 2], b: [1, 4], sit: [3] },
  { a: [0, 3], b: [2, 4], sit: [1] },
  { a: [0, 4], b: [1, 3], sit: [2] },
  { a: [1, 2], b: [3, 4], sit: [0] },
];

const FIXED_6 = [
  { a: [1, 4], b: [2, 5], sit: [0, 3] },
  { a: [0, 5], b: [1, 3], sit: [2, 4] },
  { a: [0, 3], b: [2, 4], sit: [1, 5] },
  { a: [0, 2], b: [1, 5], sit: [3, 4] },
  { a: [0, 4], b: [2, 3], sit: [1, 5] },
  { a: [1, 5], b: [3, 4], sit: [0, 2] },
  { a: [0, 1], b: [2, 5], sit: [3, 4] },
  { a: [1, 4], b: [3, 5], sit: [0, 2] },
  { a: [0, 4], b: [2, 3], sit: [1, 5] },
  { a: [1, 2], b: [4, 5], sit: [0, 3] },
  { a: [0, 2], b: [1, 3], sit: [4, 5] },
  { a: [0, 5], b: [3, 4], sit: [1, 2] },
  { a: [1, 2], b: [3, 5], sit: [0, 4] },
  { a: [0, 1], b: [4, 5], sit: [2, 3] },
  { a: [0, 3], b: [2, 4], sit: [1, 5] },
];

const DEFAULT_CONFIG = {
  playerOptions: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  courtOptions: [1, 2, 3, 4],
  pointOptions: [16, 17, 18, 19, 20, 21, 22, 23, 24],
  rotationOptions: [1, 2, 3, 4],
  minutesPerGame: {
    16: 10,
    17: 11,
    18: 11,
    19: 12,
    20: 13,
    21: 13,
    22: 14,
    23: 14,
    24: 15,
  },
};

let config = normalizeConfig(DEFAULT_CONFIG);

const state = {
  numPlayers: DEFAULT_CONFIG.playerOptions[0],
  courts: DEFAULT_CONFIG.courtOptions[0],
  pointsPerGame: DEFAULT_CONFIG.pointOptions[0],
  rotations: DEFAULT_CONFIG.rotationOptions[0],
  players: [],
  schedule: [],
  fixtures: [],
  scores: [],
  drafts: new Map(),
  pageIndex: 0,
  currentRoundIndex: 0,
  activeFixtureIndex: null,
  returnPageIndex: 0,
  pendingSkipRoundIndex: null,
  setupStep: 0,
  leaderboardView: 'adjusted',
  built: false,
};

const els = {};
let leaderboardSharePhoto = null;
let leaderboardClubLogo = null;
let leaderboardComposerActive = false;
let leaderboardPreviewActive = false;
let leaderboardPreviewBlob = null;
let leaderboardPreviewUrl = null;

document.addEventListener('DOMContentLoaded', async () => {
  config = await loadAmericanoConfig();
  cacheElements();
  initDefaults();
  bindEvents();
  render();
});

function cacheElements() {
  [
    'screen-root',
    'leaderboard-modal',
    'leaderboard-body',
    'leaderboard-close',
    'leaderboard-subtitle',
    'leaderboard-actions',
    'skip-modal',
    'skip-modal-body',
    'skip-modal-close',
    'skip-modal-cancel',
    'skip-modal-confirm',
    'quit-modal',
    'quit-modal-body',
    'quit-modal-close',
    'quit-modal-cancel',
    'quit-modal-confirm',
  ].forEach(id => {
    els[id] = document.getElementById(id);
  });
}

async function loadAmericanoConfig() {
  try {
    const response = await fetch('/americano/config.json', { cache: 'no-store' });
    if (response.ok) {
      return normalizeConfig(await response.json());
    }
  } catch (_) {
  }
  return normalizeConfig(DEFAULT_CONFIG);
}

function normalizeConfig(raw) {
  const next = {
    playerOptions: normalizeNumberList(raw?.playerOptions, DEFAULT_CONFIG.playerOptions, 4, 16),
    courtOptions: normalizeNumberList(raw?.courtOptions, DEFAULT_CONFIG.courtOptions, 1, 4),
    pointOptions: normalizeNumberList(raw?.pointOptions, DEFAULT_CONFIG.pointOptions, 16, 24),
    rotationOptions: normalizeNumberList(raw?.rotationOptions, DEFAULT_CONFIG.rotationOptions, 1, 12),
    minutesPerGame: {},
  };

  for (const points of next.pointOptions) {
    const configured = Number(raw?.minutesPerGame?.[points]);
    const defaultMinutes = DEFAULT_CONFIG.minutesPerGame[points] ?? Math.round(10 * (points / 16));
    next.minutesPerGame[points] = Number.isFinite(configured) && configured > 0
      ? configured
      : defaultMinutes;
  }

  return next;
}

function normalizeNumberList(value, fallback, min, max) {
  const source = Array.isArray(value) ? value : fallback;
  const numbers = source
    .map(item => Number(item))
    .filter(item => Number.isInteger(item) && item >= min && item <= max);
  const unique = Array.from(new Set(numbers)).sort((a, b) => a - b);
  return unique.length ? unique : fallback;
}

function applyConfigDefaults() {
  state.numPlayers = pickConfiguredValue(state.numPlayers, config.playerOptions);
  state.courts = pickConfiguredValue(state.courts, config.courtOptions);
  state.pointsPerGame = pickConfiguredValue(state.pointsPerGame, config.pointOptions);
  state.rotations = pickConfiguredValue(state.rotations, config.rotationOptions);
}

function pickConfiguredValue(value, options) {
  return options.includes(value) ? value : options[0];
}

const GAME_STORAGE_KEY = 'ump1re-americano-game-v1';

function persistGameState() {
  try {
    if (!state.built) {
      localStorage.removeItem(GAME_STORAGE_KEY);
      return;
    }
    const snapshot = {
      version: 1,
      numPlayers: state.numPlayers,
      courts: state.courts,
      pointsPerGame: state.pointsPerGame,
      rotations: state.rotations,
      players: state.players,
      schedule: state.schedule,
      fixtures: state.fixtures,
      scores: state.scores,
      drafts: Array.from(state.drafts.entries()),
      pageIndex: state.pageIndex,
      currentRoundIndex: state.currentRoundIndex,
      activeFixtureIndex: state.activeFixtureIndex,
      returnPageIndex: state.returnPageIndex,
      leaderboardView: state.leaderboardView,
      built: state.built,
    };
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (_) {}
}

function restoreGameState() {
  try {
    const raw = localStorage.getItem(GAME_STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || saved.built !== true ||
        !Number.isInteger(saved.numPlayers) ||
        !Array.isArray(saved.players) || saved.players.length !== saved.numPlayers ||
        !Array.isArray(saved.schedule) || !Array.isArray(saved.fixtures) || saved.fixtures.length === 0 ||
        !Array.isArray(saved.scores) || saved.scores.length !== saved.fixtures.length ||
        !saved.fixtures.every(f => f && f.match && Array.isArray(f.match.a) && Array.isArray(f.match.b)) ||
        !saved.scores.every(score => score === null || (score && Number.isFinite(score.scoreA) && Number.isFinite(score.scoreB)))) {
      localStorage.removeItem(GAME_STORAGE_KEY);
      return false;
    }
    Object.assign(state, {
      numPlayers: saved.numPlayers,
      courts: saved.courts,
      pointsPerGame: saved.pointsPerGame,
      rotations: saved.rotations,
      players: saved.players,
      schedule: saved.schedule,
      fixtures: saved.fixtures,
      scores: saved.scores,
      drafts: new Map(Array.isArray(saved.drafts) ? saved.drafts.filter(entry => Array.isArray(entry) && Number.isInteger(entry[0])) : []),
      pageIndex: Number.isInteger(saved.pageIndex) ? saved.pageIndex : 3,
      currentRoundIndex: Number.isInteger(saved.currentRoundIndex) ? saved.currentRoundIndex : 0,
      activeFixtureIndex: Number.isInteger(saved.activeFixtureIndex) ? saved.activeFixtureIndex : null,
      returnPageIndex: Number.isInteger(saved.returnPageIndex) ? saved.returnPageIndex : 3,
      leaderboardView: saved.leaderboardView === 'raw' ? 'raw' : 'adjusted',
      built: true,
    });
    return true;
  } catch (_) {
    return false;
  }
}
function initDefaults() {
  applyConfigDefaults();
  state.players = Array.from({ length: state.numPlayers }, (_, i) => `Player ${i + 1}`);
  restoreGameState();
}

function bindEvents() {
  if (els['leaderboard-btn']) {
    els['leaderboard-btn'].addEventListener('click', openLeaderboard);
  }
  els['leaderboard-close'].addEventListener('click', closeLeaderboard);
  els['skip-modal-close'].addEventListener('click', closeSkipModal);
  els['skip-modal-cancel'].addEventListener('click', closeSkipModal);
  els['skip-modal-confirm'].addEventListener('click', confirmSkipRound);
  els['quit-modal-close'].addEventListener('click', closeQuitModal);
  els['quit-modal-cancel'].addEventListener('click', closeQuitModal);
  els['quit-modal-confirm'].addEventListener('click', confirmQuitSession);

  window.addEventListener('beforeunload', event => {
    if (!state.built) return;
    persistGameState();
    event.preventDefault();
    event.returnValue = '';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') persistGameState();
  });
  window.addEventListener('blur', persistGameState);
  window.addEventListener('pagehide', persistGameState);
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (isQuitModalOpen()) {
      closeQuitModal();
      return;
    }
    if (isSkipModalOpen()) {
      closeSkipModal();
      return;
    }
    if (isLeaderboardOpen()) {
      closeLeaderboard();
    }
  });
}

function isLeaderboardOpen() {
  return els['leaderboard-modal'].classList.contains('open');
}

function isSkipModalOpen() {
  return els['skip-modal'].classList.contains('open');
}

function isQuitModalOpen() {
  return els['quit-modal'].classList.contains('open');
}

function openLeaderboard() {
  state.returnPageIndex = state.pageIndex;
  els['leaderboard-modal'].classList.add('open');
  els['leaderboard-modal'].setAttribute('aria-hidden', 'false');
  renderLeaderboard();
}

function closeLeaderboard() {
  leaderboardComposerActive = false;
  const returnFocus = document.querySelector('[data-action="leaderboard"]');
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  els['leaderboard-modal'].classList.remove('open');
  els['leaderboard-modal'].setAttribute('aria-hidden', 'true');
  clearLeaderboardPreview();
  if (els['leaderboard-actions']) {
    els['leaderboard-actions'].hidden = true;
    els['leaderboard-actions'].innerHTML = '';
  }
  state.pageIndex = state.returnPageIndex;
  render();
  if (returnFocus && !returnFocus.hidden) {
    queueMicrotask(() => returnFocus.focus());
  }
}

function openSkipModal(fixtureIndex) {
  state.pendingSkipRoundIndex = fixtureIndex;
  const fixture = state.fixtures[fixtureIndex];
  if (!fixture) return;
  const teamA = teamLabel(fixture.match.a, ' & ');
  const teamB = teamLabel(fixture.match.b, ' & ');
  els['skip-modal-body'].innerHTML = `
    <div class="notice">
      No score has been selected for this match.
    </div>
    <div class="skip-summary">
      <div><strong>${escapeHtml(fixtureLabel(fixture))}</strong></div>
      <div>${escapeHtml(teamA)} vs ${escapeHtml(teamB)}</div>
      <div class="skip-note">Save as 0-0 and continue?</div>
    </div>
  `;
  els['skip-modal'].classList.add('open');
  els['skip-modal'].setAttribute('aria-hidden', 'false');
}

function closeSkipModal() {
  state.pendingSkipRoundIndex = null;
  els['skip-modal'].classList.remove('open');
  els['skip-modal'].setAttribute('aria-hidden', 'true');
}

function openQuitModal() {
  els['quit-modal-body'].innerHTML = `
    <div class="notice">
      This will end the current session, clear the current tournament state, and return to the home screen.
    </div>
  `;
  els['quit-modal'].classList.add('open');
  els['quit-modal'].setAttribute('aria-hidden', 'false');
}

function closeQuitModal() {
  els['quit-modal'].classList.remove('open');
  els['quit-modal'].setAttribute('aria-hidden', 'true');
}

function confirmQuitSession() {
  closeQuitModal();
  resetTournament();
}

function confirmSkipRound() {
  const fixtureIndex = state.pendingSkipRoundIndex;
  const fixture = state.fixtures[fixtureIndex];
  if (!Number.isInteger(fixtureIndex) || !fixture) {
    closeSkipModal();
    return;
  }

  state.scores[fixtureIndex] = {
    fixtureIndex,
    round: fixture.roundIndex,
    matchIndex: fixture.matchIndex,
    scoreA: 0,
    scoreB: 0,
    skipped: true,
  };
  state.drafts.set(fixtureIndex, { a: 0, b: 0 });
  closeSkipModal();

  if (allFixturesSaved()) {
    openLeaderboard();
    return;
  }

  state.activeFixtureIndex = null;
  render();
}

function resetTournament() {
  state.numPlayers = config.playerOptions[0];
  state.courts = config.courtOptions[0];
  state.pointsPerGame = config.pointOptions[0];
  state.rotations = config.rotationOptions[0];
  state.players = Array.from({ length: state.numPlayers }, (_, i) => `Player ${i + 1}`);
  state.schedule = [];
  state.fixtures = [];
  state.scores = [];
  state.drafts = new Map();
  state.pageIndex = 0;
  state.currentRoundIndex = 0;
  state.activeFixtureIndex = null;
  state.pendingSkipRoundIndex = null;
  state.setupStep = 0;
  state.built = false;
  releaseLeaderboardImage(leaderboardSharePhoto);
  releaseLeaderboardImage(leaderboardClubLogo);
  leaderboardSharePhoto = null;
  leaderboardClubLogo = null;
  clearLeaderboardPreview();
  leaderboardComposerActive = false;
  render();
}

function render() {
  if (isLeaderboardOpen()) {
    renderLeaderboard();
  }

  updateLayoutMode();
  if (els['leaderboard-btn']) {
    els['leaderboard-btn'].hidden = !state.built;
  }
  els['screen-root'].innerHTML = renderPage();
  attachPageHandlers();
  persistGameState();
}

function renderPage() {
  if (state.pageIndex === 0) return renderIntroPage();
  if (state.pageIndex === 1) return renderSetupWizardPage();
  if (state.pageIndex === 2) return renderSetupNamesPage();
  if (!state.built) return renderIntroPage();
  if (state.activeFixtureIndex !== null && state.activeFixtureIndex !== undefined) {
    return renderScorePage(state.activeFixtureIndex);
  }
  return renderRoundOverviewPage(state.currentRoundIndex);
}

function renderCardBrand(variant = 'card') {
  if (variant === 'landing') {
    return `
      <div class="card-brand is-landing" aria-label="Americano">
        <img class="card-brand-logo" src="/assets/logo.png" alt="" aria-hidden="true">
        <div class="card-brand-copy">
          <div class="card-brand-title">Americano</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="card-brand is-card" aria-label="Americano">
      <img class="card-brand-logo" src="/assets/logo.png" alt="" aria-hidden="true">
      <div class="card-brand-copy">
        <div class="card-brand-title">Americano</div>
      </div>
    </div>
  `;
}

function renderQuitButton() {
  return `
    <button class="btn ghost small-cta" type="button" data-action="quit-session" aria-label="Quit session">×</button>
  `;
}

function renderIntroPage() {
  return `
    <section class="screen active">
      ${renderQuitButton()}
      <div class="landing">
        <div class="landing-card">
          ${renderCardBrand('landing')}
        </div>
        <div class="landing-actions">
          <button class="btn primary" data-action="start">Start</button>
        </div>
        <div class="pwa-install-prompt" data-pwa-install hidden>
          <button class="btn secondary pwa-install-button" type="button" data-pwa-install-button>Install app</button>
          <span class="pwa-install-hint" data-pwa-install-hint hidden></span>
          <button class="pwa-install-dismiss" type="button" data-pwa-install-dismiss aria-label="Dismiss install prompt">×</button>
        </div>
      </div>
    </section>
  `;
}

function renderSetupWizardPage() {
  const steps = getSetupSteps();
  const step = steps[state.setupStep] || steps[0];
  const isLastStep = state.setupStep >= steps.length - 1;
  const stepDots = buildSetupStepper(state.setupStep);

  return `
    <section class="screen active">
      ${renderQuitButton()}
      <div class="play-shell">
        <div class="play-card">
          <div class="setup-modal-head">
            ${renderCardBrand()}
            <h2>${escapeHtml(step.title)}</h2>
            <p>${escapeHtml(step.copy)}</p>
            <div class="setup-stepper" aria-label="Setup progress">
              ${stepDots}
            </div>
          </div>
          <div class="play-body setup-body">
            ${step.html}
          </div>
          <div class="screen-actions setup-actions">
            <button class="btn ghost" data-action="back">Back</button>
            <button class="btn primary" data-action="setup-next">
              ${isLastStep ? 'Next: names' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function getSetupSteps() {
  const roundsPerRotation = roundsPerRotationFor(state.numPlayers, state.courts);
  const estimate = estimateTournamentTime();
  return [
    {
      key: 'players',
      title: 'Players',
      copy: 'Choose how many players are joining this Americano.',
      html: `
        <div class="choice-group players-step">
          <div class="choice-grid">
            ${config.playerOptions.map(value => `
              <button class="choice-card ${state.numPlayers === value ? 'active' : ''}" type="button" data-player-choice="${value}">
                <span class="choice-value">${value}</span>
                <span class="choice-sub">players</span>
              </button>
            `).join('')}
          </div>
        </div>
      `,
    },
    {
      key: 'courts',
      title: 'Courts',
      copy: 'Select how many courts can run at the same time.',
      html: `
        <div class="choice-group courts-step">
          <div class="choice-grid">
            ${config.courtOptions.map(value => `
              <button class="choice-card ${state.courts === value ? 'active' : ''}" type="button" data-courts-choice="${value}">
                <span class="choice-value">${value}</span>
                <span class="choice-sub">${value === 1 ? 'court' : 'courts'}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `,
    },
    {
      key: 'points',
      title: 'Points',
      copy: 'Set the fixed total points available in each match.',
      html: `
        <div class="points-step">
          <div class="choice-group">
            <div class="choice-grid">
              ${config.pointOptions.map(value => `
                <button class="choice-card ${state.pointsPerGame === value ? 'active' : ''}" type="button" data-points-choice="${value}">
                  <span class="choice-value">${value}</span>
                  <span class="choice-sub">points</span>
                </button>
              `).join('')}
            </div>
          </div>
          <div class="per-game-estimate">
            <span>Estimated time per game:</span>
            <strong>${escapeHtml(estimate.perGameLabel)}</strong>
          </div>
        </div>
      `,
    },
    {
      key: 'rotations',
      title: 'Rotations',
      copy: 'Choose how many times to cycle through the generated fixtures.',
      html: `
        <div class="rotations-step">
          <div class="choice-group">
            <div class="choice-grid">
              ${config.rotationOptions.map(value => `
                <button class="choice-card ${state.rotations === value ? 'active' : ''}" type="button" data-rotations-choice="${value}">
                  <span class="choice-value">${value}</span>
                  <span class="choice-sub">${roundsPerRotation * value} rounds</span>
                </button>
              `).join('')}
            </div>
          </div>
          <div class="overall-estimate">
            <span>Estimated overall Americano time:</span>
            <strong>${escapeHtml(estimate.totalLabel)}</strong>
          </div>
        </div>
      `,
    },
  ];
}

function renderSetupNamesPage() {
  const players = state.players.map((name, i) => `
    <div class="player-row">
      <div class="player-index">Player ${i + 1}</div>
      <input type="text" maxlength="24" value="${escapeHtml(name)}" data-player-index="${i}" aria-label="Player ${i + 1} name">
    </div>
  `).join('');
  const stepDots = buildSetupStepper(4);

  return `
    <section class="screen active">
      ${renderQuitButton()}
      <div class="play-shell">
        <div class="play-card">
          <div class="setup-modal-head">
            ${renderCardBrand()}
            <div class="setup-kicker">Players</div>
            <h2>Names</h2>
            <div class="setup-stepper" aria-label="Setup progress">
              ${stepDots}
            </div>
          </div>
          <div class="play-body names-body">
            <div class="choice-group">
              <div class="choice-label">Edit all ${state.numPlayers} players</div>
              <div class="player-grid player-grid-two-col">
                ${players}
              </div>
            </div>
          </div>
          <div class="screen-actions names-actions">
            <button class="btn ghost" data-action="back">Back</button>
            <button class="btn primary" data-action="build">Start tournament</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function buildSetupStepper(activeIndex) {
  const labels = [...getSetupSteps().map(step => step.title), 'Names'];
  return labels.map((label, idx) => {
    const interactive = idx < labels.length - 1;
    return `
      <button class="setup-step-dot ${idx === activeIndex ? 'active' : ''}" type="button" ${interactive ? `data-setup-step="${idx}"` : 'disabled'} aria-label="Go to ${escapeHtml(label)}">
      </button>
    `;
  }).join('');
}

function renderScorePage(fixtureIndex) {
  const fixture = state.fixtures[fixtureIndex];
  if (!fixture) return renderIntroPage();
  const draft = getDraft(fixtureIndex);
  const cols = scoreCols(state.pointsPerGame);
  const teamA = teamLabel(fixture.match.a, ' & ');
  const teamB = teamLabel(fixture.match.b, ' & ');
  const roundLabel = fixtureLabel(fixture);
  const scoreA = Number.isInteger(draft.a) ? draft.a : '—';
  const scoreB = Number.isInteger(draft.b) ? draft.b : '—';

  return `
    <section class="screen active score-screen">
      ${renderQuitButton()}
      <div class="play-shell">
        <div class="play-card">
          <div class="play-head">
            ${renderCardBrand()}
            <div class="play-kicker">Scoring</div>
            <h2>${roundLabel}</h2>
          </div>
          <div class="play-body round-grid">
            <div class="card score-card">
              <div class="card-body">
                <div class="score-strip" aria-label="Current score">
                  <span class="score-strip-value a">${scoreA}</span>
                  <span class="score-strip-separator">-</span>
                  <span class="score-strip-value b">${scoreB}</span>
                </div>
                <div class="scoreboard">
                  <div class="score-side a">
                    <div class="head">
                      <div class="tag">${escapeHtml(teamA)}</div>
                    </div>
                    <div class="score-grid" style="--score-cols:${cols};" data-score-grid="a"></div>
                  </div>
                  <div class="score-side b">
                    <div class="head">
                      <div class="tag">${escapeHtml(teamB)}</div>
                    </div>
                    <div class="score-grid" style="--score-cols:${cols};" data-score-grid="b"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="screen-actions score-actions">
            <button class="btn ghost" data-action="back">Back</button>
            <button class="btn primary" data-action="save">Submit score</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderRoundOverviewPage(roundIndex = 0) {
  if (!state.schedule.length) return renderIntroPage();

  const safeRoundIndex = Math.max(0, Math.min(roundIndex, state.schedule.length - 1));
  const round = state.schedule[safeRoundIndex];
  const roundLabel = `Round ${safeRoundIndex + 1}/${state.schedule.length}`;
  const roundFixtures = state.fixtures.filter((fixture) => fixture.roundIndex === safeRoundIndex);
  const fixtureCols = Math.max(1, Math.min(3, roundFixtures.length || 1));
  const sit = round.sitOut.length ? round.sitOut.map(i => state.players[i]).join(', ') : '';
  const isFirstRound = safeRoundIndex === 0;

  const fixtureCards = roundFixtures.map((fixture) => {
    const saved = state.scores[fixture.fixtureIndex];
    const teamA = teamLabel(fixture.match.a, ' & ');
    const teamB = teamLabel(fixture.match.b, ' & ');
    return `
      <button class="schedule-item fixture-card ${saved ? 'completed' : ''}" type="button" data-open-fixture="${fixture.fixtureIndex}">
        <div class="fixture-card-court">Court ${fixture.courtIndex + 1}</div>
        <div class="fixture-card-match">
          <div class="fixture-card-team team-a">${escapeHtml(teamA)}</div>
          <div class="fixture-card-vs">vs</div>
          <div class="fixture-card-team team-b">${escapeHtml(teamB)}</div>
          ${saved ? `
          <div class="fixture-card-score-value a">${saved.scoreA}</div>
          <div class="fixture-card-score-separator">:</div>
          <div class="fixture-card-score-value b">${saved.scoreB}</div>
          ` : ''}
        </div>
        ${saved ? `
        <div class="fixture-card-status">Saved score</div>
        ` : `
        <div class="fixture-card-status">Open scoring</div>
        `}
      </button>
    `;
  }).join('');

  return `
    <section class="screen active round-screen">
      ${renderQuitButton()}
      <div class="play-shell">
        <div class="play-card">
          <div class="play-head">
            ${renderCardBrand()}
            <h2>${escapeHtml(roundLabel)}</h2>
          </div>
          <div class="play-body round-page">
            <div class="schedule-list" style="--fixture-cols:${fixtureCols};">
              ${fixtureCards}
            </div>
            ${sit ? `
            <div class="round-sitout-card">
              <div class="round-sitout-label">Sitting out</div>
              <div class="round-sitout-value">${escapeHtml(sit)}</div>
            </div>
            ` : ''}
            <div class="round-leaderboard-cta">
              <button class="btn secondary" data-action="leaderboard" type="button">Leaderboard</button>
            </div>
          </div>
          <div class="screen-actions round-actions">
            <button class="btn ghost" data-action="${isFirstRound ? 'back' : 'prev-round'}">${isFirstRound ? 'Back' : 'Previous round'}</button>
            <button class="btn primary" data-action="next-round">Next round</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderLeaderboard() {
  if (!state.built || !state.schedule.length) {
    els['leaderboard-body'].innerHTML = `
      <div class="notice">Build a tournament first.</div>
    `;
    els['leaderboard-subtitle'].textContent = 'No results yet';
    return;
  }

  persistGameState();
  const standings = calcAmericanoStandings(state.numPlayers, state.fixtures, state.scores);
  const completed = countSavedFixtures();
  const missed = getMissedFixtures();
  const fairnessAdjusted = completed === state.fixtures.length && standings.some(row => row.bonus > 0);
  const showPointsToggle = fairnessAdjusted;
  if (!showPointsToggle) state.leaderboardView = 'raw';
  const displayedPoints = row => state.leaderboardView === 'raw' ? row.rawPoints : row.points;

  if (leaderboardComposerActive || leaderboardPreviewActive) {
    if (leaderboardPreviewActive) renderLeaderboardSharePreview(standings, fairnessAdjusted);
    else renderLeaderboardComposer(standings, fairnessAdjusted);
    return;
  }

  const missedHtml = missed.length
    ? `
      <div class="missed-fixtures">
        <div class="missed-fixtures-title">Missed fixtures</div>
        <div class="missed-fixtures-list">
          ${missed.map(item => `
            <div class="missed-fixture">
              <div class="missed-fixture-round">${item.roundLabel}</div>
              <div class="missed-fixture-teams">${escapeHtml(item.teamA)} vs ${escapeHtml(item.teamB)}</div>
              <div class="missed-fixture-score">0 - 0</div>
            </div>
          `).join('')}
        </div>
      </div>
    `
    : '';

  els['leaderboard-subtitle'].hidden = false;
  els['leaderboard-subtitle'].textContent = `${completed} / ${state.fixtures.length} matches saved${fairnessAdjusted ? ' · uneven games adjusted with an average-score bonus' : ''}`;
  els['leaderboard-body'].innerHTML = `
    ${missedHtml}
    ${showPointsToggle ? `
      <div class="points-view-toggle" role="group" aria-label="Leaderboard points view">
        <button class="btn ${state.leaderboardView === 'raw' ? 'primary' : 'secondary'}" type="button" data-leaderboard-view="raw">Raw</button>
        <button class="btn ${state.leaderboardView === 'adjusted' ? 'primary' : 'secondary'}" type="button" data-leaderboard-view="adjusted">Adjusted</button>
      </div>
    ` : ''}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Played</th>
            <th>Won</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          ${standings.map((row, idx) => {
            return `
              <tr class="${row.rank === 1 && completed ? 'current-row' : ''}">
                <td class="rank">${row.rank}</td>
                <td>${escapeHtml(state.players[row.playerIdx])}</td>
                <td>${row.played}</td>
                <td>${row.wins}</td>
                <td>${displayedPoints(row)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  bindLeaderboardViewActions();

  if (completed === state.fixtures.length) {
    if (els['leaderboard-actions']) {
      els['leaderboard-actions'].hidden = false;
      els['leaderboard-actions'].innerHTML = `
        <div class="leaderboard-share">
          <button class="btn primary social-create-button" type="button" data-preview-leaderboard>${socialIcon('share')}<span>Create Social Post</span></button>
          <input type="file" accept="image/*" data-share-photo-input hidden>
        </div>
      `;
    }
    bindLeaderboardShareActions(standings);
  } else if (els['leaderboard-actions']) {
    els['leaderboard-actions'].hidden = true;
    els['leaderboard-actions'].innerHTML = '';
  }
}

function openLeaderboardSharePreview(standings) {
  updateLeaderboardShareStatus('Preparing your preview...');
  buildLeaderboardShareImage(standings)
    .then(blob => {
      if (!blob) throw new Error('No share image available');
      clearLeaderboardPreview();
      leaderboardPreviewBlob = blob;
      leaderboardPreviewUrl = URL.createObjectURL(blob);
      leaderboardPreviewActive = true;
      leaderboardComposerActive = true;
      renderLeaderboard();
    })
    .catch(() => updateLeaderboardShareStatus('Unable to prepare the preview right now.'));
}

function clearLeaderboardPreview() {
  leaderboardPreviewActive = false;
  leaderboardPreviewBlob = null;
  if (leaderboardPreviewUrl) {
    URL.revokeObjectURL(leaderboardPreviewUrl);
    leaderboardPreviewUrl = null;
  }
}

function renderLeaderboardSharePreview(standings, fairnessAdjusted) {
  els['leaderboard-subtitle'].hidden = true;
  els['leaderboard-subtitle'].textContent = '';
  els['leaderboard-body'].innerHTML = `
    <div class="leaderboard-image-preview">
      <img src="${leaderboardPreviewUrl}" alt="Preview of the Americano final leaderboard share image" class="social-camera-rendered-image">
    </div>
  `;
  if (!els['leaderboard-actions']) return;
  els['leaderboard-actions'].hidden = false;
  els['leaderboard-actions'].innerHTML = `
    <div class="leaderboard-share">
      <div class="social-action-toolbar social-preview-toolbar">
        <span class="social-labelled-action"><button class="social-icon-btn" type="button" data-preview-back aria-label="Back to standings" title="Back to standings">${socialIcon('back')}</button><span class="social-button-label">Back</span></span>
        <span class="social-labelled-action"><button class="social-icon-btn social-icon-btn-logo" type="button" data-preview-logo aria-label="Add or change club logo" title="Add or change club logo">${socialIcon('logo')}</button><span class="social-button-label">Club logo</span></span>
        <span class="social-labelled-action"><button class="social-icon-btn" type="button" data-preview-replace-photo aria-label="Replace photo" title="Replace photo">${socialIcon('gallery')}</button><span class="social-button-label">Gallery</span></span>
        <span class="social-labelled-action"><button class="social-icon-btn social-icon-btn-primary" type="button" data-preview-share-image aria-label="Share image" title="Share image">${socialIcon('share')}</button><span class="social-button-label">Share</span></span>
        <input type="file" accept="image/*" data-preview-replace-photo-input hidden>
        <input type="file" accept="image/*" data-preview-logo-input hidden>
      </div>
      <div class="leaderboard-share-status" data-share-status aria-live="polite"></div>
    </div>
  `;

  document.querySelector('[data-preview-back]')?.addEventListener('click', () => {
    clearLeaderboardPreview();
    leaderboardComposerActive = false;
    renderLeaderboard();
  });
  const logoInput = document.querySelector('[data-preview-logo-input]');
  document.querySelector('[data-preview-logo]')?.addEventListener('click', () => logoInput?.click());
  logoInput?.addEventListener('change', async event => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const logo = await loadLeaderboardSharePhoto(file, true);
      releaseLeaderboardImage(leaderboardClubLogo);
      leaderboardClubLogo = logo;
      openLeaderboardSharePreview(standings);
    } catch (_) { updateLeaderboardShareStatus('That club logo could not be loaded.'); }
  });
  document.querySelector('[data-preview-replace-photo]')?.addEventListener('click', () => {
    document.querySelector('[data-preview-replace-photo-input]')?.click();
  });
  document.querySelector('[data-preview-replace-photo-input]')?.addEventListener('change', async event => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const nextPhoto = await loadLeaderboardSharePhoto(file, true);
      releaseLeaderboardImage(leaderboardSharePhoto);
      leaderboardSharePhoto = nextPhoto;
      openLeaderboardSharePreview(standings);
    } catch (_) {
      updateLeaderboardShareStatus('That photo could not be loaded. The current preview is unchanged.');
    }
  });
  document.querySelector('[data-preview-share-image]')?.addEventListener('click', () => {
    shareLeaderboardImageBlob(leaderboardPreviewBlob, 'share');
  });
}

function bindLeaderboardViewActions() {
  document.querySelectorAll('[data-leaderboard-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-leaderboard-view');
      if (view !== 'raw' && view !== 'adjusted') return;
      state.leaderboardView = view;
      renderLeaderboard();
    });
  });
}

function renderLeaderboardComposer(standings) {
  const topThree = standings.slice(0, 3);
  els['leaderboard-subtitle'].hidden = true;
  els['leaderboard-subtitle'].textContent = '';
  els['leaderboard-body'].innerHTML = `
    <div class="social-camera-viewfinder">
      <div class="social-camera-shade"></div>
      ${leaderboardClubLogo
        ? `<div class="social-camera-club"><img src="${leaderboardClubLogo._shareObjectUrl}" alt="Club logo"></div>`
        : ''}
      <div class="social-camera-scoreboard">
        <div class="social-camera-winner-title">
          <span>Americano</span>
          <strong>Winner</strong>
        </div>
        <div class="social-camera-scoreboard-head">
          <span>Final standings</span>
          <span>${state.leaderboardView === 'raw' ? 'Raw points' : 'Points'}</span>
        </div>
        ${topThree.map((row) => `
          <div class="social-camera-score-row ${row.rank === 1 ? 'is-winner' : ''}">
            <span class="social-camera-rank">${formatLeaderboardRank(row.rank)}</span>
            <span class="social-camera-player">
              <strong>${escapeHtml(state.players[row.playerIdx])}</strong>
              <small>${row.played} matches · ${row.wins} wins</small>
            </span>
            <strong class="social-camera-points">${state.leaderboardView === 'raw' ? row.rawPoints : row.points}</strong>
          </div>
        `).join('')}
        <div class="social-camera-score-footer">
          <img src="/assets/UMP1RE_Logo.svg" alt="Ump1re">
          <span>Padel. Scored Properly.</span>
        </div>
      </div>
    </div>
  `;
  els['leaderboard-actions'].hidden = false;
  els['leaderboard-actions'].innerHTML = `
    <div class="leaderboard-share">
      <div class="social-action-toolbar">
        <span class="social-labelled-action"><button class="social-icon-btn" type="button" data-camera-library aria-label="Choose from library" title="Choose from library">${socialIcon('gallery')}</button><span class="social-button-label">Gallery</span></span>
        <span class="social-labelled-action"><button class="social-icon-btn" type="button" data-camera-logo aria-label="Add or change club logo" title="Add or change club logo">${socialIcon('logo')}</button><span class="social-button-label">Club logo</span></span>
        <span class="social-labelled-action"><button class="social-icon-btn" type="button" data-camera-cancel aria-label="Cancel" title="Cancel">${socialIcon('close')}</button><span class="social-button-label">Back</span></span>
        <input type="file" accept="image/*" data-camera-library-input hidden>
        <input type="file" accept="image/*" data-camera-logo-input hidden>
      </div>
      <div class="leaderboard-share-status" data-share-status></div>
    </div>
  `;

  document.querySelector('[data-camera-library]')?.addEventListener('click', () => {
    document.querySelector('[data-camera-library-input]')?.click();
  });
  document.querySelector('[data-camera-logo]')?.addEventListener('click', () => document.querySelector('[data-camera-logo-input]')?.click());
  document.querySelector('[data-camera-logo-input]')?.addEventListener('change', async event => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try { const logo = await loadLeaderboardSharePhoto(file, true); releaseLeaderboardImage(leaderboardClubLogo); leaderboardClubLogo = logo; renderLeaderboard(); }
    catch (_) { updateLeaderboardShareStatus('That club logo could not be loaded.'); }
  });
  document.querySelector('[data-camera-library-input]')?.addEventListener('change', async event => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const nextPhoto = await loadLeaderboardSharePhoto(file, true);
      releaseLeaderboardImage(leaderboardSharePhoto);
      leaderboardSharePhoto = nextPhoto;
      renderLeaderboard();
      openLeaderboardSharePreview(standings);
    } catch (_) {
      updateLeaderboardShareStatus('That photo could not be loaded. Try another image.');
    }
  });
  document.querySelector('[data-camera-cancel]')?.addEventListener('click', () => {
    leaderboardComposerActive = false;
    renderLeaderboard();
  });
}

function releaseLeaderboardImage(image) {
  if (image?._shareObjectUrl) {
    URL.revokeObjectURL(image._shareObjectUrl);
    delete image._shareObjectUrl;
  }
}

function bindLeaderboardShareActions(standings) {
  document.querySelector('[data-preview-leaderboard]')?.addEventListener('click', () => {
    leaderboardComposerActive = true;
    if (leaderboardSharePhoto) openLeaderboardSharePreview(standings);
    else renderLeaderboard();
  });
  const photoInput = document.querySelector('[data-share-photo-input]');
  photoInput?.addEventListener('change', async event => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const nextPhoto = await loadLeaderboardSharePhoto(file, true);
      releaseLeaderboardImage(leaderboardSharePhoto);
      leaderboardSharePhoto = nextPhoto;
      leaderboardComposerActive = true;
      openLeaderboardSharePreview(standings);
    } catch (_) { updateLeaderboardShareStatus('That photo could not be loaded. Try another image.'); }
  });
}
function loadLeaderboardSharePhoto(file, keepObjectUrl = false) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (keepObjectUrl) image._shareObjectUrl = objectUrl;
      else URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image could not be loaded'));
    };
    image.src = objectUrl;
  });
}

function socialIcon(name) {
  const paths = {
    camera: '<path d="M14 4h-4l-1.5 2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="12.5" r="3.5"/>',
    gallery: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
    logo: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="M12 8v8m-4-4h8"/>',
    share: '<path d="M12 16V4m0 0 4 4m-4-4-4 4"/><path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3"/>',
    save: '<path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 17v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3"/>',
    back: '<path d="m15 18-6-6 6-6"/><path d="M9 12h12"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
  };
  return `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
}

function updateLeaderboardShareStatus(message) {
  const status = document.querySelector('[data-share-status]');
  if (status) status.textContent = message;
}

async function shareLeaderboardImageBlob(blob, intent = 'share') {
  if (!blob) {
    updateLeaderboardShareStatus('No preview image is available.');
    return;
  }

  const file = new File([blob], 'americano-leaderboard.png', { type: blob.type || 'image/png' });
  try {
    const canShareFiles = navigator.share
      && (!navigator.canShare || navigator.canShare({ files: [file] }));
    if (canShareFiles) {
      await navigator.share({ title: 'Americano leaderboard', files: [file] });
      updateLeaderboardShareStatus(intent === 'save'
        ? 'Choose Save Image (or the equivalent) in the share sheet to add it to your photos.'
        : 'Choose an app in the share sheet to send the finished image.');
      return;
    }

    downloadLeaderboardImage(blob);
    updateLeaderboardShareStatus(intent === 'save'
      ? 'This browser cannot save directly to Photos, so the image was downloaded instead.'
      : 'This browser cannot share images directly, so the image was downloaded instead.');
  } catch (error) {
    updateLeaderboardShareStatus(error?.name === 'AbortError'
      ? 'Share cancelled.'
      : 'Unable to open the share sheet right now.');
  }
}

function downloadLeaderboardImage(blob) {
  if (!blob) {
    updateLeaderboardShareStatus('No preview image is available to download.');
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'americano-leaderboard.png';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  updateLeaderboardShareStatus('Image downloaded.');
}

async function buildLeaderboardShareImage(standings) {
  const width = 1080;
  const height = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const lime = '#d9ff33';
  const ink = '#090b10';
  const rows = standings.slice(0, 3).map(row => ({
    ...row,
    displayPoints: state.leaderboardView === 'raw' ? row.rawPoints : row.points,
  }));

  if (leaderboardSharePhoto) {
    drawImageCover(ctx, leaderboardSharePhoto, 0, 0, width, height);
  } else {
    const fallback = ctx.createLinearGradient(0, 0, width, height);
    fallback.addColorStop(0, '#222a32');
    fallback.addColorStop(1, ink);
    ctx.fillStyle = fallback;
    ctx.fillRect(0, 0, width, height);
  }

  const shade = ctx.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, 'rgba(5,7,10,0.64)');
  shade.addColorStop(0.30, 'rgba(5,7,10,0.08)');
  shade.addColorStop(0.58, 'rgba(5,7,10,0.12)');
  shade.addColorStop(1, 'rgba(5,7,10,0.82)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);

  if (document.fonts?.load) await document.fonts.load('82px TimesSquare');
  const brand = await new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = '/assets/UMP1RE_Logo.svg';
  });
  if (leaderboardClubLogo) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.68)';
    ctx.shadowBlur = 18;
    drawImageContain(ctx, leaderboardClubLogo, 804, 52, 220, 122);
    ctx.restore();
  }

  // The title and top three share one lower-third scoreboard card.
  const panel = { x: 48, y: 790, width: 984, height: 420 };
  ctx.fillStyle = 'rgba(8,10,14,0.93)';
  roundRect(ctx, panel.x, panel.y, panel.width, panel.height, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(217,255,51,0.42)';
  ctx.lineWidth = 2;
  roundRect(ctx, panel.x, panel.y, panel.width, panel.height, 28);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = lime;
  ctx.font = '40px TimesSquare, Inter, system-ui, sans-serif';
  ctx.fillText('AMERICANO', width / 2, 824);
  ctx.fillStyle = '#fff';
  ctx.font = '56px TimesSquare, Inter, system-ui, sans-serif';
  ctx.fillText('WINNER', width / 2, 864);

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(245,247,255,0.64)';
  ctx.font = '800 18px Inter, system-ui, sans-serif';
  ctx.fillText('FINAL STANDINGS', 84, 887);
  ctx.textAlign = 'right';
  ctx.fillText(state.leaderboardView === 'raw' ? 'RAW POINTS' : 'POINTS', 996, 887);
  ctx.textAlign = 'left';

  rows.forEach((row, index) => {
    const rowY = 900 + index * 70;
    const isWinner = row.rank === 1;
    if (isWinner) {
      ctx.fillStyle = lime;
      roundRect(ctx, 70, rowY, 940, 64, 14);
      ctx.fill();
    } else if (index > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(88, rowY - 5);
      ctx.lineTo(992, rowY - 5);
      ctx.stroke();
    }

    const textColor = isWinner ? ink : '#f5f7ff';
    ctx.fillStyle = isWinner ? 'rgba(9,11,16,0.68)' : lime;
    ctx.font = '900 18px Inter, system-ui, sans-serif';
    ctx.fillText(formatLeaderboardRank(row.rank), 96, rowY + 26);
    ctx.fillStyle = textColor;
    ctx.font = '800 32px Inter, system-ui, sans-serif';
    drawCanvasText(ctx, state.players[row.playerIdx], 190, rowY + 30, 530);
    ctx.fillStyle = isWinner ? 'rgba(9,11,16,0.68)' : 'rgba(245,247,255,0.60)';
    ctx.font = '700 18px Inter, system-ui, sans-serif';
    ctx.fillText(`${row.played} MATCHES  ·  ${row.wins} WINS`, 192, rowY + 52);
    ctx.textAlign = 'right';
    ctx.fillStyle = textColor;
    ctx.font = '900 40px Inter, system-ui, sans-serif';
    ctx.fillText(String(row.displayPoints), 968, rowY + 36);
    ctx.fillStyle = isWinner ? 'rgba(9,11,16,0.68)' : 'rgba(245,247,255,0.60)';
    ctx.font = '800 12px Inter, system-ui, sans-serif';
    ctx.fillText('POINTS', 968, rowY + 52);
    ctx.textAlign = 'left';
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(72, 1116);
  ctx.lineTo(1008, 1116);
  ctx.stroke();
  ctx.textBaseline = 'alphabetic';
  if (brand) {
    drawImageContain(ctx, brand, 72, 1132, 170, 40);
  } else {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = '900 23px Inter, system-ui, sans-serif';
    ctx.fillText('UMP1RE', 72, 1170);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(245,247,255,0.72)';
  ctx.font = '700 14px Inter, system-ui, sans-serif';
  ctx.fillText('Padel. Scored Properly.', 1008, 1170);
  ctx.textAlign = 'left';

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

function drawImageContain(ctx, image, x, y, width, height) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawCanvasText(ctx, text, x, y, maxWidth) {
  let content = String(text);
  while (ctx.measureText(content).width > maxWidth && content.length > 1) {
    content = `${content.slice(0, -2)}…`;
  }
  ctx.fillText(content, x, y);
}

function drawImageCover(ctx, image, x, y, width, height, radius = 0) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const frameRatio = width / height;
  const imageRatio = sourceWidth / sourceHeight;
  let cropX = 0;
  let cropY = 0;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;

  if (imageRatio > frameRatio) {
    cropWidth = sourceHeight * frameRatio;
    cropX = (sourceWidth - cropWidth) / 2;
  } else {
    cropHeight = sourceWidth / frameRatio;
    cropY = (sourceHeight - cropHeight) / 2;
  }

  ctx.save();
  if (radius > 0) {
    roundRect(ctx, x, y, width, height, radius);
    ctx.clip();
  }
  ctx.drawImage(image, cropX, cropY, cropWidth, cropHeight, x, y, width, height);
  ctx.restore();
}

const PWA_INSTALL_DISMISSED_KEY = 'ump1re-pwa-install-dismissed';
let deferredPwaInstallPrompt = null;

function isStandalonePwa() {
  return window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
}

function isSafariBrowser() {
  const ua = navigator.userAgent || '';
  return /Safari/i.test(ua) && !/(Chrome|CriOS|Chromium|Edg|OPR|FxiOS|Firefox|DuckDuckGo)/i.test(ua);
}

function canShowPwaInstallFallback() {
  return !isStandalonePwa() && (isSafariBrowser() || /Chrome|Chromium|Edg|OPR|SamsungBrowser/i.test(navigator.userAgent || ''));
}

function updatePwaInstallPrompt() {
  const panel = document.querySelector('[data-pwa-install]');
  if (!panel) return;
  let dismissed = false;
  try { dismissed = sessionStorage.getItem(PWA_INSTALL_DISMISSED_KEY) === '1'; } catch (_) {}
  panel.hidden = isStandalonePwa() || dismissed || (!deferredPwaInstallPrompt && !canShowPwaInstallFallback());
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPwaInstallPrompt = event;
  updatePwaInstallPrompt();
});

window.addEventListener('appinstalled', () => {
  deferredPwaInstallPrompt = null;
  const panel = document.querySelector('[data-pwa-install]');
  if (panel) panel.hidden = true;
});
function attachPageHandlers() {
  const installPanel = document.querySelector('[data-pwa-install]');
  updatePwaInstallPrompt();
  const installButton = document.querySelector('[data-pwa-install-button]');
  const installHint = document.querySelector('[data-pwa-install-hint]');
  installButton?.addEventListener('click', async () => {
    if (!deferredPwaInstallPrompt) {
      if (installHint) {
        const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        installHint.textContent = ios ? 'Share → Add to Home Screen' : isSafariBrowser() ? 'File → Add to Dock' : 'Browser menu → Install app';
        installHint.hidden = false;
      }
      return;
    }
    const promptEvent = deferredPwaInstallPrompt;
    deferredPwaInstallPrompt = null;
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
      if (installPanel) installPanel.hidden = true;
    } catch (_) {
      updatePwaInstallPrompt();
    }
  });
  document.querySelector('[data-pwa-install-dismiss]')?.addEventListener('click', () => {
    try { sessionStorage.setItem(PWA_INSTALL_DISMISSED_KEY, '1'); } catch (_) {}
    if (installPanel) installPanel.hidden = true;
  });

  const startBtn = document.querySelector('[data-action="start"]');
  if (startBtn) startBtn.addEventListener('click', () => {
    state.pageIndex = 1;
    state.setupStep = 0;
    render();
  });

  const backBtn = document.querySelector('[data-action="back"]');
  if (backBtn) backBtn.addEventListener('click', () => {
    if (Number.isInteger(state.activeFixtureIndex)) {
      closeFixture();
      return;
    }
    if (state.pageIndex === 2) {
      state.pageIndex = 1;
      state.setupStep = getSetupSteps().length - 1;
      render();
      return;
    }
    if (state.pageIndex === 1 && state.setupStep > 0) {
      state.setupStep -= 1;
      render();
      return;
    }
    if (state.pageIndex > 0) {
      state.pageIndex -= 1;
      render();
    }
  });

  const leaderboardBtn = document.querySelector('[data-action="leaderboard"]');
  if (leaderboardBtn) leaderboardBtn.addEventListener('click', openLeaderboard);

  const buildBtn = document.querySelector('[data-action="build"]');
  if (buildBtn) buildBtn.addEventListener('click', () => {
    if (state.built && state.fixtures.length) {
      state.pageIndex = 3;
      state.activeFixtureIndex = null;
      render();
      return;
    }
    buildTournament();
  });

  const setupNextBtn = document.querySelector('[data-action="setup-next"]');
  if (setupNextBtn) setupNextBtn.addEventListener('click', () => {
    const lastStep = getSetupSteps().length - 1;
    if (state.setupStep >= lastStep) {
      state.pageIndex = 2;
    } else {
      state.pageIndex = 1;
      state.setupStep += 1;
    }
    render();
  });

  document.querySelectorAll('[data-setup-step]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = Number(btn.dataset.setupStep);
      if (!Number.isInteger(next)) return;
      state.pageIndex = 1;
      state.setupStep = Math.max(0, Math.min(next, getSetupSteps().length - 1));
      render();
    });
  });

  const saveBtn = document.querySelector('[data-action="save"]');
  if (saveBtn) saveBtn.addEventListener('click', saveRound);

  const nextRoundBtn = document.querySelector('[data-action="next-round"]');
  if (nextRoundBtn) nextRoundBtn.addEventListener('click', () => {
    state.activeFixtureIndex = null;
    if (state.currentRoundIndex < state.schedule.length - 1) {
      state.currentRoundIndex += 1;
      render();
      return;
    }
    if (allFixturesSaved()) {
      openLeaderboard();
      return;
    }
    render();
  });

  const prevRoundBtn = document.querySelector('[data-action="prev-round"]');
  if (prevRoundBtn) prevRoundBtn.addEventListener('click', () => {
    state.activeFixtureIndex = null;
    if (state.currentRoundIndex > 0) {
      state.currentRoundIndex -= 1;
      render();
    }
  });

  document.querySelectorAll('input[data-player-index]').forEach(input => {
    input.addEventListener('click', () => {
      if (input.dataset.cleared === 'true') return;
      input.value = '';
      const idx = Number(input.dataset.playerIndex);
      state.players[idx] = '';
      input.dataset.cleared = 'true';
    });
    input.addEventListener('input', () => {
      const idx = Number(input.dataset.playerIndex);
      input.dataset.cleared = 'true';
      state.players[idx] = input.value.trim() || `Player ${idx + 1}`;
    });
  });

  document.querySelectorAll('[data-player-choice]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nextCount = Number(btn.dataset.playerChoice);
      if (nextCount === state.numPlayers) return;
      state.numPlayers = nextCount;
      state.players = Array.from({ length: state.numPlayers }, (_, i) => state.players[i] ?? `Player ${i + 1}`);
      state.schedule = [];
      state.fixtures = [];
      state.scores = [];
      state.drafts = new Map();
      state.built = false;
      state.pageIndex = 1;
      render();
    });
  });

  document.querySelectorAll('[data-courts-choice]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nextCount = Number(btn.dataset.courtsChoice);
      if (nextCount === state.courts) return;
      state.courts = nextCount;
      state.schedule = [];
      state.fixtures = [];
      state.scores = [];
      state.drafts = new Map();
      state.built = false;
      state.pageIndex = 1;
      render();
    });
  });

  document.querySelectorAll('[data-points-choice]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = Number(btn.dataset.pointsChoice);
      if (next === state.pointsPerGame) return;
      state.pointsPerGame = next;
      state.schedule = [];
      state.scores = [];
      state.drafts = new Map();
      state.built = false;
      state.pageIndex = 1;
      render();
    });
  });

  document.querySelectorAll('[data-rotations-choice]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = Number(btn.dataset.rotationsChoice);
      if (next === state.rotations) return;
      state.rotations = next;
      state.schedule = [];
      state.scores = [];
      state.drafts = new Map();
      state.built = false;
      state.pageIndex = 1;
      render();
    });
  });

  document.querySelectorAll('[data-score-grid]').forEach(grid => {
    const side = grid.getAttribute('data-score-grid');
    const fixtureIndex = state.activeFixtureIndex;
    if (!Number.isInteger(fixtureIndex)) return;
    const draft = getDraft(fixtureIndex);
    grid.innerHTML = scoreButtonsHtml(side, draft);
    grid.querySelectorAll('button[data-value]').forEach(btn => {
      btn.addEventListener('click', () => {
        const value = Number(btn.dataset.value);
        setDraftScore(fixtureIndex, side, value);
      });
    });
  });

  document.querySelectorAll('[data-open-fixture]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fixtureIndex = Number(btn.dataset.openFixture);
      if (!Number.isInteger(fixtureIndex)) return;
      openFixture(fixtureIndex);
    });
  });

  document.querySelectorAll('[data-action="quit-session"]').forEach(btn => {
    btn.addEventListener('click', openQuitModal);
  });
}

function buildTournament() {
  state.schedule = buildAmericanoSchedule(state.numPlayers, state.rotations, state.courts);
  state.fixtures = buildFixtureOrder(state.schedule);
  state.scores = Array.from({ length: state.fixtures.length }, () => null);
  state.drafts = new Map();
  state.fixtures.forEach((_, fixtureIdx) => {
    state.drafts.set(fixtureIdx, { a: null, b: null });
  });
  state.built = true;
  state.leaderboardView = 'adjusted';
  state.currentRoundIndex = 0;
  state.activeFixtureIndex = null;
  state.setupStep = 0;
  state.pageIndex = 3;
  render();
}

function saveRound() {
  const fixtureIndex = state.activeFixtureIndex;
  const fixture = state.fixtures[fixtureIndex];
  if (!fixture) return;
  const draft = getDraft(fixtureIndex);
  if (!Number.isInteger(draft.a) || !Number.isInteger(draft.b)) {
    openSkipModal(fixtureIndex);
    return;
  }

  const err = validateScore(draft.a, draft.b, state.pointsPerGame);
  if (err) {
    window.alert(err);
    return;
  }

  state.scores[fixtureIndex] = {
    fixtureIndex,
    round: fixture.roundIndex,
    matchIndex: fixture.matchIndex,
    scoreA: draft.a,
    scoreB: draft.b,
  };

  state.activeFixtureIndex = null;

  if (allFixturesSaved()) {
    openLeaderboard();
    return;
  }

  render();
}

function setDraftScore(fixtureIndex, side, value) {
  const draft = getDraft(fixtureIndex);
  if (side === 'a') {
    draft.a = value;
    draft.b = state.pointsPerGame - value;
  } else {
    draft.b = value;
    draft.a = state.pointsPerGame - value;
  }
  state.drafts.set(fixtureIndex, draft);
  render();
}

function getDraft(fixtureIndex) {
  if (!state.drafts.has(fixtureIndex)) {
    const saved = state.scores[fixtureIndex];
    state.drafts.set(fixtureIndex, saved ? { a: saved.scoreA, b: saved.scoreB } : { a: null, b: null });
  }
  return state.drafts.get(fixtureIndex);
}

function openFixture(fixtureIndex) {
  const fixture = state.fixtures[fixtureIndex];
  if (!fixture) return;
  state.currentRoundIndex = fixture.roundIndex;
  state.activeFixtureIndex = fixtureIndex;
  render();
}

function closeFixture() {
  state.activeFixtureIndex = null;
  render();
}

function scoreButtonsHtml(side, draft) {
  const activeClass = side === 'a' ? 'a' : 'b';
  return Array.from({ length: state.pointsPerGame + 1 }, (_, value) => `
    <button class="score-btn ${draft[side] === value ? `active ${activeClass}` : ''}" type="button" data-value="${value}">${value}</button>
  `).join('');
}

function countSavedFixtures() {
  return state.scores.filter(Boolean).length;
}

function allFixturesSaved() {
  return state.fixtures.length > 0 && countSavedFixtures() === state.fixtures.length;
}

function getMissedFixtures() {
  return state.scores
    .map((entry) => {
      if (!entry || !entry.skipped) return null;
      const fixture = state.fixtures[entry.fixtureIndex];
      if (!fixture) return null;
      return {
        roundLabel: fixtureLabel(fixture),
        teamA: teamLabel(fixture.match.a, ' & '),
        teamB: teamLabel(fixture.match.b, ' & '),
      };
    })
    .filter(Boolean);
}

function buildAmericanoSchedule(numPlayers, rotations, courts = 1) {
  const cycles = Math.max(1, Number(rotations) || 1);
  const maxCourts = Math.max(1, Number(courts) || 1);
  const courtCount = Math.min(maxCourts, Math.floor(numPlayers / 4), 4);
  const base = buildAmericanoRoundSet(numPlayers, courtCount);
  const schedule = [];

  for (let cycle = 0; cycle < cycles; cycle += 1) {
    for (const entry of base) {
      schedule.push(cloneRound(entry));
    }
  }
  return schedule;
}

function baseRoundsForPlayers(numPlayers) {
  if (numPlayers === 4) return FIXED_4.length;
  if (numPlayers === 5) return FIXED_5.length;
  return FIXED_6.length;
}

function roundsPerRotationFor(numPlayers, courts) {
  return buildAmericanoSchedule(numPlayers, 1, courts).length;
}

function estimateTournamentTime() {
  const schedule = buildAmericanoSchedule(state.numPlayers, state.rotations, state.courts);
  const minutesPerRound = gameMinutesForPoints(state.pointsPerGame);
  const totalMinutes = Math.max(1, Math.round(schedule.length * minutesPerRound));
  const roundedMinutesPerRound = Math.max(1, Math.round(minutesPerRound));

  return {
    minutes: totalMinutes,
    perGameLabel: formatMinutes(roundedMinutesPerRound),
    totalLabel: formatMinutes(totalMinutes),
  };
}

function gameMinutesForPoints(points) {
  const configured = Number(config.minutesPerGame[points]);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return 10 * (points / 16);
}

function formatMinutes(minutes) {
  if (minutes < 60) return `~${minutes} mins`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!remainder) return `~${hours} hr${hours === 1 ? '' : 's'}`;
  return `~${hours} hr ${remainder} mins`;
}

function buildAmericanoRoundSet(numPlayers, courtCount) {
  if (numPlayers < 4) return [];

  const pairCount = Math.max(1, courtCount * 2);
  const matchings = buildPartnerMatchings(numPlayers);
  if (!matchings.length) return [];

  const matchingSize = matchings[0].length || 1;
  const blockSize = pairCount / gcd(matchingSize, pairCount);
  const rounds = [];
  const seenPairs = [];

  for (let blockStart = 0; blockStart < matchings.length; blockStart += blockSize) {
    const block = matchings.slice(blockStart, blockStart + blockSize);
    const blockPairs = block.flat();
    const isFinalPartialBlock = blockStart + blockSize >= matchings.length
      && blockPairs.length % pairCount !== 0;

    for (let i = 0; i < blockPairs.length; i += pairCount) {
      const chunk = blockPairs.slice(i, i + pairCount);
      const finalChunk = isFinalPartialBlock && i + pairCount >= blockPairs.length;
      const selected = finalChunk
        ? fillRoundWithRepeatPairs(chunk, pairCount - chunk.length, seenPairs)
        : chunk;
      rounds.push(pairsToRound(selected, numPlayers));
    }

    seenPairs.push(...blockPairs);
  }

  return rounds;
}

function buildPartnerMatchings(numPlayers) {
  const players = Array.from({ length: numPlayers }, (_, index) => index);
  const lineup = numPlayers % 2 === 1 ? [...players, null] : [...players];
  const matchCount = lineup.length - 1;
  const half = lineup.length / 2;
  const matchings = [];
  let current = lineup.slice();

  for (let roundIndex = 0; roundIndex < matchCount; roundIndex += 1) {
    const matches = [];
    for (let i = 0; i < half; i += 1) {
      const a = current[i];
      const b = current[current.length - 1 - i];
      if (a == null || b == null) continue;
      matches.push({ a, b, key: pairKey(a, b) });
    }
    matchings.push(matches);

    const fixed = current[0];
    const rest = current.slice(1);
    rest.unshift(rest.pop());
    current = [fixed, ...rest];
  }

  return matchings;
}

function fillRoundWithRepeatPairs(chunk, needed, seenPairs) {
  if (needed <= 0) return chunk;

  const selected = chunk.slice();
  const blocked = new Set();
  for (const pair of selected) {
    blocked.add(pair.a);
    blocked.add(pair.b);
  }

  for (const pair of seenPairs) {
    if (selected.length >= chunk.length + needed) break;
    if (selected.some(entry => entry.key === pair.key)) continue;
    if (blocked.has(pair.a) || blocked.has(pair.b)) continue;
    selected.push(pair);
    blocked.add(pair.a);
    blocked.add(pair.b);
  }

  return selected;
}

function pairsToRound(pairs, numPlayers) {
  const matches = [];
  const activePlayers = new Set();
  for (let i = 0; i < pairs.length; i += 2) {
    const first = pairs[i];
    const second = pairs[i + 1];
    if (!first || !second) continue;
    activePlayers.add(first.a);
    activePlayers.add(first.b);
    activePlayers.add(second.a);
    activePlayers.add(second.b);
    matches.push({
      a: [first.a, first.b],
      b: [second.a, second.b],
    });
  }
  const sitOut = Array.from({ length: numPlayers }, (_, player) => player)
    .filter(player => !activePlayers.has(player));
  return { matches, sitOut };
}

function cloneRound(round) {
  return {
    matches: (round.matches || []).map(match => ({
      a: [...match.a],
      b: [...match.b],
    })),
    sitOut: [...(round.sitOut || [])],
  };
}

function pairKey(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    [x, y] = [y, x % y];
  }
  return x || 1;
}

function buildFixtureOrder(schedule) {
  const fixtures = [];
  schedule.forEach((round, roundIndex) => {
    (round.matches || []).forEach((match, matchIndex) => {
      fixtures.push({
        fixtureIndex: fixtures.length,
        roundIndex,
        matchIndex,
        courtIndex: matchIndex,
        courtCount: round.matches.length,
        round,
        match,
      });
    });
  });
  return fixtures;
}

function fixtureLabel(fixture) {
  if (!fixture) return 'Fixture';
  const round = fixture.roundIndex + 1;
  const totalRounds = state.schedule.length || 1;
  const court = fixture.courtIndex + 1;
  const totalCourts = fixture.courtCount || 1;
  return `Round ${round}/${totalRounds} · Court ${court}/${totalCourts}`;
}

function formatLeaderboardRank(rank) {
  const suffix = rank % 100 >= 11 && rank % 100 <= 13 ? 'TH' : ({ 1: 'ST', 2: 'ND', 3: 'RD' }[rank % 10] || 'TH');
  return `${rank}${suffix}`;
}

function calcAmericanoStandings(numPlayers, fixtures, scores) {
  const pts = new Array(numPlayers).fill(0);
  const wins = new Array(numPlayers).fill(0);
  const played = new Array(numPlayers).fill(0);

  for (const [fixtureIndex, entry] of scores.entries()) {
    if (!entry) continue;
    const fixture = fixtures[fixtureIndex];
    if (!fixture) continue;
    const match = fixture.match;
    if (!match) continue;

    for (const p of match.a) {
      pts[p] += entry.scoreA;
      played[p] += 1;
      if (entry.scoreA > entry.scoreB) wins[p] += 1;
    }

    for (const p of match.b) {
      pts[p] += entry.scoreB;
      played[p] += 1;
      if (entry.scoreB > entry.scoreA) wins[p] += 1;
    }
  }

  const totalPoints = pts.reduce((sum, value) => sum + value, 0);
  const totalPlayed = played.reduce((sum, value) => sum + value, 0);
  const tournamentComplete = fixtures.length > 0 && scores.filter(Boolean).length === fixtures.length;
  const averageScore = tournamentComplete && totalPlayed > 0
    ? Math.round(totalPoints / totalPlayed)
    : 0;
  const expectedPlayed = tournamentComplete ? Math.max(...played, 0) : 0;

  const ranked = Array.from({ length: numPlayers }, (_, i) => ({
    playerIdx: i,
    points: pts[i] + (
      tournamentComplete && played[i] > 0 && played[i] < expectedPlayed
        ? averageScore
        : 0
    ),
    bonus: tournamentComplete && played[i] > 0 && played[i] < expectedPlayed
      ? averageScore
      : 0,
    rawPoints: pts[i],
    wins: wins[i],
    played: played[i],
  })).sort((a, b) => (
    b.points - a.points ||
    b.played - a.played ||
    b.wins - a.wins ||
    a.playerIdx - b.playerIdx
  ));

  let lastRank = 0;
  return ranked.map((row, index) => {
    if (index === 0 || row.points !== ranked[index - 1].points || row.played !== ranked[index - 1].played) {
      lastRank = index + 1;
    }
    return { ...row, rank: lastRank };
  });
}

function validateScore(scoreA, scoreB, target) {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) return 'Select a score before saving.';
  if (scoreA < 0 || scoreB < 0) return 'Scores cannot be negative.';
  if (scoreA + scoreB !== target) return `The final score must total ${target}.`;
  return null;
}

function updateLayoutMode() {
  const pageMode = state.pageIndex === 0
    ? 'landing'
    : state.pageIndex === 2 && !state.built
      ? 'names'
      : state.pageIndex === 1 && !state.built
      ? 'setup'
      : (state.pageIndex >= 3 && state.built
        ? (Number.isInteger(state.activeFixtureIndex) ? 'match' : 'round')
        : 'setup');
  document.body.classList.remove('require-landscape');
  document.body.dataset.pageMode = pageMode;
  document.body.dataset.points = String(state.pointsPerGame);
}

function scoreCols(pointsPerGame) {
  if (pointsPerGame <= 16) return 4;
  return 3;
}

function calcCoverage(numPlayers, schedule) {
  const seen = new Map();
  for (const round of schedule) {
    for (const match of round.matches || []) {
      for (const pair of [match.a, match.b]) {
        const key = sortedPair(pair[0], pair[1]);
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }
  }

  const totalPairs = numPlayers * (numPlayers - 1) / 2;
  return { totalPairs, uniquePairs: seen.size };
}

function teamLabel(indices, separator = ' / ') {
  return indices.map(i => state.players[i] ?? `Player ${i + 1}`).join(separator);
}

function sortedPair(a, b) {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
