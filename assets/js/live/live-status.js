/**
 * PhysioHead Live - "a webinar is live" signals on the rest of the site.
 * Loaded by site.js on every page. The menu always has a "Live" link; while a
 * webinar is live it turns red with a pulsing dot. The home page gets a banner:
 * a ticking countdown while a webinar is scheduled, "Join" once it is live.
 * Otherwise nothing changes.
 *
 * It reads the webinar once over plain HTTPS (not a live connection), so it
 * costs almost nothing, and checks again every two minutes.
 */
import { firebaseConfig } from './config.js';
import { countdownParts } from './logic.js';

const LIVE_PAGES = /\/live(-[a-z]+)?\.html$/; // the live pages themselves need no signal
const CHECK_EVERY_MS = 2 * 60 * 1000;
const isHome = /(^|\/)(index\.html)?$/.test(window.location.pathname);

let stylesReady = null;
function loadStyles() {
  if (!stylesReady) {
    stylesReady = new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = new URL('../../css/live.css?v=94952c0953', import.meta.url).href;
      link.onload = resolve;
      link.onerror = resolve;
      document.head.append(link);
    });
  }
  return stylesReady;
}

const liveHref = new URL('live.html', document.baseURI).href;

function span(className, text) {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = text;
  return node;
}

let bannerTimer = null;
let fastCheck = null;

function removeBanner() {
  clearInterval(bannerTimer);
  document.querySelector('.live-banner')?.remove();
}

function formatCountdown(ms) {
  const { days, hours, minutes, seconds } = countdownParts(ms);
  const clock = [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
  return days > 0 ? `${days}d ${clock}` : clock;
}

function showBanner(webinar, kind) {
  const main = document.querySelector('main');
  if (!isHome || !main) return;
  const live = kind === 'live';
  const banner = document.createElement('a');
  banner.className = `live-banner${live ? '' : ' is-upcoming'}`;
  banner.href = liveHref;
  const body = document.createElement('span');
  body.className = 'live-banner-body';
  const badge = span(`live-banner-badge${live ? '' : ' is-upcoming'}`, live ? 'Live now' : 'Upcoming');
  const title = span('live-banner-title', webinar.title || 'PhysioHead webinar');
  body.append(badge, title);
  banner.append(body);

  if (!live) {
    // Countdown to the saved start time; once it reaches zero, wait for Go live.
    const count = span('live-banner-count', '');
    count.setAttribute('role', 'timer');
    const tick = () => {
      const remaining = webinar.startsAt - Date.now();
      if (remaining > 0) {
        count.textContent = `Starts in ${formatCountdown(remaining)}`;
      } else {
        count.textContent = 'Starting shortly';
        // Ask more often now, so the banner switches to "Live now" soon after Go live.
        if (!fastCheck) fastCheck = setInterval(() => { if (!document.hidden) check(); }, 15000);
      }
    };
    tick();
    bannerTimer = setInterval(tick, 1000);
    body.append(count);
  }
  banner.append(span('live-banner-action', live ? 'Join the webinar →' : 'Open the live page →'));
  main.prepend(banner);
}

function showSignals(webinar) {
  const navLink = document.querySelector('.nav-links a[href="live.html"]');
  navLink?.classList.remove('nav-live');
  navLink?.querySelector('.nav-live-dot')?.remove();
  removeBanner();
  if (webinar?.status !== 'live') {
    // A webinar with a saved start time gets a countdown banner on the home page.
    if (webinar?.status === 'scheduled' && webinar.startsAt) showBanner(webinar, 'scheduled');
    else { clearInterval(fastCheck); fastCheck = null; }
    return;
  }
  clearInterval(fastCheck);
  fastCheck = null;

  // The menu always has a Live link; while a webinar is live it turns red.
  if (navLink) {
    navLink.classList.add('nav-live');
    navLink.prepend(span('nav-live-dot', ''));
  }
  showBanner(webinar, 'live');
}

async function check() {
  try {
    const url = `${firebaseConfig.databaseURL.replace(/\/$/, '')}/webinar.json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return;
    const webinar = await response.json();
    if (webinar?.status === 'live' || webinar?.status === 'scheduled') await loadStyles();
    showSignals(webinar);
  } catch {
    // Offline or blocked: leave the page as it is.
  }
}

function start() {
  if (!firebaseConfig?.databaseURL) return; // preview mode: nothing real to announce
  if (LIVE_PAGES.test(window.location.pathname)) return;
  if (new URLSearchParams(window.location.search).get('demo') === '1') return;
  check();
  setInterval(() => { if (!document.hidden) check(); }, CHECK_EVERY_MS);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
