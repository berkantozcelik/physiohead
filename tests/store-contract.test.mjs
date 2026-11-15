/**
 * One behaviour contract, run against every store implementation.
 * `makeRoom()` must return { a, b, mod, advance(ms), close() } where a and b are
 * two audience clients, mod is a signed-in moderator client, and advance moves
 * time forward (fake clock for the demo store, real waiting for Firebase).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(check, label = 'condition', timeout = 4000) {
  const start = Date.now();
  for (;;) {
    const value = check();
    if (value) return value;
    if (Date.now() - start > timeout) throw new Error(`Timed out waiting for ${label}`);
    await sleep(15);
  }
}

function watch(subscribe) {
  const box = { value: undefined, stop: null };
  box.stop = subscribe((v) => { box.value = v; });
  return box;
}

const rejectsWith = (promise, code) => assert.rejects(promise, (e) => e.code === code, `expected ${code}`);
const who = { name: 'Dr. Test', role: 'Physiotherapist' };

export function runContract(name, makeRoom) {
  test(`${name}: question flow, moderation and single upvote`, async () => {
    const room = await makeRoom();
    const { a, b, mod } = room;
    try {
      const myPending = watch((cb) => a.onMyPending(cb));
      const modPending = watch((cb) => mod.onPending(cb));
      const bQuestions = watch((cb) => b.onQuestions(cb));

      await a.submitQuestion({ text: '  Is manual therapy useful in migraine?  ', ...who });
      await until(() => myPending.value?.length === 1, 'author sees pending');
      await until(() => modPending.value?.length === 1, 'moderator sees pending');
      assert.equal(modPending.value[0].text, 'Is manual therapy useful in migraine?');
      assert.equal(bQuestions.value.length, 0, 'pending question is not public');

      const approved = modPending.value[0];
      await mod.approve(approved);
      await until(() => bQuestions.value?.length === 1, 'approved question is public');
      await mod.approve(approved); // a second moderator clicking the same item
      await sleep(80);
      assert.equal(bQuestions.value.length, 1, 'approving twice does not duplicate or overwrite');
      assert.equal(bQuestions.value[0].votes, 0);
      assert.equal(bQuestions.value[0].answered, false);
      await until(() => myPending.value.length === 0, 'pending cleared');

      const qid = bQuestions.value[0].id;
      const bVotes = watch((cb) => b.onMyVotes(cb));
      await b.upvote(qid);
      await b.upvote(qid).catch(() => {});
      await until(() => bQuestions.value[0].votes === 1, 'one vote counted');
      await sleep(60);
      assert.equal(bQuestions.value[0].votes, 1, 'second upvote not counted');
      await until(() => bVotes.value?.has(qid), 'my vote remembered');

      await mod.markAnswered(qid, true);
      await until(() => bQuestions.value[0].answered === true, 'answered flag');

      await mod.removeQuestion(qid);
      await until(() => bQuestions.value.length === 0, 'question removed');
    } finally { await room.close(); }
  });

  test(`${name}: question validation, rate limit and rejection`, async () => {
    const room = await makeRoom();
    const { a, mod } = room;
    try {
      await rejectsWith(a.submitQuestion({ text: '   ', ...who }), 'invalid');
      await rejectsWith(a.submitQuestion({ text: 'x'.repeat(301), ...who }), 'invalid');
      await rejectsWith(a.submitQuestion({ text: 'ok', name: '  ', role: '' }), 'invalid');
      await a.submitQuestion({ text: 'First', ...who });
      await rejectsWith(a.submitQuestion({ text: 'Second', ...who }), 'too-fast');
      await room.advance(20500);
      await a.submitQuestion({ text: 'Second', ...who });

      const modPending = watch((cb) => mod.onPending(cb));
      await until(() => modPending.value?.length === 2, 'two pending');
      await mod.reject(modPending.value[0]);
      await until(() => modPending.value.length === 1, 'one rejected');
    } finally { await room.close(); }
  });

  test(`${name}: polls count one vote per person and respect status`, async () => {
    const room = await makeRoom();
    const { a, b, mod } = room;
    try {
      const polls = watch((cb) => a.onPolls(cb));
      await rejectsWith(mod.createPoll({ question: 'Only one option?', options: ['Yes'] }), 'invalid');
      await mod.createPoll({ question: 'Do you use exercise therapy?', options: ['Yes', 'No', 'Sometimes'] });
      const modPolls = watch((cb) => mod.onPolls(cb));
      await until(() => modPolls.value?.length === 1, 'poll created');
      const pid = modPolls.value[0].id;
      assert.equal(modPolls.value[0].status, 'draft');
      assert.deepEqual(modPolls.value[0].counts, [0, 0, 0]);

      await rejectsWith(a.votePoll(pid, 0), 'locked');
      await mod.setPollStatus(pid, 'open');
      await until(() => polls.value?.find((p) => p.id === pid)?.status === 'open', 'poll open');
      await rejectsWith(a.votePoll(pid, 7), 'invalid');
      await a.votePoll(pid, 0);
      await a.votePoll(pid, 1).catch(() => {});
      await b.votePoll(pid, 2);
      await until(() => polls.value[0].counts.reduce((x, y) => x + y, 0) === 2, 'two votes');
      await sleep(60);
      assert.deepEqual(polls.value[0].counts, [1, 0, 1]);
      const mine = watch((cb) => a.onMyPollVotes(cb));
      await until(() => mine.value?.get(pid) === 0, 'my poll vote remembered');

      await mod.setPollStatus(pid, 'closed');
      await until(() => polls.value[0].status === 'closed', 'poll closed');
      await rejectsWith(b.votePoll(pid, 1), 'locked');
      await mod.deletePoll(pid);
      await until(() => polls.value.length === 0, 'poll deleted');
    } finally { await room.close(); }
  });

  test(`${name}: chat floor, slow mode, lock, delete and history cap`, async () => {
    const room = await makeRoom();
    const { a, b, mod } = room;
    try {
      const chat = watch((cb) => b.onChat(cb));
      await a.sendChat({ text: 'Hello from Izmir', ...who });
      await until(() => chat.value?.length === 1, 'chat delivered');
      assert.equal(chat.value[0].text, 'Hello from Izmir');
      assert.equal(chat.value[0].name, 'Dr. Test');
      await rejectsWith(a.sendChat({ text: 'Too soon', ...who }), 'too-fast');
      await rejectsWith(b.sendChat({ text: '   ', ...who }), 'invalid');
      await room.advance(3200);
      await a.sendChat({ text: 'Second', ...who });

      await mod.setChat({ locked: false, slowSeconds: 10 });
      const webinar = watch((cb) => a.onWebinar(cb));
      await until(() => webinar.value?.chatSlowSeconds === 10, 'slow mode on');
      await room.advance(3200);
      await rejectsWith(a.sendChat({ text: 'Still slow', ...who }), 'too-fast');

      await mod.setChat({ locked: true, slowSeconds: 0 });
      await until(() => webinar.value?.chatLocked === true, 'chat locked');
      await rejectsWith(b.sendChat({ text: 'Locked out', ...who }), 'locked');

      await until(() => chat.value.length === 2, 'two messages');
      await mod.deleteChat(chat.value[0].id);
      await until(() => chat.value.length === 1, 'message deleted');
      assert.equal(chat.value[0].text, 'Second');
    } finally { await room.close(); }
  });

  test(`${name}: moderator-only actions are denied to the audience`, async () => {
    const room = await makeRoom();
    const { a } = room;
    try {
      await rejectsWith(a.saveWebinar({ title: 'Hijacked' }), 'denied');
      await rejectsWith(a.setStatus('ended'), 'denied');
      await rejectsWith(a.setChat({ locked: true, slowSeconds: 0 }), 'denied');
      await rejectsWith(a.createPoll({ question: 'Q?', options: ['a', 'b'] }), 'denied');
      await rejectsWith(a.resetRoom(), 'denied');
      await rejectsWith(a.deleteChat('whatever'), 'denied');
    } finally { await room.close(); }
  });

  test(`${name}: webinar settings, status and reset`, async () => {
    const room = await makeRoom();
    const { a, mod } = room;
    try {
      const webinar = watch((cb) => a.onWebinar(cb));
      await mod.saveWebinar({ title: 'Beyond Medications', startsAt: 1800000000000, speakers: 'A, B', description: 'D', videoId: 'Ej7bw_v5IxI' });
      await until(() => webinar.value?.title === 'Beyond Medications', 'webinar saved');
      await mod.setStatus('live');
      await until(() => webinar.value.status === 'live', 'live');
      await rejectsWith(mod.setStatus('paused'), 'invalid');

      await a.submitQuestion({ text: 'Q', ...who });
      await a.sendChat({ text: 'C', ...who });
      await mod.createPoll({ question: 'P?', options: ['a', 'b'] });
      await mod.resetRoom();
      const q = watch((cb) => a.onQuestions(cb));
      const p = watch((cb) => a.onPolls(cb));
      const c = watch((cb) => a.onChat(cb));
      const pend = watch((cb) => mod.onPending(cb));
      await until(() => webinar.value === null, 'reset leaves no webinar advertised');
      await until(() => q.value?.length === 0 && p.value?.length === 0 && c.value?.length === 0 && pend.value?.length === 0, 'room emptied');
    } finally { await room.close(); }
  });
}

// ---- Demo store ---------------------------------------------------------
import { createDemoStore } from '../assets/js/live/demo-store.js';

function memoryRoom() {
  const data = new Map();
  const storage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
  const ports = new Set();
  const makeChannel = () => {
    const port = {
      onmessage: null,
      postMessage(msg) { ports.forEach((p) => { if (p !== port && p.onmessage) queueMicrotask(() => p.onmessage({ data: msg })); }); },
      close() { ports.delete(port); },
    };
    ports.add(port);
    return port;
  };
  let clock = 1700000000000;
  const now = () => clock;
  const make = (uid) => createDemoStore({ storage, channel: makeChannel(), uid, now, seed: false });
  return { make, advance: async (ms) => { clock += ms; } };
}

runContract('demo store', async () => {
  const { make, advance } = memoryRoom();
  const a = make('user-a');
  const b = make('user-b');
  const mod = make('user-mod');
  await Promise.all([a.ready(), b.ready(), mod.ready()]);
  await mod.signIn('mod@physiohead.test', 'demo');
  return { a, b, mod, advance, close: async () => {} };
});

test('demo store: chat history is capped at 100 and wrong password is denied', async () => {
  const { make, advance } = memoryRoom();
  const a = make('user-a');
  await rejectsWith(a.signIn('x@y.z', 'nope'), 'denied');
  for (let i = 0; i < 105; i += 1) {
    await a.sendChat({ text: `m${i}`, ...who });
    await advance(4000);
  }
  let list;
  a.onChat((v) => { list = v; });
  assert.equal(list.length, 100);
  assert.equal(list[99].text, 'm104');
});

test('demo store: seeds a sample room when empty', async () => {
  const data = new Map();
  const storage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: (k) => data.delete(k) };
  const store = createDemoStore({ storage, channel: { postMessage() {}, close() {} }, uid: 'u', now: () => 1700000000000 });
  let webinar; let questions;
  store.onWebinar((v) => { webinar = v; });
  store.onQuestions((v) => { questions = v; });
  assert.equal(webinar.status, 'live');
  assert.equal(webinar.videoId, 'Ej7bw_v5IxI');
  assert.equal(questions.length, 4);
});
