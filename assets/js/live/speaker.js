/**
 * PhysioHead Live - speaker view (live-speaker.html).
 * Read-only: approved, unanswered questions in large type, most upvoted
 * first, plus the poll that is open (or the latest closed one).
 */
import { createStore } from './store.js';
import { sortQuestions, pollPercentages, displayName } from './logic.js';
import { el, clear } from './dom.js';

const $ = (id) => document.getElementById(id);

function renderQuestions(list) {
  const { open } = sortQuestions(list);
  const box = clear($('speaker-questions'));
  $('speaker-q-count').textContent = open.length ? `(${open.length})` : '';
  if (!open.length) {
    box.append(el('li', { class: 'live-speaker-empty', text: 'No approved questions yet. They appear here as the moderators approve them.' }));
    return;
  }
  open.forEach((q) => box.append(el('li', { class: 'live-speaker-question' },
    el('span', { class: 'live-speaker-votes', text: `▲ ${q.votes || 0}` }),
    el('div', {},
      el('p', { class: 'live-speaker-text', text: q.text }),
      el('p', { class: 'live-speaker-by', text: displayName(q.name, q.role) })))));
}

function renderPoll(polls) {
  const visible = polls.filter((p) => p.status !== 'draft');
  const poll = visible.find((p) => p.status === 'open') || visible[0];
  $('speaker-poll-section').hidden = !poll;
  const box = clear($('speaker-poll'));
  if (!poll) return;
  const percents = pollPercentages(poll.counts);
  const total = poll.counts.reduce((a, b) => a + (b || 0), 0);
  box.append(
    el('p', { class: 'live-poll-status', text: poll.status === 'open' ? 'Open now' : 'Closed' }),
    el('h3', { class: 'live-poll-question', text: poll.question }),
    el('div', { class: 'live-poll-options' }, poll.options.map((option, i) => {
      const bar = el('span', { class: 'live-poll-bar' });
      bar.style.width = `${percents[i]}%`;
      return el('div', { class: 'live-poll-result' }, bar,
        el('span', { class: 'live-poll-label', text: option }),
        el('span', { class: 'live-poll-percent', text: `${percents[i]}%` }));
    })),
    el('p', { class: 'live-poll-total', text: `${total} ${total === 1 ? 'vote' : 'votes'}` }),
  );
}

async function start() {
  const alert = $('speaker-alert');
  try {
    const store = await createStore();
    await store.ready();
    store.onWebinar((w) => {
      $('speaker-title').textContent = w?.title || 'Audience questions';
      const badge = $('speaker-badge');
      badge.hidden = !w;
      badge.className = `live-badge is-${w?.status || 'none'}`;
      badge.textContent = { live: 'Live', scheduled: 'Not live yet', ended: 'Ended' }[w?.status] || '';
    });
    store.onQuestions(renderQuestions);
    store.onPolls(renderPoll);
    let timer = null;
    store.onConnection((connected) => {
      clearTimeout(timer);
      if (connected) alert.hidden = true;
      else timer = setTimeout(() => { alert.hidden = false; alert.textContent = 'Connection lost. Reconnecting…'; }, 5000);
    });
  } catch (error) {
    console.error('PhysioHead Live: could not open the live room', error);
    alert.hidden = false;
    alert.textContent = 'The live room cannot be reached. Please refresh.';
  }
}

start();
