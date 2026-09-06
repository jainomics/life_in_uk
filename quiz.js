'use strict';

const CONFIG = {
  mockLength: 24,      // questions in a mock test
  mockMinutes: 45,     // time limit
  passRatio: 0.75      // 18 out of 24
};

const el = (id) => document.getElementById(id);

const screens = {
  start:   el('screen-start'),
  quiz:    el('screen-quiz'),
  results: el('screen-results')
};

let pool = [];        // every question loaded from questions.json
let paper = [];       // the questions in the current test
let index = 0;
let answers = [];     // one entry per question: { chosen, correct }
let mode = 'practice';
let deadline = null;
let tick = null;

/* ---------- storage (best-effort; falls back to in-memory) ---------- */

const STATS_KEY = 'liuk_stats_v1';
const HISTORY_KEY = 'liuk_history_v1';
const HISTORY_LIMIT = 5;
let memoryStats = {};
let memoryHistory = [];

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return memoryHistory;
  }
}

function recordAttempt(entry) {
  const history = [entry, ...loadHistory()].slice(0, HISTORY_LIMIT);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    memoryHistory = history;
  }
}

function loadStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)) || {};
  } catch {
    return memoryStats;
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    memoryStats = stats; // private browsing or storage disabled: keep it for this session only
  }
}

function recordAnswer(id, correct) {
  const stats = loadStats();
  const row = stats[id] || { seen: 0, wrong: 0 };
  row.seen++;
  if (!correct) row.wrong++;
  stats[id] = row;
  saveStats(stats);
}

// Never-seen and often-missed questions get a bigger share of voice when
// building a test, so revision naturally drifts toward weak spots.
function weight(q, stats) {
  const row = stats[q.id];
  if (!row || row.seen === 0) return 3;
  return 1 + 2 * (row.wrong / row.seen);
}

function weightedSample(list, count, stats) {
  const bag = list.map((q) => ({ q, w: weight(q, stats) * Math.random() }));
  bag.sort((a, b) => b.w - a.w);
  return bag.slice(0, count).map((x) => x.q);
}

/* ---------- loading ---------- */

async function loadQuestions() {
  const status = el('load-status');
  try {
    const res = await fetch('questions.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pool = await res.json();
    if (!Array.isArray(pool) || pool.length === 0) throw new Error('empty question bank');

    status.hidden = true;
    el('btn-mock').disabled = false;
    el('btn-practice').disabled = false;

    const n = Math.min(CONFIG.mockLength, pool.length);
    el('mock-note').textContent =
      `${n} questions, ${CONFIG.mockMinutes} minutes, answers at the end`;
    el('practice-note').textContent =
      `${pool.length} questions, no timer, explanation after each one`;

    renderHistory();
  } catch (err) {
    status.className = 'status status--error';
    status.textContent =
      'Questions could not be loaded. If you opened this file directly, run a local ' +
      'web server instead — from the project folder: python3 -m http.server 8000';
    el('btn-mock').disabled = true;
    el('btn-practice').disabled = true;
    console.error(err);
  }
}

/* ---------- helpers ---------- */

function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Shuffle the options too, so positions can't be memorised.
function prepare(q) {
  const options = q.choices.map((text, i) => ({ text, correct: i === q.answer }));
  return { ...q, options: shuffle(options) };
}

function renderHistory() {
  const box = el('history');
  const entries = loadHistory();

  if (entries.length === 0) {
    box.hidden = true;
    return;
  }
  box.hidden = false;

  const list = el('history-list');
  list.textContent = '';
  entries.forEach((e) => {
    const li = document.createElement('li');
    li.className = 'history__row';

    const when = document.createElement('span');
    when.className = 'history__when';
    when.textContent = new Date(e.date).toLocaleDateString(undefined, {
      day: 'numeric', month: 'short'
    });

    const kind = document.createElement('span');
    kind.className = 'history__mode';
    kind.textContent = e.mode === 'mock' ? 'Mock test' : 'Practice';

    const score = document.createElement('span');
    score.className = 'history__score ' + (e.mode === 'mock'
      ? (e.passed ? 'history__score--pass' : 'history__score--fail')
      : '');
    score.textContent = `${e.right}/${e.total}`;

    li.append(when, kind, score);
    list.appendChild(li);
  });
}

function show(name) {
  Object.values(screens).forEach((s) => { s.hidden = true; });
  screens[name].hidden = false;
  window.scrollTo(0, 0);
}

/* ---------- running a test ---------- */

function start(which) {
  mode = which;
  const count = which === 'mock' ? Math.min(CONFIG.mockLength, pool.length) : pool.length;
  const stats = loadStats();
  // Weighted pick decides WHICH questions (biased to weak spots), then a plain
  // shuffle decides the ORDER, so the hardest ones aren't all bunched together.
  const chosen = weightedSample(pool, count, stats);
  paper = shuffle(chosen).map(prepare);
  index = 0;
  answers = [];

  if (which === 'mock') {
    deadline = Date.now() + CONFIG.mockMinutes * 60 * 1000;
    el('timer').hidden = false;
    tick = setInterval(updateTimer, 1000);
    updateTimer();
  } else {
    deadline = null;
    el('timer').hidden = true;
  }

  show('quiz');
  render();
}

function updateTimer() {
  const left = Math.max(0, deadline - Date.now());
  const mins = Math.floor(left / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  const timer = el('timer');
  timer.textContent = `${mins}:${String(secs).padStart(2, '0')} left`;
  timer.classList.toggle('bar__timer--low', left < 5 * 60 * 1000);
  if (left === 0) finish();
}

function render() {
  const q = paper[index];

  el('counter').textContent = `Question ${index + 1} of ${paper.length}`;
  el('progress').style.width = `${(index / paper.length) * 100}%`;
  el('category').textContent = q.category || '';
  el('question').textContent = q.question;

  const box = el('choices');
  box.textContent = '';
  q.options.forEach((opt, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn choice';
    b.textContent = opt.text;
    b.addEventListener('click', () => answer(i));
    box.appendChild(b);
  });

  el('feedback').hidden = true;
  el('btn-next').hidden = true;
}

function answer(chosen) {
  const q = paper[index];
  const correct = q.options[chosen].correct;
  answers.push({ chosen, correct });
  recordAnswer(q.id, correct);

  const buttons = el('choices').querySelectorAll('button');
  buttons.forEach((b) => { b.disabled = true; });

  if (mode === 'practice') {
    buttons.forEach((b, i) => {
      if (q.options[i].correct) b.classList.add('choice--right');
      else if (i === chosen) b.classList.add('choice--wrong');
    });

    const verdict = el('verdict');
    verdict.textContent = correct ? 'Correct' : 'Not quite';
    verdict.className = 'feedback__verdict ' +
      (correct ? 'feedback__verdict--right' : 'feedback__verdict--wrong');
    el('explanation').textContent = q.explanation || '';
    el('feedback').hidden = false;

    const next = el('btn-next');
    next.textContent = index + 1 < paper.length ? 'Next question' : 'See your result';
    next.hidden = false;
    next.focus();
  } else {
    advance();
  }
}

function advance() {
  index++;
  if (index < paper.length) render();
  else finish();
}

function renderCategoryBreakdown() {
  const box = el('category-breakdown');
  const tally = new Map(); // category -> { right, total }

  paper.forEach((q, i) => {
    const cat = q.category || 'General';
    const row = tally.get(cat) || { right: 0, total: 0 };
    row.total++;
    if (answers[i] && answers[i].correct) row.right++;
    tally.set(cat, row);
  });

  box.textContent = '';
  // Weakest topics first, so the person sees what to revise without hunting for it.
  const rows = [...tally.entries()].sort((a, b) => (a[1].right / a[1].total) - (b[1].right / b[1].total));

  rows.forEach(([cat, { right, total }]) => {
    const row = document.createElement('div');
    row.className = 'cat-row';

    const label = document.createElement('span');
    label.className = 'cat-row__label';
    label.textContent = cat;

    const bar = document.createElement('span');
    bar.className = 'cat-row__bar';
    const fill = document.createElement('span');
    fill.className = 'cat-row__fill';
    fill.style.width = `${(right / total) * 100}%`;
    if (right / total < 0.5) fill.classList.add('cat-row__fill--weak');
    bar.appendChild(fill);

    const count = document.createElement('span');
    count.className = 'cat-row__count';
    count.textContent = `${right}/${total}`;

    row.append(label, bar, count);
    box.appendChild(row);
  });
}

function finish() {
  if (tick) { clearInterval(tick); tick = null; }

  const right = answers.filter((a) => a.correct).length;
  const needed = Math.ceil(paper.length * CONFIG.passRatio);
  const passed = right >= needed;

  recordAttempt({ date: Date.now(), mode, right, total: paper.length, passed });

  const score = el('score');
  score.textContent = `${right}/${paper.length}`;
  score.className = 'score ' + (passed ? 'score--pass' : 'score--fail');

  el('result-verdict').textContent = passed ? 'Pass' : 'Not a pass yet';
  el('result-detail').textContent = passed
    ? `You needed ${needed} to pass. Keep practising the topics below until they stick.`
    : `You needed ${needed} to pass. The questions you missed are listed below.`;

  renderCategoryBreakdown();

  const list = el('review');
  list.textContent = '';
  const missed = paper.filter((_, i) => answers[i] && !answers[i].correct);

  el('review-heading').hidden = missed.length === 0;
  missed.forEach((q) => {
    const right = q.options.find((o) => o.correct).text;

    const li = document.createElement('li');
    const qp = document.createElement('p');
    qp.className = 'review__q';
    qp.textContent = q.question;

    const ap = document.createElement('p');
    ap.className = 'review__a';
    const strong = document.createElement('b');
    strong.textContent = right;
    ap.append('Answer: ', strong, '. ', q.explanation || '');

    li.append(qp, ap);
    list.appendChild(li);
  });

  show('results');
}

/* ---------- wiring ---------- */

el('btn-mock').addEventListener('click', () => start('mock'));
el('btn-practice').addEventListener('click', () => start('practice'));
el('btn-next').addEventListener('click', advance);
el('btn-quit').addEventListener('click', finish);
el('btn-again').addEventListener('click', () => start(mode));
el('btn-home').addEventListener('click', () => { renderHistory(); show('start'); });

el('btn-mock').disabled = true;
el('btn-practice').disabled = true;
loadQuestions();
