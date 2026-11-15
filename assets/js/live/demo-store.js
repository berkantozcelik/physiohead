/**
 * PhysioHead Live - preview ("demo") store.
 * Keeps the whole room in this browser (localStorage) and syncs open tabs
 * with BroadcastChannel. Nothing leaves the computer. It follows the same
 * rules as the real Firebase store so pages behave identically.
 *
 * Moderator sign-in in preview mode: any email, password "demo".
 */
import {
  LIMITS, SLOW_MODES, cleanText, cleanPoll, chatWaitSeconds, questionWaitSeconds, storeError,
} from './logic.js';

const KEY = 'physiohead-live-demo';
const STATUSES = ['scheduled', 'live', 'ended'];

const emptyRoom = () => ({
  webinar: null,
  pending: {},
  pendingLast: {},
  questions: {},
  qvotes: {},
  polls: {},
  pvotes: {},
  chat: [],
  chatLast: {},
});

function ensureWebinar(room) {
  if (!room.webinar) {
    room.webinar = {
      title: '', startsAt: 0, speakers: '', description: '', videoId: '',
      status: 'scheduled', chatLocked: false, chatSlowSeconds: 0,
    };
  }
  return room.webinar;
}

function sampleRoom(now) {
  const room = emptyRoom();
  room.webinar = {
    title: 'Beyond Medications in Headache Care',
    startsAt: now - 12 * 60 * 1000,
    speakers: 'PhysioHead SIG faculty',
    description: 'A sample session for previewing the live page. Physiotherapy and behavioural approaches in headache care, followed by a moderated Q&A.',
    videoId: 'Ej7bw_v5IxI',
    status: 'live',
    chatLocked: false,
    chatSlowSeconds: 0,
  };
  const people = [
    ['Dr. Elif Kaya', 'Neurologist'],
    ['Marco Rossi', 'Physiotherapist'],
    ['Dr. Sarah Lindqvist', 'Pain psychologist'],
    ['Ana Pereira', 'Physiotherapist'],
  ];
  const questions = [
    ['How do you decide when to refer a migraine patient for physiotherapy?', 14],
    ['Is there evidence for neck exercise programmes in tension-type headache?', 9],
    ['Which behavioural approaches work best alongside preventive medication?', 6],
    ['How many sessions do you usually plan before reassessing?', 2],
  ];
  questions.forEach(([text, votes], i) => {
    room.questions[`sample-q${i}`] = {
      text, name: people[i][0], role: people[i][1], votes, answered: false, createdAt: now - (10 - i) * 60000,
    };
  });
  room.polls['sample-p0'] = {
    question: 'What is your main professional background?',
    options: ['Physiotherapy', 'Neurology', 'Psychology', 'Other'],
    counts: [212, 148, 61, 37],
    status: 'open',
    createdAt: now - 5 * 60000,
  };
  const lines = [
    'Good evening from Istanbul!', 'Hello everyone, joining from Milan.',
    'Thank you for organising this session.', 'Great first slide.',
    'Will the recording be available afterwards?', 'Yes, the replay stays on this page.',
  ];
  room.chat = lines.map((text, i) => ({
    id: `sample-c${i}`, uid: `sample-u${i % 4}`, name: people[i % 4][0], role: people[i % 4][1], text,
    createdAt: now - (6 - i) * 40000,
  }));
  return room;
}

function randomId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultUid() {
  try {
    let uid = sessionStorage.getItem(`${KEY}-uid`);
    if (!uid) {
      uid = randomId('viewer');
      sessionStorage.setItem(`${KEY}-uid`, uid);
    }
    return uid;
  } catch {
    return randomId('viewer');
  }
}

function defaultChannel() {
  if (typeof BroadcastChannel === 'function') return new BroadcastChannel(KEY);
  return { postMessage() {}, close() {}, onmessage: null };
}

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
}

function defaultStorage() {
  try {
    localStorage.setItem(`${KEY}-probe`, '1');
    localStorage.removeItem(`${KEY}-probe`);
    return localStorage;
  } catch {
    return memoryStorage();
  }
}

export function createDemoStore({
  storage = defaultStorage(),
  channel = defaultChannel(),
  uid = defaultUid(),
  now = Date.now,
  seed = true,
} = {}) {
  const modKey = `${KEY}-moderator-${uid}`;
  let moderator = storage.getItem(modKey) === '1';
  const listeners = new Set();

  const load = () => {
    try {
      const raw = storage.getItem(KEY);
      if (raw) return { ...emptyRoom(), ...JSON.parse(raw) };
    } catch { /* fall through to a fresh room */ }
    const room = seed ? sampleRoom(now()) : emptyRoom();
    storage.setItem(KEY, JSON.stringify(room));
    return room;
  };

  const notify = () => listeners.forEach((fn) => fn());

  const mutate = (fn) => {
    const room = load();
    fn(room);
    storage.setItem(KEY, JSON.stringify(room));
    notify();
    channel.postMessage('changed');
  };

  channel.onmessage = () => notify();

  /** Subscribe to a derived view of the room. */
  const view = (derive) => (cb) => {
    const fn = () => cb(derive(load()));
    listeners.add(fn);
    fn();
    return () => listeners.delete(fn);
  };

  const toList = (obj) => Object.entries(obj || {}).map(([id, v]) => ({ id, ...v }));
  const act = (fn) => (...args) => {
    try {
      return Promise.resolve(fn(...args));
    } catch (error) {
      return Promise.reject(error.code ? error : storeError('invalid'));
    }
  };
  const modOnly = (fn) => act((...args) => {
    if (!moderator) throw storeError('denied');
    return fn(...args);
  });

  const profile = ({ name, role }) => {
    const cleanName = cleanText(name, LIMITS.name);
    const cleanRole = role ? cleanText(role, LIMITS.role) : '';
    if (!cleanName || cleanRole === null) throw storeError('invalid');
    return { name: cleanName, role: cleanRole };
  };

  return {
    mode: 'demo',
    ready: () => Promise.resolve({ uid }),
    onConnection: (cb) => { cb(true); return () => {}; },

    onWebinar: view((room) => room.webinar),
    onQuestions: view((room) => toList(room.questions)),
    onMyPending: view((room) => toList(room.pending[uid])),
    onMyVotes: view((room) => new Set(
      Object.keys(room.qvotes).filter((qid) => room.qvotes[qid][uid] && room.questions[qid]),
    )),
    onPolls: view((room) => toList(room.polls)
      .filter((p) => moderator || p.status !== 'draft')
      .sort((x, y) => y.createdAt - x.createdAt)),
    onMyPollVotes: view((room) => new Map(
      Object.keys(room.pvotes).filter((pid) => uid in room.pvotes[pid]).map((pid) => [pid, room.pvotes[pid][uid]]),
    )),
    onChat: view((room) => room.chat.slice(-LIMITS.chatHistory)),

    submitQuestion: act(({ text, name, role }) => {
      const clean = cleanText(text, LIMITS.question);
      if (!clean) throw storeError('invalid');
      const who = profile({ name, role });
      if (load().webinar?.status === 'ended') throw storeError('locked');
      const wait = questionWaitSeconds(now(), load().pendingLast[uid]);
      if (wait > 0) throw storeError('too-fast', { wait });
      mutate((room) => {
        room.pending[uid] = room.pending[uid] || {};
        room.pending[uid][randomId('q')] = { text: clean, ...who, createdAt: now() };
        room.pendingLast[uid] = now();
      });
    }),

    upvote: act((qid) => {
      const room = load();
      if (!room.questions[qid]) throw storeError('invalid');
      if (room.qvotes[qid]?.[uid]) return;
      mutate((r) => {
        r.qvotes[qid] = r.qvotes[qid] || {};
        r.qvotes[qid][uid] = true;
        r.questions[qid].votes += 1;
      });
    }),

    votePoll: act((pid, index) => {
      const room = load();
      const poll = room.polls[pid];
      if (!poll) throw storeError('invalid');
      if (poll.status !== 'open') throw storeError('locked');
      if (!Number.isInteger(index) || index < 0 || index >= poll.options.length) throw storeError('invalid');
      if (room.pvotes[pid] && uid in room.pvotes[pid]) return;
      mutate((r) => {
        r.pvotes[pid] = r.pvotes[pid] || {};
        r.pvotes[pid][uid] = index;
        r.polls[pid].counts[index] += 1;
      });
    }),

    sendChat: act(({ text, name, role }) => {
      const clean = cleanText(text, LIMITS.chat);
      if (!clean) throw storeError('invalid');
      const who = profile({ name, role });
      const room = load();
      if (room.webinar?.chatLocked || room.webinar?.status === 'ended') throw storeError('locked');
      const wait = chatWaitSeconds(now(), room.chatLast[uid], room.webinar?.chatSlowSeconds || 0);
      if (wait > 0) throw storeError('too-fast', { wait });
      mutate((r) => {
        r.chat.push({ id: randomId('c'), uid, ...who, text: clean, createdAt: now() });
        if (r.chat.length > 300) r.chat = r.chat.slice(-300);
        r.chatLast[uid] = now();
      });
    }),

    // ---- moderator ------------------------------------------------------
    signIn: act((email, password) => {
      if (!cleanText(email, 200) || password !== 'demo') throw storeError('denied');
      moderator = true;
      storage.setItem(modKey, '1');
      notify();
    }),
    signOut: act(() => {
      moderator = false;
      storage.removeItem(modKey);
      notify();
    }),
    onModerator: (cb) => {
      const fn = () => cb(moderator);
      listeners.add(fn);
      fn();
      return () => listeners.delete(fn);
    },

    saveWebinar: modOnly((partial) => {
      const allowed = ['title', 'startsAt', 'speakers', 'description', 'videoId'];
      mutate((room) => {
        const base = ensureWebinar(room);
        allowed.forEach((key) => { if (key in partial) base[key] = partial[key]; });
      });
    }),
    setStatus: modOnly((status) => {
      if (!STATUSES.includes(status)) throw storeError('invalid');
      mutate((room) => { ensureWebinar(room).status = status; });
    }),
    resetRoom: modOnly(() => {
      mutate((room) => {
        // Nothing is advertised until a moderator sets up the next webinar.
        Object.assign(room, emptyRoom());
      });
    }),

    onPending: view((room) => (moderator
      ? Object.entries(room.pending).flatMap(([owner, items]) => toList(items).map((q) => ({ ...q, uid: owner })))
        .sort((x, y) => x.createdAt - y.createdAt)
      : [])),
    approve: modOnly((pending) => {
      mutate((room) => {
        const item = room.pending[pending.uid]?.[pending.id];
        if (!item) return;
        room.questions[pending.id] = { ...item, votes: 0, answered: false };
        delete room.pending[pending.uid][pending.id];
      });
    }),
    reject: modOnly((pending) => {
      mutate((room) => { if (room.pending[pending.uid]) delete room.pending[pending.uid][pending.id]; });
    }),
    markAnswered: modOnly((qid, answered) => {
      mutate((room) => { if (room.questions[qid]) room.questions[qid].answered = !!answered; });
    }),
    removeQuestion: modOnly((qid) => {
      mutate((room) => { delete room.questions[qid]; delete room.qvotes[qid]; });
    }),

    deleteChat: modOnly((mid) => {
      mutate((room) => { room.chat = room.chat.filter((m) => m.id !== mid); });
    }),
    setChat: modOnly(({ locked, slowSeconds }) => {
      if (!SLOW_MODES.includes(slowSeconds)) throw storeError('invalid');
      mutate((room) => {
        const webinar = ensureWebinar(room);
        webinar.chatLocked = !!locked;
        webinar.chatSlowSeconds = slowSeconds;
      });
    }),

    createPoll: modOnly((draft) => {
      const poll = cleanPoll(draft);
      if (!poll) throw storeError('invalid');
      mutate((room) => {
        room.polls[randomId('p')] = { ...poll, counts: poll.options.map(() => 0), status: 'draft', createdAt: now() };
      });
    }),
    setPollStatus: modOnly((pid, status) => {
      if (!['draft', 'open', 'closed'].includes(status)) throw storeError('invalid');
      mutate((room) => { if (room.polls[pid]) room.polls[pid].status = status; });
    }),
    deletePoll: modOnly((pid) => {
      mutate((room) => { delete room.polls[pid]; delete room.pvotes[pid]; });
    }),

    // Preview mode has no real audience; show a plausible figure.
    onPresenceCount: (cb) => { cb(moderator ? 1 : 0); return () => {}; },
  };
}
