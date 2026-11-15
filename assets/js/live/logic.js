/**
 * PhysioHead Live - pure rules of the room.
 * No DOM and no network in this file, so it can be tested with `npm test`.
 */

export const LIMITS = {
  question: 300,
  chat: 300,
  name: 60,
  role: 60,
  pollQuestion: 200,
  pollOption: 80,
  pollMin: 2,
  pollMax: 6,
  chatFloor: 3, // seconds between chat messages, always
  questionFloor: 20, // seconds between submitted questions, always
  chatHistory: 100,
};

export const SLOW_MODES = [0, 10, 30, 60];

/** Trimmed text, or null when empty, not a string, or longer than max. */
export function cleanText(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.length > max) return null;
  return text;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be',
  'youtube-nocookie.com', 'www.youtube-nocookie.com',
]);

/** Extract the 11-character video id from an id or a YouTube link. */
export function parseYouTubeId(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (YT_ID.test(value)) return value;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!YT_HOSTS.has(url.hostname)) return null;
  let candidate = null;
  if (url.hostname === 'youtu.be') {
    candidate = url.pathname.split('/')[1];
  } else if (url.pathname === '/watch') {
    candidate = url.searchParams.get('v');
  } else {
    const match = url.pathname.match(/^\/(?:live|embed|shorts)\/([^/]+)/);
    candidate = match ? match[1] : null;
  }
  return candidate && YT_ID.test(candidate) ? candidate : null;
}

/** Open questions by votes (then oldest first); answered kept separately. */
export function sortQuestions(list) {
  const byRank = (a, b) => (b.votes || 0) - (a.votes || 0) || (a.createdAt || 0) - (b.createdAt || 0);
  const open = list.filter((q) => !q.answered).sort(byRank);
  const answered = list.filter((q) => q.answered).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return { open, answered };
}

/** Whole percentages that add up to exactly 100 (largest-remainder method). */
export function pollPercentages(counts) {
  const total = counts.reduce((sum, n) => sum + (n || 0), 0);
  if (!total) return counts.map(() => 0);
  const exact = counts.map((n) => ((n || 0) / total) * 100);
  const result = exact.map(Math.floor);
  let left = 100 - result.reduce((a, b) => a + b, 0);
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);
  for (let i = 0; left > 0; i += 1, left -= 1) result[order[i % order.length].index] += 1;
  return result;
}

export function countdownParts(msRemaining) {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** Seconds a person still has to wait before their next chat message. */
export function chatWaitSeconds(now, lastSentAt, slowSeconds) {
  if (!lastSentAt) return 0;
  const gap = Math.max(slowSeconds || 0, LIMITS.chatFloor) * 1000;
  return Math.max(0, Math.ceil((lastSentAt + gap - now) / 1000));
}

export function questionWaitSeconds(now, lastSentAt) {
  if (!lastSentAt) return 0;
  return Math.max(0, Math.ceil((lastSentAt + LIMITS.questionFloor * 1000 - now) / 1000));
}

export function displayName(name, role) {
  return role ? `${name} · ${role}` : name;
}

/** Shared validation for a new poll. Returns { question, options } or null. */
export function cleanPoll({ question, options } = {}) {
  const q = cleanText(question, LIMITS.pollQuestion);
  if (!q || !Array.isArray(options)) return null;
  const opts = options.map((o) => cleanText(o, LIMITS.pollOption));
  if (opts.some((o) => !o)) return null;
  if (opts.length < LIMITS.pollMin || opts.length > LIMITS.pollMax) return null;
  return { question: q, options: opts };
}

/** An Error carrying one of: invalid, too-fast, locked, denied, offline. */
export function storeError(code, extra = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, extra);
  return error;
}
