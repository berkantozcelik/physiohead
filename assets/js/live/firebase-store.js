/**
 * PhysioHead Live - Firebase store (the real one).
 * Same interface as demo-store.js, backed by Firebase Realtime Database.
 * What each person may do is enforced by firebase/database.rules.json; the
 * checks in this file only exist to give people a clear message first.
 */
import {
  LIMITS, SLOW_MODES, cleanText, cleanPoll, chatWaitSeconds, questionWaitSeconds, storeError,
} from './logic.js';

export const FIREBASE_SDK_VERSION = '13.3.0';

async function loadSdk() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
  const [app, auth, database] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-auth.js`),
    import(`${base}/firebase-database.js`),
  ]);
  return { app, auth, database };
}

const STATUSES = ['scheduled', 'live', 'ended'];
const toList = (obj) => Object.entries(obj || {}).map(([id, v]) => ({ id, ...v }));

/** Translate anything Firebase throws into one of our five error codes. */
function translate(error) {
  if (error?.code && ['invalid', 'too-fast', 'locked', 'denied', 'offline'].includes(error.code)) return error;
  const text = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  if (text.includes('permission') || text.includes('auth/')) return storeError('denied');
  if (text.includes('network') || text.includes('disconnect') || text.includes('offline')) return storeError('offline');
  return storeError('denied');
}

/**
 * @param {object} options
 * @param {object} options.config    Firebase web config (see config.js)
 * @param {object} [options.sdk]     { app, auth, database } modules (tests pass the npm ones)
 * @param {object} [options.emulator] { databaseHost, databasePort, authUrl } for local tests
 * @param {string} [options.appName] distinct name when several stores share a page (tests)
 */
export async function createFirebaseStore({ config, sdk, emulator, appName } = {}) {
  const { app: A, auth: U, database: D } = sdk || await loadSdk();
  const app = A.initializeApp(config, appName || 'physiohead-live');
  const auth = U.getAuth(app);
  const db = D.getDatabase(app);
  if (emulator) {
    D.connectDatabaseEmulator(db, emulator.databaseHost, emulator.databasePort);
    U.connectAuthEmulator(auth, emulator.authUrl, { disableWarnings: true });
  }

  const ref = (path) => (path ? D.ref(db, path) : D.ref(db));
  const NOW = D.serverTimestamp();

  // Small always-on mirrors used for friendly pre-checks.
  const mirror = { webinar: null, offset: 0, chatLast: 0, pendingLast: 0, moderator: false };
  const now = () => Date.now() + mirror.offset;
  let uid = null;
  let personal = []; // unsubscribe functions tied to the signed-in person
  const moderatorListeners = new Set();

  D.onValue(ref('webinar'), (snap) => { mirror.webinar = snap.val(); }, () => {});
  D.onValue(ref('.info/serverTimeOffset'), (snap) => { mirror.offset = snap.val() || 0; });

  async function becomePerson(user) {
    personal.forEach((stop) => stop());
    personal = [];
    uid = user.uid;
    mirror.chatLast = 0;
    mirror.pendingLast = 0;
    personal.push(
      D.onValue(ref(`chatLast/${uid}`), (s) => { mirror.chatLast = s.val()?.at || 0; }, () => {}),
      D.onValue(ref(`pendingLast/${uid}`), (s) => { mirror.pendingLast = s.val()?.at || 0; }, () => {}),
      // Mark this browser as connected; the server clears it when the tab closes.
      D.onValue(ref('.info/connected'), (s) => {
        if (s.val() !== true) return;
        const me = ref(`presence/${uid}`);
        D.onDisconnect(me).remove().then(() => D.set(me, true)).catch(() => {});
      }),
    );
    let isModerator = false;
    try {
      isModerator = (await D.get(ref(`moderators/${uid}`))).val() === true;
    } catch { /* not a moderator */ }
    mirror.moderator = isModerator;
    moderatorListeners.forEach((cb) => cb(isModerator));
  }

  const firstUser = new Promise((resolve, reject) => {
    const stop = U.onAuthStateChanged(auth, (user) => { stop(); resolve(user); }, reject);
  });
  const readyPromise = (async () => {
    let user = await firstUser;
    if (!user) user = (await U.signInAnonymously(auth)).user;
    await becomePerson(user);
    return { uid };
  })();

  /** Wrap an action so it waits for sign-in and always rejects with our codes. */
  const act = (fn) => async (...args) => {
    try {
      await readyPromise;
      return await fn(...args);
    } catch (error) {
      throw translate(error);
    }
  };

  const listen = (path, map, { query } = {}) => (cb) => {
    let stop = () => {};
    let cancelled = false;
    const attach = () => {
      if (cancelled) return;
      const where = typeof path === 'function' ? path() : path;
      const target = query ? query(ref(where)) : ref(where);
      stop = D.onValue(target, (snap) => cb(map(snap)), () => cb(map({ val: () => null, forEach: () => {} })));
    };
    // Public data (a plain path) is listened to straight away, so the video and
    // the lists still appear if sign-in is slow or fails. Per-person and
    // moderator paths (a function) need to know who is signed in first.
    if (typeof path === 'function') readyPromise.then(attach).catch(() => {});
    else attach();
    return () => { cancelled = true; stop(); };
  };

  const profile = ({ name, role }) => {
    const cleanName = cleanText(name, LIMITS.name);
    const cleanRole = role ? cleanText(role, LIMITS.role) : '';
    if (!cleanName || cleanRole === null) throw storeError('invalid');
    return { name: cleanName, role: cleanRole };
  };

  const normalisePoll = (id, poll, status) => ({
    id,
    question: poll.question,
    options: poll.options || [],
    counts: (poll.options || []).map((_, i) => Number(poll.counts?.[i]) || 0),
    status: status || poll.status,
    createdAt: poll.createdAt || 0,
  });

  return {
    mode: 'firebase',
    ready: () => readyPromise,

    onConnection: (cb) => D.onValue(ref('.info/connected'), (snap) => cb(snap.val() === true)),

    onWebinar: listen('webinar', (snap) => snap.val()),
    onQuestions: listen('questions', (snap) => toList(snap.val())),
    onMyPending: listen(() => `pending/${uid}`, (snap) => toList(snap.val())),
    onMyVotes: listen(() => `qvotes/${uid}`, (snap) => new Set(Object.keys(snap.val() || {}))),
    onMyPollVotes: listen(() => `pvotes/${uid}`, (snap) => new Map(
      Object.entries(snap.val() || {}).map(([pid, idx]) => [pid, Number(idx)]),
    )),
    onChat: listen('chat', (snap) => {
      const list = [];
      snap.forEach((child) => { list.push({ id: child.key, ...child.val() }); });
      return list;
    }, { query: (r) => D.query(r, D.orderByChild('createdAt'), D.limitToLast(LIMITS.chatHistory)) }),

    /** Launched polls for everyone; moderators also get their drafts. */
    onPolls: (cb) => {
      let launched = [];
      let drafts = [];
      const emit = () => cb([...drafts, ...launched].sort((x, y) => y.createdAt - x.createdAt));
      const stops = [listen('polls', (snap) => Object.entries(snap.val() || {}).map(([id, p]) => normalisePoll(id, p)))((list) => { launched = list; emit(); })];
      readyPromise.then(() => {
        if (!mirror.moderator) return;
        stops.push(listen(() => 'pollDrafts', (snap) => Object.entries(snap.val() || {}).map(([id, p]) => normalisePoll(id, p, 'draft')))((list) => { drafts = list; emit(); }));
      }).catch(() => {});
      return () => stops.forEach((stop) => stop());
    },

    submitQuestion: act(async ({ text, name, role }) => {
      const clean = cleanText(text, LIMITS.question);
      if (!clean) throw storeError('invalid');
      const who = profile({ name, role });
      if (mirror.webinar?.status === 'ended') throw storeError('locked');
      const wait = questionWaitSeconds(now(), mirror.pendingLast);
      if (wait > 0) throw storeError('too-fast', { wait });
      const qid = D.push(ref(`pending/${uid}`)).key;
      mirror.pendingLast = now();
      try {
        await D.update(ref(), {
          [`pending/${uid}/${qid}`]: { text: clean, ...who, createdAt: NOW },
          [`pendingLast/${uid}`]: { at: NOW, id: qid },
        });
      } catch (error) {
        mirror.pendingLast = (await D.get(ref(`pendingLast/${uid}`)).catch(() => null))?.val()?.at || 0;
        throw error;
      }
    }),

    upvote: act(async (qid) => {
      if (typeof qid !== 'string' || !qid) throw storeError('invalid');
      const already = (await D.get(ref(`qvotes/${uid}/${qid}`))).exists();
      if (already) return;
      await D.update(ref(), {
        [`qvotes/${uid}/${qid}`]: true,
        [`questions/${qid}/votes`]: D.increment(1),
      });
    }),

    votePoll: act(async (pid, index) => {
      const poll = (await D.get(ref(`polls/${pid}`))).val();
      if (!poll || poll.status !== 'open') throw storeError('locked');
      if (!Number.isInteger(index) || index < 0 || index >= (poll.options || []).length) throw storeError('invalid');
      const already = (await D.get(ref(`pvotes/${uid}/${pid}`))).exists();
      if (already) return;
      await D.update(ref(), {
        [`pvotes/${uid}/${pid}`]: String(index),
        [`polls/${pid}/counts/${index}`]: D.increment(1),
      });
    }),

    sendChat: act(async ({ text, name, role }) => {
      const clean = cleanText(text, LIMITS.chat);
      if (!clean) throw storeError('invalid');
      const who = profile({ name, role });
      if (mirror.webinar?.chatLocked || mirror.webinar?.status === 'ended') throw storeError('locked');
      const wait = chatWaitSeconds(now(), mirror.chatLast, mirror.webinar?.chatSlowSeconds || 0);
      if (wait > 0) throw storeError('too-fast', { wait });
      const mid = D.push(ref('chat')).key;
      const previous = mirror.chatLast;
      mirror.chatLast = now();
      try {
        await D.update(ref(), {
          [`chat/${mid}`]: { uid, ...who, text: clean, createdAt: NOW },
          [`chatLast/${uid}`]: { at: NOW, id: mid },
        });
      } catch (error) {
        mirror.chatLast = previous;
        if (translate(error).code !== 'denied') throw error;
        // The server said no although our own check passed. Find out why.
        const fresh = (await D.get(ref('webinar')).catch(() => null))?.val();
        if (fresh?.chatLocked || fresh?.status === 'ended') throw storeError('locked');
        throw storeError('too-fast', { wait: Math.max(fresh?.chatSlowSeconds || 0, LIMITS.chatFloor) });
      }
    }),

    // ---- moderator ------------------------------------------------------
    signIn: act(async (email, password) => {
      const { user } = await U.signInWithEmailAndPassword(auth, email, password);
      await becomePerson(user);
      if (!mirror.moderator) {
        await U.signOut(auth);
        await becomePerson((await U.signInAnonymously(auth)).user);
        throw storeError('denied');
      }
    }),
    signOut: act(async () => {
      await D.remove(ref(`presence/${uid}`)).catch(() => {});
      await U.signOut(auth);
      await becomePerson((await U.signInAnonymously(auth)).user);
    }),
    onModerator: (cb) => {
      moderatorListeners.add(cb);
      readyPromise.then(() => cb(mirror.moderator)).catch(() => cb(false));
      return () => moderatorListeners.delete(cb);
    },

    saveWebinar: act(async (partial) => {
      const allowed = ['title', 'startsAt', 'speakers', 'description', 'videoId'];
      const patch = {};
      allowed.forEach((key) => { if (key in partial) patch[key] = partial[key]; });
      if (!mirror.webinar) Object.assign(patch, { status: 'scheduled', chatLocked: false, chatSlowSeconds: 0 });
      await D.update(ref('webinar'), patch);
    }),
    setStatus: act(async (status) => {
      if (!STATUSES.includes(status)) {
        if (!mirror.moderator) throw storeError('denied');
        throw storeError('invalid');
      }
      await D.update(ref('webinar'), { status });
    }),
    resetRoom: act(async () => {
      if (!mirror.moderator) throw storeError('denied');
      const [questions, polls, webinar] = await Promise.all([
        D.get(ref('questions')), D.get(ref('polls')), D.get(ref('webinar')),
      ]);
      const patch = {
        questions: null, qvotes: null, polls: null, pollDrafts: null, pvotes: null,
        chat: null, chatLast: null, pending: null, pendingLast: null,
        webinar: null, // nothing is advertised until the next webinar is set up
      };
      if (questions.exists() || polls.exists()) {
        patch[`archive/${Date.now()}`] = { webinar: webinar.val(), questions: questions.val(), polls: polls.val() };
      }
      await D.update(ref(), patch);
    }),

    onPending: listen(() => 'pending', (snap) => Object.entries(snap.val() || {})
      .flatMap(([owner, items]) => toList(items).map((q) => ({ ...q, uid: owner })))
      .sort((x, y) => x.createdAt - y.createdAt)),
    approve: act(async (pending) => {
      if (!mirror.moderator) throw storeError('denied');
      // Already handled by another moderator? Then there is nothing to do.
      if (!(await D.get(ref(`pending/${pending.uid}/${pending.id}`))).exists()) return;
      // A fresh key: the sender chose the pending id, so it must never decide
      // where the approved question is stored.
      const qid = D.push(ref('questions')).key;
      await D.update(ref(), {
        [`questions/${qid}`]: {
          text: pending.text, name: pending.name, role: pending.role || '', votes: 0, answered: false, createdAt: pending.createdAt || now(),
        },
        [`pending/${pending.uid}/${pending.id}`]: null,
      });
    }),
    reject: act((pending) => D.remove(ref(`pending/${pending.uid}/${pending.id}`))),
    markAnswered: act((qid, answered) => D.update(ref(`questions/${qid}`), { answered: !!answered })),
    removeQuestion: act((qid) => D.remove(ref(`questions/${qid}`))),

    deleteChat: act((mid) => D.remove(ref(`chat/${mid}`))),
    setChat: act(async ({ locked, slowSeconds }) => {
      if (!SLOW_MODES.includes(slowSeconds)) {
        if (!mirror.moderator) throw storeError('denied');
        throw storeError('invalid');
      }
      await D.update(ref('webinar'), { chatLocked: !!locked, chatSlowSeconds: slowSeconds });
    }),

    createPoll: act(async (draft) => {
      if (!mirror.moderator) throw storeError('denied');
      const poll = cleanPoll(draft);
      if (!poll) throw storeError('invalid');
      await D.set(D.push(ref('pollDrafts')), {
        ...poll, counts: poll.options.map(() => 0), status: 'draft', createdAt: NOW,
      });
    }),
    setPollStatus: act(async (pid, status) => {
      if (!mirror.moderator) throw storeError('denied');
      if (status === 'open') {
        const draft = (await D.get(ref(`pollDrafts/${pid}`))).val();
        if (draft) {
          await D.update(ref(), { [`polls/${pid}`]: { ...draft, status: 'open' }, [`pollDrafts/${pid}`]: null });
          return;
        }
      }
      if (status !== 'open' && status !== 'closed') throw storeError('invalid');
      if (!(await D.get(ref(`polls/${pid}`))).exists()) throw storeError('invalid');
      await D.update(ref(`polls/${pid}`), { status });
    }),
    deletePoll: act((pid) => D.update(ref(), { [`polls/${pid}`]: null, [`pollDrafts/${pid}`]: null })),

    onPresenceCount: listen(() => 'presence', (snap) => Object.keys(snap.val() || {}).length),

    /** Tests only: release the connection. */
    close: () => A.deleteApp(app),
  };
}
