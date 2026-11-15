/**
 * PhysioHead Live - moderator desk (live-moderator.html).
 * Webinar setup, Go live / End, the question queue, chat control and polls.
 */
import { createStore, isDemoMode } from './store.js';
import {
  LIMITS, cleanPoll, parseYouTubeId, sortQuestions, pollPercentages, displayName,
} from './logic.js';
import { el, clear, formatTime, errorMessage } from './dom.js';

const $ = (id) => document.getElementById(id);

const state = {
  store: null,
  webinar: null,
  questions: [],
  pending: [],
  polls: [],
  chat: [],
  setupDirty: false,
  setupFilled: false,
  subscribed: false,
};

let alertTimer = null;
function showAlert(message, sticky = false) {
  const box = $('mod-alert');
  clearTimeout(alertTimer);
  box.textContent = message || '';
  box.hidden = !message;
  if (message && !sticky) alertTimer = setTimeout(() => { box.hidden = true; }, 6000);
}

/** Run a store action; report failures in the alert strip. */
function run(promise, okMessage) {
  return promise
    .then(() => { if (okMessage) showAlert(okMessage); return true; })
    .catch((error) => { showAlert(errorMessage(error)); return false; });
}

const mini = (text, onClick, extra = '') => el('button', {
  type: 'button', class: `live-mini ${extra}`.trim(), text, onClick,
});

// ---- webinar setup ------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
function toLocalInput(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fillSetup() {
  const w = state.webinar || {};
  $('mod-title').value = w.title || '';
  $('mod-starts').value = toLocalInput(w.startsAt);
  $('mod-speakers').value = w.speakers || '';
  $('mod-description').value = w.description || '';
  $('mod-video').value = w.videoId || '';
  state.setupDirty = false;
  state.setupFilled = true;
}

function renderStatus() {
  const w = state.webinar;
  const status = w?.status || 'scheduled';
  const badge = $('mod-badge');
  badge.className = `live-badge is-${status}`;
  badge.textContent = { live: 'Live', scheduled: 'Not live', ended: 'Ended' }[status];

  const hasVideo = !!parseYouTubeId(w?.videoId || '');
  $('mod-go-live').disabled = status === 'live' || !hasVideo;
  $('mod-end').disabled = status !== 'live';
  $('mod-status-hint').textContent = {
    scheduled: hasVideo
      ? 'The audience sees a countdown. Press Go live once the Zoom broadcast is running on YouTube.'
      : 'Save a YouTube live link above before going live.',
    live: 'The audience is watching the broadcast now.',
    ended: 'The audience sees the replay. Q&A and chat are closed. Reset when you are ready to set up the next webinar.',
  }[status];

  $('mod-slow').value = String(w?.chatSlowSeconds || 0);
  $('mod-lock').checked = !!w?.chatLocked;
  if (!state.setupFilled || !state.setupDirty) fillSetup();
}

function bindSetup() {
  const form = $('mod-setup-form');
  form.addEventListener('input', () => { state.setupDirty = true; $('mod-video-error').hidden = true; });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const rawVideo = $('mod-video').value.trim();
    const videoId = rawVideo ? parseYouTubeId(rawVideo) : '';
    if (videoId === null) { $('mod-video-error').hidden = false; $('mod-video').focus(); return; }
    const starts = $('mod-starts').value ? new Date($('mod-starts').value).getTime() : 0;
    run(state.store.saveWebinar({
      title: $('mod-title').value.trim().slice(0, 160),
      startsAt: Number.isFinite(starts) ? starts : 0,
      speakers: $('mod-speakers').value.trim().slice(0, 300),
      description: $('mod-description').value.trim().slice(0, 1500),
      videoId,
    }), 'Webinar details saved.').then((ok) => { if (ok) { state.setupDirty = false; fillSetup(); } });
  });

  $('mod-go-live').addEventListener('click', () => {
    if (state.setupDirty && !window.confirm('You have unsaved changes to the webinar details. Go live with the last saved details?')) return;
    run(state.store.setStatus('live'), 'You are live. The audience now sees the broadcast.');
  });
  $('mod-end').addEventListener('click', () => {
    if (!window.confirm('End the webinar? The audience will see the replay, and Q&A and chat will close.')) return;
    run(state.store.setStatus('ended'), 'Webinar ended.');
  });
  $('mod-reset').addEventListener('click', () => {
    if (!window.confirm('Reset the room? All questions, polls and chat from this webinar will be cleared for the audience. This cannot be undone.')) return;
    run(state.store.resetRoom(), 'Room reset. Set up the next webinar.');
  });
}

// ---- questions ----------------------------------------------------------
function questionRow(q, actions, chip) {
  return el('article', { class: 'live-mod-row' },
    el('div', { class: 'live-mod-row-body' },
      el('p', { class: 'live-question-text', text: q.text }),
      el('p', { class: 'live-byline' },
        el('span', { text: displayName(q.name, q.role) }),
        el('time', { text: formatTime(q.createdAt) }),
        chip)),
    el('div', { class: 'live-mod-row-actions' }, actions));
}

function renderQuestions() {
  const box = clear($('mod-questions'));
  const { open, answered } = sortQuestions(state.questions);
  const group = (title, count) => el('h3', { class: 'live-group', text: `${title} (${count})` });

  box.append(group('Waiting for you', state.pending.length));
  if (!state.pending.length) box.append(el('p', { class: 'live-mod-none', text: 'No questions waiting.' }));
  state.pending.forEach((q) => box.append(questionRow(q, [
    mini('Approve', () => run(state.store.approve(q)), 'is-primary'),
    mini('Reject', () => run(state.store.reject(q))),
  ])));

  box.append(group('Approved', open.length));
  if (!open.length) box.append(el('p', { class: 'live-mod-none', text: 'Approved questions appear here, most upvoted first.' }));
  open.forEach((q) => box.append(questionRow(q, [
    mini('Mark answered', () => run(state.store.markAnswered(q.id, true)), 'is-primary'),
    mini('Remove', () => { if (window.confirm('Remove this question for everyone?')) run(state.store.removeQuestion(q.id)); }),
  ], el('span', { class: 'live-chip is-done', text: `▲ ${q.votes || 0}` }))));

  if (answered.length) {
    box.append(group('Answered', answered.length));
    answered.forEach((q) => box.append(questionRow(q, [
      mini('Reopen', () => run(state.store.markAnswered(q.id, false))),
      mini('Remove', () => { if (window.confirm('Remove this question for everyone?')) run(state.store.removeQuestion(q.id)); }),
    ])));
  }
}

// ---- chat ---------------------------------------------------------------
function renderChat() {
  const box = clear($('mod-chat'));
  if (!state.chat.length) box.append(el('p', { class: 'live-mod-none', text: 'No chat messages yet.' }));
  state.chat.slice().reverse().forEach((m) => {
    box.append(el('article', { class: 'live-mod-row' },
      el('div', { class: 'live-mod-row-body' },
        el('p', { class: 'live-byline' }, el('span', { text: displayName(m.name, m.role) }), el('time', { text: formatTime(m.createdAt) })),
        el('p', { class: 'live-chat-text', text: m.text })),
      el('div', { class: 'live-mod-row-actions' }, mini('Delete', () => run(state.store.deleteChat(m.id))))));
  });
}

function bindChat() {
  const apply = () => run(state.store.setChat({
    locked: $('mod-lock').checked,
    slowSeconds: Number($('mod-slow').value),
  }));
  $('mod-slow').addEventListener('change', apply);
  $('mod-lock').addEventListener('change', apply);
}

// ---- polls --------------------------------------------------------------
function renderPolls() {
  const box = clear($('mod-polls'));
  if (!state.polls.length) box.append(el('p', { class: 'live-mod-none', text: 'No polls yet. Prepare one below, then launch it when the moment comes.' }));
  state.polls.forEach((poll) => {
    const percents = pollPercentages(poll.counts);
    const total = poll.counts.reduce((a, b) => a + (b || 0), 0);
    const actions = [];
    if (poll.status === 'draft') actions.push(mini('Launch', () => run(state.store.setPollStatus(poll.id, 'open')), 'is-primary'));
    if (poll.status === 'open') actions.push(mini('Close', () => run(state.store.setPollStatus(poll.id, 'closed')), 'is-primary'));
    actions.push(mini('Delete', () => { if (window.confirm('Delete this poll and its results?')) run(state.store.deletePoll(poll.id)); }));
    box.append(el('article', { class: `live-poll is-${poll.status}` },
      el('p', { class: 'live-poll-status', text: { draft: 'Draft (not visible)', open: 'Open now', closed: 'Closed' }[poll.status] }),
      el('h3', { class: 'live-poll-question', text: poll.question }),
      el('div', { class: 'live-poll-options' }, poll.options.map((option, i) => {
        const bar = el('span', { class: 'live-poll-bar' });
        bar.style.width = `${percents[i]}%`;
        return el('div', { class: 'live-poll-result' }, bar,
          el('span', { class: 'live-poll-label', text: option }),
          el('span', { class: 'live-poll-percent', text: `${poll.counts[i] || 0} · ${percents[i]}%` }));
      })),
      el('p', { class: 'live-poll-total', text: `${total} ${total === 1 ? 'vote' : 'votes'}` }),
      el('div', { class: 'live-mod-row-actions' }, actions)));
  });
}

function addOptionInput(value = '') {
  const box = $('mod-poll-options');
  if (box.children.length >= LIMITS.pollMax) return;
  const index = box.children.length + 1;
  const input = el('input', { type: 'text', maxlength: String(LIMITS.pollOption), value, 'aria-label': `Option ${index}`, placeholder: `Option ${index}` });
  const row = el('div', { class: 'live-mod-option' }, input,
    mini('Remove', () => { if (box.children.length > LIMITS.pollMin) { row.remove(); syncOptionButtons(); } }));
  box.append(row);
  syncOptionButtons();
}

function syncOptionButtons() {
  const box = $('mod-poll-options');
  $('mod-poll-add').disabled = box.children.length >= LIMITS.pollMax;
  box.querySelectorAll('.live-mini').forEach((b) => { b.disabled = box.children.length <= LIMITS.pollMin; });
}

function bindPolls() {
  addOptionInput();
  addOptionInput();
  $('mod-poll-add').addEventListener('click', () => addOptionInput());
  $('mod-poll-form').addEventListener('input', () => { $('mod-poll-error').hidden = true; });
  $('mod-poll-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const draft = cleanPoll({
      question: $('mod-poll-question').value,
      options: Array.from($('mod-poll-options').querySelectorAll('input')).map((i) => i.value),
    });
    if (!draft) { $('mod-poll-error').hidden = false; return; }
    run(state.store.createPoll(draft), 'Poll saved as a draft. Press Launch to show it to the audience.').then((ok) => {
      if (!ok) return;
      $('mod-poll-question').value = '';
      clear($('mod-poll-options'));
      addOptionInput();
      addOptionInput();
    });
  });
}

// ---- sign-in and start --------------------------------------------------
function subscribe() {
  if (state.subscribed) return;
  state.subscribed = true;
  const { store } = state;
  store.onWebinar((w) => { state.webinar = w; renderStatus(); });
  store.onQuestions((list) => { state.questions = list; renderQuestions(); });
  store.onPending((list) => { state.pending = list; renderQuestions(); });
  store.onPolls((list) => { state.polls = list; renderPolls(); });
  store.onChat((list) => { state.chat = list; renderChat(); });
  store.onPresenceCount((n) => {
    const box = $('mod-presence');
    box.hidden = isDemoMode();
    box.textContent = `${n} connected now`;
  });
  store.onConnection((connected) => {
    if (!connected) showAlert('Connection lost. Reconnecting…', true);
    else if ($('mod-alert').textContent.startsWith('Connection lost')) showAlert('');
  });
}

async function start() {
  const demo = isDemoMode();
  $('mod-preview-note').hidden = !demo;
  if (demo && new URLSearchParams(window.location.search).get('demo') === '1') {
    $('mod-open-live').href = 'live.html?demo=1';
    $('mod-open-speaker').href = 'live-speaker.html?demo=1';
  }
  bindSetup();
  bindChat();
  bindPolls();

  try {
    state.store = await createStore();
    await state.store.ready();
  } catch (error) {
    console.error('PhysioHead Live: could not open the live room', error);
    $('mod-signin').hidden = false;
    $('mod-signin-error').hidden = false;
    $('mod-signin-error').textContent = 'The live room cannot be reached. Check your connection and refresh.';
    return;
  }

  state.store.onModerator((isModerator) => {
    $('mod-signin').hidden = isModerator;
    $('mod-desk').hidden = !isModerator;
    if (isModerator) subscribe();
  });

  $('mod-signin-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const error = $('mod-signin-error');
    error.hidden = true;
    state.store.signIn($('mod-email').value.trim(), $('mod-password').value)
      .then(() => { $('mod-password').value = ''; })
      .catch(() => {
        error.textContent = 'That email and password are not a moderator account.';
        error.hidden = false;
      });
  });
  $('mod-signout').addEventListener('click', () => {
    state.store.signOut().then(() => window.location.reload());
  });
}

start();
