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

function initDefaults() {
  applyConfigDefaults();
  state.players = Array.from({ length: state.numPlayers }, (_, i) => `Player ${i + 1}`);
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
  const returnFocus = document.querySelector('[data-action="leaderboard"]');
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  els['leaderboard-modal'].classList.remove('open');
  els['leaderboard-modal'].setAttribute('aria-hidden', 'true');
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

  const standings = calcAmericanoStandings(state.numPlayers, state.fixtures, state.scores);
  const completed = countSavedFixtures();
  const missed = getMissedFixtures();
  const fairnessAdjusted = completed === state.fixtures.length && standings.some(row => row.bonus > 0);
  const showPointsToggle = fairnessAdjusted;
  if (!showPointsToggle) state.leaderboardView = 'raw';
  const displayedPoints = row => state.leaderboardView === 'raw' ? row.rawPoints : row.points;

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
              <tr class="${idx === 0 && completed ? 'current-row' : ''}">
                <td class="rank">${idx + 1}</td>
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
          <div class="leaderboard-share-copy">Share the current Americano standings.</div>
          <div class="leaderboard-share-actions">
            <button class="btn secondary" type="button" data-share-leaderboard="whatsapp">WhatsApp</button>
            <button class="btn secondary" type="button" data-share-leaderboard="instagram">Instagram</button>
          </div>
          <div class="leaderboard-share-status" data-share-status>Choose WhatsApp for text or Instagram for an image.</div>
        </div>
      `;
    }
    bindLeaderboardShareActions(standings);
  } else if (els['leaderboard-actions']) {
    els['leaderboard-actions'].hidden = true;
    els['leaderboard-actions'].innerHTML = '';
  }
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

function bindLeaderboardShareActions(standings) {
  document.querySelectorAll('[data-share-leaderboard]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const target = btn.getAttribute('data-share-leaderboard');
      if (target === 'whatsapp') {
        shareLeaderboardToWhatsApp(standings);
        return;
      }
      if (target === 'instagram') {
        await shareLeaderboardToInstagram(standings);
      }
    });
  });
}

function updateLeaderboardShareStatus(message) {
  const status = document.querySelector('[data-share-status]');
  if (status) status.textContent = message;
}

function buildLeaderboardShareText(standings) {
  const lines = standings.slice(0, 3).map((row, idx) => (
    `${idx + 1}. ${state.players[row.playerIdx]} - Played ${row.played}, Won ${row.wins}, Points ${row.points}`
  ));
  return [
    'Americano top 3',
    ...lines,
  ].join('\n');
}

function shareLeaderboardToWhatsApp(standings) {
  const text = buildLeaderboardShareText(standings);
  updateLeaderboardShareStatus('Opening WhatsApp share...');
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

async function shareLeaderboardToInstagram(standings) {
  updateLeaderboardShareStatus('Preparing Instagram image...');
  try {
    const blob = await buildLeaderboardShareImage(standings);
    if (!blob) throw new Error('No share image available');
    const file = new File([blob], 'americano-leaderboard.png', { type: 'image/png' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'Americano leaderboard',
        files: [file],
      });
      updateLeaderboardShareStatus('Instagram-ready image shared.');
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'americano-leaderboard.png';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    updateLeaderboardShareStatus('Instagram-ready image downloaded.');
  } catch (error) {
    updateLeaderboardShareStatus('Unable to prepare Instagram share right now.');
  }
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
  const muted = 'rgba(245,247,255,0.62)';
  const visibleRows = standings.map((row, index) => ({
    ...row,
    rank: index + 1,
    displayPoints: state.leaderboardView === 'raw' ? row.rawPoints : row.points,
  }));
  const champion = visibleRows[0];
  const remaining = visibleRows.slice(1);
  const displayMode = state.leaderboardView === 'raw' ? 'RAW POINTS' : 'ADJUSTED POINTS';
  const hasAdjustments = visibleRows.some(row => row.bonus > 0);

  // Deep charcoal field with a restrained lime glow and subtle court geometry.
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#10131b');
  background.addColorStop(0.56, ink);
  background.addColorStop(1, '#171b22');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(930, 60, 20, 930, 60, 720);
  glow.addColorStop(0, 'rgba(217,255,51,0.13)');
  glow.addColorStop(1, 'rgba(217,255,51,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 2;
  roundRect(ctx, 36, 36, width - 72, height - 72, 30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(845, 36);
  ctx.lineTo(845, 228);
  ctx.moveTo(36, 132);
  ctx.lineTo(width - 36, 132);
  ctx.stroke();
  ctx.restore();

  // Use the supplied Ump1re wordmark, with a text fallback if it cannot load.
  const logo = await new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = '/assets/UMP1RE_Logo.svg';
  });
  if (logo) {
    ctx.drawImage(logo, 72, 58, 154, 63);
  } else {
    ctx.fillStyle = lime;
    ctx.font = '900 34px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('UMP1RE', 72, 101);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = lime;
  ctx.font = '800 20px Inter, system-ui, sans-serif';
  ctx.fillText('MATCH COMPLETE', 1008, 82);
  ctx.fillStyle = muted;
  ctx.font = '700 17px Inter, system-ui, sans-serif';
  ctx.fillText(`${state.players.length} PLAYERS  ·  ${state.schedule.length} ROUNDS`, 1008, 111);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f5f7ff';
  ctx.font = '900 76px Inter, system-ui, sans-serif';
  ctx.fillText('AMERICANO', 72, 220);
  ctx.fillStyle = muted;
  ctx.font = '600 21px Inter, system-ui, sans-serif';
  ctx.fillText('FINAL STANDINGS', 76, 256);

  // Champion panel.
  const heroX = 72;
  const heroY = 288;
  const heroW = 936;
  const heroH = 224;
  ctx.fillStyle = lime;
  roundRect(ctx, heroX, heroY, heroW, heroH, 28);
  ctx.fill();
  ctx.fillStyle = 'rgba(9,11,16,0.08)';
  ctx.beginPath();
  ctx.arc(910, 334, 145, 0, Math.PI * 2);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(9,11,16,0.66)';
  ctx.font = '900 18px Inter, system-ui, sans-serif';
  ctx.fillText('🏆  AMERICANO CHAMPION', 112, 335);

  ctx.fillStyle = ink;
  ctx.font = '900 58px Inter, system-ui, sans-serif';
  drawCanvasText(ctx, state.players[champion.playerIdx], 112, 409, 590);
  ctx.fillStyle = 'rgba(9,11,16,0.72)';
  ctx.font = '700 18px Inter, system-ui, sans-serif';
  ctx.fillText(`${champion.played} MATCHES  ·  ${champion.wins} WINS`, 116, 459);

  ctx.textAlign = 'right';
  ctx.fillStyle = ink;
  ctx.font = '900 72px Inter, system-ui, sans-serif';
  ctx.fillText(String(champion.displayPoints), 962, 405);
  ctx.fillStyle = 'rgba(9,11,16,0.70)';
  ctx.font = '800 16px Inter, system-ui, sans-serif';
  ctx.fillText('POINTS', 960, 441);

  const tableX = 72;
  const tableW = 936;
  const tableTop = 568;
  const tableBottom = 1240;
  const headerY = 602;
  const rowsTop = 632;
  const rowHeight = remaining.length
    ? Math.min(82, (tableBottom - rowsTop) / remaining.length)
    : 72;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f5f7ff';
  ctx.font = '900 22px Inter, system-ui, sans-serif';
  ctx.fillText('THE LEADERBOARD', tableX, 554);
  ctx.textAlign = 'right';
  ctx.fillStyle = lime;
  ctx.font = '800 15px Inter, system-ui, sans-serif';
  ctx.fillText(displayMode, tableX + tableW, 554);

  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  roundRect(ctx, tableX, tableTop, tableW, tableBottom - tableTop, 22);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.58)';
  ctx.font = '800 15px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('RANK', 96, headerY);
  ctx.fillText('PLAYER', 194, headerY);
  ctx.textAlign = 'right';
  ctx.fillText('PLAYED', 736, headerY);
  ctx.fillText('WON', 844, headerY);
  ctx.fillStyle = lime;
  ctx.fillText('POINTS', 984, headerY);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(96, 616);
  ctx.lineTo(984, 616);
  ctx.stroke();

  remaining.forEach((row, index) => {
    const centerY = rowsTop + (rowHeight * index) + (rowHeight / 2);
    if (index % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      roundRect(ctx, 84, centerY - rowHeight / 2 + 2, tableW - 24, rowHeight - 4, 12);
      ctx.fill();
    }
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#d9ff33';
    ctx.font = '800 19px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(row.rank).padStart(2, '0'), 98, centerY);

    ctx.fillStyle = '#f5f7ff';
    ctx.font = '700 21px Inter, system-ui, sans-serif';
    drawCanvasText(ctx, state.players[row.playerIdx], 194, centerY, 460);

    ctx.fillStyle = 'rgba(245,247,255,0.78)';
    ctx.font = '700 20px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(row.played), 736, centerY);
    ctx.fillText(String(row.wins), 844, centerY);
    ctx.fillStyle = '#f5f7ff';
    ctx.font = '800 21px Inter, system-ui, sans-serif';
    ctx.fillText(String(row.displayPoints), 984, centerY);
    ctx.textBaseline = 'alphabetic';
  });

  if (hasAdjustments) {
    ctx.textAlign = 'left';
    ctx.fillStyle = muted;
    ctx.font = '500 15px Inter, system-ui, sans-serif';
    ctx.fillText(
      state.leaderboardView === 'raw'
        ? 'Raw scores shown · adjusted points account for uneven games played'
        : 'Adjusted points include an average-score bonus for uneven games played',
      76,
      1274
    );
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.moveTo(72, 1296);
  ctx.lineTo(1008, 1296);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(245,247,255,0.54)';
  ctx.font = '700 15px Inter, system-ui, sans-serif';
  ctx.fillText('PADEL. SCORED PROPERLY.', 76, 1325);
  ctx.textAlign = 'right';
  ctx.fillStyle = lime;
  ctx.font = '800 16px Inter, system-ui, sans-serif';
  ctx.fillText('UMP1RE.NET', 1004, 1325);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
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

function attachPageHandlers() {
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

  return Array.from({ length: numPlayers }, (_, i) => ({
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
    b.wins - a.wins ||
    a.playerIdx - b.playerIdx
  ));
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
