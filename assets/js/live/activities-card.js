/**
 * PhysioHead Live - "Live now / Next webinar" card on the Activities page.
 * Shows nothing when no webinar is planned or the information is unreachable.
 *
 * It reads the webinar once over plain HTTPS instead of joining the live room,
 * so Activities visitors are not counted as audience and cost almost nothing.
 */
import { firebaseConfig } from './config.js';
import { el, formatDateTime } from './dom.js';

const card = document.getElementById('live-card');
const forcedDemo = new URLSearchParams(window.location.search).get('demo') === '1';

function show(webinar) {
  const visible = webinar && (webinar.status === 'live' || webinar.status === 'scheduled') && webinar.title;
  card.hidden = !visible;
  if (!visible) return;
  const live = webinar.status === 'live';
  card.href = forcedDemo ? 'live.html?demo=1' : 'live.html';
  card.replaceChildren(
    el('span', { class: 'live-card-body' },
      el('span', { class: 'live-card-kicker' },
        el('span', { class: `live-badge is-${webinar.status}`, text: live ? 'Live now' : 'Next webinar' }),
        live || !webinar.startsAt ? null : el('span', { text: formatDateTime(webinar.startsAt) })),
      el('span', { class: 'live-card-title', text: webinar.title })),
    el('span', { class: 'live-card-action', text: live ? 'Join the webinar \u2192' : 'Open the live page \u2192' }),
  );
}

async function start() {
  if (!card) return;
  try {
    if (forcedDemo) {
      // Preview: read the sample room kept in this browser.
      const { createDemoStore } = await import('./demo-store.js');
      createDemoStore().onWebinar(show);
    } else if (firebaseConfig?.databaseURL) {
      const url = `${firebaseConfig.databaseURL.replace(/\/$/, '')}/webinar.json`;
      const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (response.ok) show(await response.json());
    }
    // No Firebase settings yet: nothing real to advertise, so stay hidden.
  } catch (error) {
    console.error('PhysioHead Live: card unavailable', error);
  }
}

start();
