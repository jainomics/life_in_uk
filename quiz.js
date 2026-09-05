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

function show(name) {
  Object.values(screens).forEach((s) => { s.hidden = true; });
  screens[name].hidden = false;
  window.scrollTo(0, 0);
}

/* ---------- running a test ---------- */

function start(which) {
  mode = which;
  const count = which === 'mock' ? Math.min(CONFIG.mockLength, pool.length) : pool.length;
  paper = shuffle(pool).slice(0, count).map(prepare);
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

function finish() {
  if (tick) { clearInterval(tick); tick = null; }

  const right = answers.filter((a) => a.correct).length;
  const needed = Math.ceil(paper.length * CONFIG.passRatio);
  const passed = right >= needed;

  const score = el('score');
  score.textContent = `${right}/${paper.length}`;
  score.className = 'score ' + (passed ? 'score--pass' : 'score--fail');

  el('result-verdict').textContent = passed ? 'Pass' : 'Not a pass yet';
  el('result-detail').textContent = passed
    ? `You needed ${needed} to pass. Keep practising the topics below until they stick.`
    : `You needed ${needed} to pass. The questions you missed are listed below.`;

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
el('btn-home').addEventListener('click', () => show('start'));

el('btn-mock').disabled = true;
el('btn-practice').disabled = true;
loadQuestions();
