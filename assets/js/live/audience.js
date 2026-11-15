/**
 * PhysioHead Live - audience page (live.html).
 * Shows the broadcast and lets visitors ask questions, vote in polls and chat.
 */
import { createStore, isDemoMode } from './store.js';
import { firebaseConfig } from './config.js';
import { mountPlayer } from './player.js';
import {
  LIMITS, cleanText, sortQuestions, pollPercentages, countdownParts, displayName,
} from './logic.js';
import {
  el, clear, formatTime, formatDateTime, errorMessage, setupTabs,
} from './dom.js';

const $ = (id) => document.getElementById(id);
const PROFILE_KEY = 'physiohead-live-profile';
const WEBINAR_CACHE_KEY = 'physiohead-live-webinar';

/**
 * Run `fn` at most once per `gap` ms. With 900 people voting, updates arrive
 * many times a second; redrawing each time would make buttons jump under the
 * visitor's finger.
 */
function throttled(fn, gap = 600) {
  let timer = null;
  let last = 0;
  return () => {
    if (timer) return;
    timer = setTimeout(() => { timer = null; last = Date.now(); fn(); }, Math.max(0, gap - (Date.now() - last)));
  };
}

/** Redraw a list while keeping keyboard focus on the same item. */
function keepingFocus(box, draw) {
  const key = box.contains(document.activeElement) ? document.activeElement.dataset.key : null;
  draw();
  if (key) Array.from(box.querySelectorAll('[data-key]')).find((n) => n.dataset.key === key)?.focus();
}

const state = {
  store: null,
  uid: null,
  webinar: undefined,
  questions: [],
  pending: [],
  myVotes: new Set(),
  polls: [],
  myPollVotes: new Map(),
  chat: [],
  profile: null,
  afterProfile: null,
  activeTab: 'live-tab-qa',
  connected: true,
  readOnly: false,
  fellBack: false,
  questionsDrawn: '',
  pollsDrawn: '',
  playerKey: '',
  player: null,
};

// ---- profile ------------------------------------------------------------
function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    const name = cleanText(saved?.name, LIMITS.name);
    if (name) return { name, role: cleanText(saved.role, LIMITS.role) || '' };
  } catch { /* storage blocked: ask again each visit */ }
  return null;
}

function saveProfile(profile) {
  state.profile = profile;
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* fine */ }
  renderIdentity();
}

function renderIdentity() {
  const box = $('live-identity');
  clear(box);
  if (!state.profile) { box.hidden = true; return; }
  box.hidden = false;
  box.append(
    'Taking part as ',
    el('strong', { text: displayName(state.profile.name, state.profile.role) }),
    ' ',
    el('button', { type: 'button', class: 'live-link', text: 'Change', onClick: () => openProfile(null) }),
  );
}

function openProfile(then) {
  state.afterProfile = then;
  const form = $('live-profile-form');
  $('live-profile-name').value = state.profile?.name || '';
  $('live-profile-role').value = state.profile?.role || '';
  $('live-profile-error').hidden = true;
  form.hidden = false;
  $('live-profile-name').focus();
}

function closeProfile() {
  $('live-profile-form').hidden = true;
  state.afterProfile = null;
}

/** Run `action(profile)` now, or after the visitor has introduced themselves. */
function withProfile(action) {
  if (state.profile) action(state.profile);
  else openProfile(action);
}

// ---- stage (video area) -------------------------------------------------
let countdownTimer = null;

function frameMessage(kicker, text, extra) {
  const box = el('div', { class: 'live-frame-message' },
    el('p', { class: 'live-frame-kicker', text: kicker }),
    el('p', { class: 'live-frame-text', text }),
    extra);
  $('live-frame').replaceChildren(box);
}

function renderCountdown(webinar) {
  const tick = () => {
    const remaining = (webinar.startsAt || 0) - Date.now();
    if (!webinar.startsAt || remaining <= 0) {
      frameMessage('PhysioHead Webinars', 'The webinar will start shortly.',
        el('p', { class: 'live-frame-sub', text: 'Stay on this page. The broadcast appears here automatically.' }));
      return;
    }
    const parts = countdownParts(remaining);
    const cell = (value, label) => el('div', { class: 'live-count-cell' },
      el('span', { class: 'live-count-value', text: String(value).padStart(2, '0') }),
      el('span', { class: 'live-count-label', text: label }));
    frameMessage('Starting in', '', el('div', { class: 'live-count', role: 'timer' },
      parts.days > 0 ? cell(parts.days, 'days') : null,
      cell(parts.hours, 'hours'), cell(parts.minutes, 'min'), cell(parts.seconds, 'sec')));
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function renderStage() {
  const webinar = state.webinar;
  const badge = $('live-badge');
  const key = webinar ? `${webinar.status}|${webinar.videoId}|${webinar.startsAt}` : 'none';

  $('live-title').textContent = webinar?.title || 'PhysioHead Live';
  document.title = webinar?.title ? `${webinar.title} | PhysioHead Live` : 'Live Webinar | PhysioHead';

  const info = $('live-info');
  info.hidden = !webinar;
  if (webinar) {
    $('live-info-meta').textContent = formatDateTime(webinar.startsAt);
    $('live-info-speakers').textContent = webinar.speakers ? `Speakers: ${webinar.speakers}` : '';
    $('live-info-description').textContent = webinar.description || '';
  }

  badge.hidden = !webinar;
  badge.className = `live-badge is-${webinar?.status || 'none'}`;
  badge.textContent = { live: 'Live', scheduled: 'Upcoming', ended: 'Replay' }[webinar?.status] || '';

  if (key === state.playerKey) return; // do not restart the video for unrelated updates
  state.playerKey = key;
  clearInterval(countdownTimer);
  state.player?.destroy();
  state.player = null;
  $('live-sound-note').hidden = true;

  if (!webinar) {
    frameMessage('PhysioHead Webinars', 'No live webinar is planned right now.',
      el('a', { class: 'button secondary live-frame-button', href: 'activities.html#webinars', text: 'Browse past webinars' }));
  } else if (webinar.status === 'scheduled') {
    renderCountdown(webinar);
  } else if (webinar.videoId) {
    const autoplay = webinar.status === 'live';
    state.player = mountPlayer($('live-frame'), { videoId: webinar.videoId, title: webinar.title, autoplay });
    $('live-sound-note').hidden = !autoplay;
  } else {
    frameMessage('PhysioHead Webinars', webinar.status === 'ended'
      ? 'This webinar has ended. The replay will appear here soon.'
      : 'The broadcast is being connected.');
  }
  renderComposers();
}

// ---- Q&A ----------------------------------------------------------------
function questionCard(q, { pending = false } = {}) {
  const voted = state.myVotes.has(q.id);
  const canVote = !pending && !q.answered && state.webinar?.status !== 'ended';
  return el('article', { class: `live-question${q.answered ? ' is-answered' : ''}${pending ? ' is-pending' : ''}` },
    pending ? null : el('button', {
      type: 'button',
      class: `live-vote${voted ? ' is-voted' : ''}`,
      dataset: { key: `q:${q.id}` },
      disabled: !canVote || voted || state.readOnly,
      'aria-label': voted ? `You upvoted this question. ${q.votes} votes` : `Upvote this question. ${q.votes} votes`,
      onClick: (e) => {
        e.currentTarget.disabled = true;
        state.store.upvote(q.id).catch(() => { renderQuestions(true); });
      },
    }, el('span', { class: 'live-vote-arrow', 'aria-hidden': 'true', text: '▲' }), el('span', { text: String(q.votes || 0) })),
    el('div', { class: 'live-question-body' },
      el('p', { class: 'live-question-text', text: q.text }),
      el('p', { class: 'live-byline' },
        el('span', { text: displayName(q.name, q.role) }),
        pending ? el('span', { class: 'live-chip is-wait', text: 'Awaiting moderator' }) : null,
        q.answered ? el('span', { class: 'live-chip is-done', text: 'Answered' }) : null)));
}

function renderQuestions(force = false) {
  const box = $('live-questions');
  const { open, answered } = sortQuestions(state.questions);
  // Redraw only when something a visitor can see has changed.
  const drawn = JSON.stringify([
    state.pending.map((q) => q.id), open.map((q) => [q.id, q.votes]), answered.map((q) => q.id),
    [...state.myVotes], state.webinar?.status, state.readOnly,
  ]);
  if (!force && drawn === state.questionsDrawn) return;
  state.questionsDrawn = drawn;
  keepingFocus(box, () => {
    clear(box);
    if (!state.pending.length && !open.length && !answered.length) {
      box.append(el('p', { class: 'live-empty', text: 'No questions yet. Be the first to ask.' }));
    }
    state.pending.forEach((q) => box.append(questionCard(q, { pending: true })));
    open.forEach((q) => box.append(questionCard(q)));
    if (answered.length) {
      box.append(el('h3', { class: 'live-group', text: 'Answered' }));
      answered.forEach((q) => box.append(questionCard(q)));
    }
  });
  const count = $('live-count-qa');
  count.hidden = !open.length;
  count.textContent = String(open.length);
}

// ---- polls --------------------------------------------------------------
function pollCard(poll) {
  const mine = state.myPollVotes.get(poll.id);
  const hasVoted = mine !== undefined;
  const showResults = hasVoted || poll.status === 'closed';
  const total = poll.counts.reduce((a, b) => a + (b || 0), 0);
  const percents = pollPercentages(poll.counts);

  const options = poll.options.map((option, index) => {
    if (showResults) {
      const bar = el('span', { class: 'live-poll-bar' });
      bar.style.width = `${percents[index]}%`;
      return el('div', { class: `live-poll-result${mine === index ? ' is-mine' : ''}` },
        bar,
        el('span', { class: 'live-poll-label', text: option }),
        el('span', { class: 'live-poll-percent', text: `${percents[index]}%` }));
    }
    return el('button', {
      type: 'button',
      class: 'live-poll-option',
      dataset: { key: `p:${poll.id}:${index}` },
      disabled: state.readOnly,
      text: option,
      onClick: (e) => {
        e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        state.store.votePoll(poll.id, index).catch((error) => {
          showAlert(errorMessage(error));
          renderPolls(true);
        });
      },
    });
  });

  return el('article', { class: `live-poll is-${poll.status}` },
    el('p', { class: 'live-poll-status', text: poll.status === 'open' ? 'Poll open' : 'Poll closed' }),
    el('h3', { class: 'live-poll-question', text: poll.question }),
    el('div', { class: 'live-poll-options' }, options),
    showResults ? el('p', { class: 'live-poll-total', text: `${total} ${total === 1 ? 'vote' : 'votes'}` }) : null);
}

function renderPolls(force = false) {
  const box = $('live-polls');
  const visible = state.polls.filter((p) => p.status !== 'draft');
  // Counts only matter once this visitor can see results, so other people's
  // votes do not redraw a poll that is still showing its buttons.
  const drawn = JSON.stringify([visible.map((p) => {
    const mine = state.myPollVotes.get(p.id);
    return [p.id, p.status, mine, (mine !== undefined || p.status === 'closed') ? p.counts : null];
  }), state.readOnly]);
  if (force || drawn !== state.pollsDrawn) {
    state.pollsDrawn = drawn;
    keepingFocus(box, () => {
      clear(box);
      if (!visible.length) {
        box.append(el('p', { class: 'live-empty', text: 'Polls from the moderators will appear here during the webinar.' }));
      }
      visible.forEach((poll) => box.append(pollCard(poll)));
    });
  }
  const waiting = visible.some((p) => p.status === 'open' && !state.myPollVotes.has(p.id));
  $('live-dot-polls').hidden = !waiting || state.activeTab === 'live-tab-polls';
}

// ---- chat ---------------------------------------------------------------
function chatNode(m) {
  return el('div', { class: `live-chat-message${m.uid === state.uid ? ' is-mine' : ''}`, dataset: { id: m.id } },
    el('p', { class: 'live-byline' },
      el('span', { text: displayName(m.name, m.role) }),
      el('time', { text: formatTime(m.createdAt) })),
    el('p', { class: 'live-chat-text', text: m.text }));
}

/** Add new messages and drop deleted ones, leaving the rest untouched. */
function renderChat() {
  const box = $('live-chat');
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  const wanted = new Set(state.chat.map((m) => m.id));
  Array.from(box.children).forEach((node) => { if (!wanted.has(node.dataset.id)) node.remove(); });
  if (!state.chat.length) {
    box.append(el('p', { class: 'live-empty', text: 'Say hello to colleagues from around the world.' }));
  }
  state.chat.forEach((m, i) => {
    const current = box.children[i];
    if (current?.dataset.id !== m.id) box.insertBefore(chatNode(m), current || null);
  });
  if (nearBottom) box.scrollTop = box.scrollHeight;
}

// ---- composers and alerts -----------------------------------------------
let alertTimer = null;
function showAlert(message, sticky = false) {
  const box = $('live-alert');
  clearTimeout(alertTimer);
  box.textContent = message || '';
  box.hidden = !message;
  if (message && !sticky) alertTimer = setTimeout(() => { box.hidden = true; }, 6000);
}

function renderComposers() {
  const webinar = state.webinar;
  const ended = !webinar || webinar.status === 'ended' || state.readOnly;
  const offline = !state.connected;

  const qInput = $('live-question-input');
  const qForm = $('live-question-form');
  qForm.hidden = ended;
  qInput.disabled = offline;
  qForm.querySelector('button').disabled = offline;

  const cForm = $('live-chat-form');
  const cInput = $('live-chat-input');
  const locked = !!webinar?.chatLocked;
  cForm.hidden = ended;
  cInput.disabled = offline || locked;
  cForm.querySelector('button').disabled = offline || locked;
  const slow = webinar?.chatSlowSeconds || 0;
  $('live-chat-hint').textContent = locked
    ? 'Chat is paused by the moderators.'
    : slow ? `Slow mode: one message every ${slow} seconds.` : '';
}

function bindForms() {
  $('live-question-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $('live-question-input');
    const text = cleanText(input.value, LIMITS.question);
    if (!text) { showAlert(errorMessage({ code: 'invalid' }, LIMITS.question)); return; }
    withProfile((profile) => {
      state.store.submitQuestion({ text, ...profile })
        .then(() => {
          input.value = '';
          showAlert('Thank you. Your question is waiting for a moderator.');
        })
        .catch((error) => showAlert(errorMessage(error, LIMITS.question)));
    });
  });
  $('live-question-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) $('live-question-form').requestSubmit();
  });

  $('live-chat-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = $('live-chat-input');
    const text = cleanText(input.value, LIMITS.chat);
    if (!text) { showAlert(errorMessage({ code: 'invalid' }, LIMITS.chat)); return; }
    withProfile((profile) => {
      state.store.sendChat({ text, ...profile })
        .then(() => {
          input.value = '';
          const box = $('live-chat');
          box.scrollTop = box.scrollHeight;
        })
        .catch((error) => showAlert(error.code === 'locked' ? 'Chat is paused by the moderators.' : errorMessage(error, LIMITS.chat)));
    });
  });

  $('live-profile-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = cleanText($('live-profile-name').value, LIMITS.name);
    const roleRaw = $('live-profile-role').value.trim();
    const role = roleRaw ? cleanText(roleRaw, LIMITS.role) : '';
    if (!name || role === null) { $('live-profile-error').hidden = false; return; }
    const then = state.afterProfile;
    saveProfile({ name, role });
    closeProfile();
    if (then) then(state.profile);
  });
  $('live-profile-cancel').addEventListener('click', closeProfile);
}

// ---- start --------------------------------------------------------------
/** A short technical reason, shown in small print so a problem can be reported. */
function reasonOf(error) {
  return String(error?.code || error?.message || error || 'unknown').slice(0, 120);
}

function unavailable(reason) {
  showAlert(`Q&A is temporarily unavailable. The video is not affected.${reason ? ` (${reason})` : ''}`, true);
}

function rememberWebinar(webinar) {
  try {
    if (webinar) localStorage.setItem(WEBINAR_CACHE_KEY, JSON.stringify(webinar));
    else localStorage.removeItem(WEBINAR_CACHE_KEY);
  } catch { /* fine */ }
}

/**
 * The live room cannot be reached. Find the webinar another way so the video
 * still plays: ask the database directly (public, no sign-in), and failing
 * that use what this browser saw last time.
 */
async function showFallbackWebinar(reason) {
  let webinar = null;
  if (firebaseConfig?.databaseURL && !isDemoMode()) {
    try {
      const response = await fetch(`${firebaseConfig.databaseURL.replace(/\/$/, '')}/webinar.json`, { signal: AbortSignal.timeout(6000) });
      if (response.ok) webinar = await response.json();
    } catch { /* try the cache */ }
  }
  if (!webinar) {
    try { webinar = JSON.parse(localStorage.getItem(WEBINAR_CACHE_KEY) || 'null'); } catch { /* none */ }
  }
  if (state.webinar !== undefined) return; // the room answered in the meantime
  state.readOnly = true;
  state.fellBack = true;
  if (webinar && typeof webinar === 'object') {
    state.webinar = webinar;
    renderStage();
  } else {
    frameMessage('PhysioHead Webinars', 'We cannot reach the live room right now.',
      el('p', { class: 'live-frame-sub', text: 'Please refresh the page in a moment.' }));
  }
  showAlert(`Q&A is temporarily unavailable. Please refresh the page in a moment.${reason ? ` (${reason})` : ''}`, true);
  renderComposers();
  renderQuestions(true);
  renderPolls(true);
}

async function start() {
  state.profile = loadProfile();
  renderIdentity();
  bindForms();
  setupTabs(document.querySelector('.live-tabs'), (tab) => {
    state.activeTab = tab.id;
    if (tab.id === 'live-tab-polls') $('live-dot-polls').hidden = true;
    if (tab.id === 'live-tab-chat') { const box = $('live-chat'); box.scrollTop = box.scrollHeight; }
  });
  $('live-preview-note').hidden = !isDemoMode();

  try {
    state.store = await createStore();
  } catch (error) {
    console.error('PhysioHead Live: could not open the live room', error);
    await showFallbackWebinar(reasonOf(error));
    return;
  }

  const { store } = state;
  let offlineTimer = null;
  store.onConnection((connected) => {
    clearTimeout(offlineTimer);
    if (connected) {
      if (!state.connected) showAlert('');
      state.connected = true;
      renderComposers();
    } else {
      // Brief drops are normal on mobile networks; only speak up if it lasts.
      offlineTimer = setTimeout(() => {
        state.connected = false;
        unavailable();
        renderComposers();
      }, 5000);
    }
  });

  // Public information first: it needs no sign-in, so the video and the lists
  // appear even if the interactive part cannot start.
  const drawQuestions = throttled(() => renderQuestions());
  const drawPolls = throttled(() => renderPolls());
  store.onWebinar((webinar) => {
    state.webinar = webinar;
    if (state.fellBack) {
      // The room answered after all; leave read-only mode.
      state.fellBack = false;
      state.readOnly = false;
      showAlert('');
      renderQuestions(true);
      renderPolls(true);
    }
    rememberWebinar(webinar);
    renderStage();
    renderComposers();
    renderQuestions();
  });
  store.onQuestions((list) => { state.questions = list; drawQuestions(); });
  store.onPolls((list) => { state.polls = list; drawPolls(); });
  store.onChat((list) => { state.chat = list; renderChat(); });

  // If the room stays silent, show the last webinar we know about.
  setTimeout(() => {
    if (state.webinar === undefined) showFallbackWebinar('no answer from the live room after 12 seconds');
  }, 12000);

  try {
    const { uid } = await store.ready();
    state.uid = uid;
  } catch (error) {
    console.error('PhysioHead Live: could not sign in to the live room', error);
    state.readOnly = true;
    unavailable(reasonOf(error));
    renderComposers();
    renderQuestions(true);
    renderPolls(true);
    return;
  }
  store.onMyPending((list) => { state.pending = list; renderQuestions(); });
  store.onMyVotes((set) => { state.myVotes = set; renderQuestions(); });
  store.onMyPollVotes((map) => { state.myPollVotes = map; renderPolls(); });
}

start();
