/**
 * PhysioHead Live - "a webinar is live" signals on the rest of the site.
 * Loaded by site.js on every page. While a webinar is live it adds a red
 * "Live" link to the menu and, on the home page, a "Join" banner. Otherwise
 * it does nothing and the page looks exactly as before.
 *
 * It reads the webinar once over plain HTTPS (not a live connection), so it
 * costs almost nothing, and checks again every two minutes.
 */
import { firebaseConfig } from './config.js';

const LIVE_PAGES = /\/live(-[a-z]+)?\.html$/; // the live pages themselves need no signal
const CHECK_EVERY_MS = 2 * 60 * 1000;
const isHome = /(^|\/)(index\.html)?$/.test(window.location.pathname);

let stylesReady = null;
function loadStyles() {
  if (!stylesReady) {
    stylesReady = new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = new URL('../../css/live.css?v=20261115', import.meta.url).href;
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

function showSignals(webinar) {
  document.querySelector('.nav-live')?.remove();
  document.querySelector('.live-banner')?.remove();
  if (webinar?.status !== 'live') return;

  const navLinks = document.querySelector('.nav-links');
  if (navLinks) {
    const link = document.createElement('a');
    link.className = 'nav-live';
    link.href = liveHref;
    link.append(span('nav-live-dot', ''), 'Live');
    navLinks.prepend(link);
  }

  const main = document.querySelector('main');
  if (isHome && main) {
    const banner = document.createElement('a');
    banner.className = 'live-banner';
    banner.href = liveHref;
    const body = document.createElement('span');
    body.className = 'live-banner-body';
    body.append(span('live-banner-badge', 'Live now'), span('live-banner-title', webinar.title || 'PhysioHead webinar'));
    banner.append(body, span('live-banner-action', 'Join the webinar →'));
    main.prepend(banner);
  }
}

async function check() {
  try {
    const url = `${firebaseConfig.databaseURL.replace(/\/$/, '')}/webinar.json`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return;
    const webinar = await response.json();
    if (webinar?.status === 'live') await loadStyles();
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
