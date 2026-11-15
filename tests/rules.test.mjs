/**
 * Security-rule tests. Run with `npm run test:rules` (starts the Firebase
 * Realtime Database emulator, which needs Java).
 */
import test, { before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';

const TS = { '.sv': 'timestamp' };
const INC = { '.sv': { increment: 1 } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let env;
let anon; // no sign-in at all
let alice;
let bob;
let mod;

const question = (extra = {}) => ({ text: 'Is exercise useful?', name: 'Dr. A', role: 'Physio', createdAt: TS, ...extra });
const chatMsg = (uid, extra = {}) => ({ uid, text: 'Hello', name: 'Dr. A', role: '', createdAt: TS, ...extra });

// Keys must look like Firebase push ids: "-" followed by 19 url-safe characters.
const k = (label) => `-${label}`.padEnd(20, '0');
const stamp = (id) => ({ at: TS, id });

const askQuestion = (db, uid, qid, q = question()) => db.ref().update({
  [`pending/${uid}/${k(qid)}`]: q,
  [`pendingLast/${uid}`]: stamp(k(qid)),
});
const upvote = (db, uid, qid) => db.ref().update({
  [`qvotes/${uid}/${qid}`]: true,
  [`questions/${qid}/votes`]: INC,
});
const votePoll = (db, uid, pid, idx) => db.ref().update({
  [`pvotes/${uid}/${pid}`]: String(idx),
  [`polls/${pid}/counts/${idx}`]: INC,
});
const sendChat = (db, uid, mid, msg = chatMsg(uid)) => db.ref().update({
  [`chat/${k(mid)}`]: msg,
  [`chatLast/${uid}`]: stamp(k(mid)),
});

async function seed(data) {
  await env.withSecurityRulesDisabled((ctx) => ctx.database().ref().update(data));
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-physiohead',
    database: { rules: readFileSync(new URL('../firebase/database.rules.json', import.meta.url), 'utf8') },
  });
  anon = env.unauthenticatedContext().database();
  alice = env.authenticatedContext('alice').database();
  bob = env.authenticatedContext('bob').database();
  mod = env.authenticatedContext('mod').database();
});

after(async () => { await env?.cleanup(); });

beforeEach(async () => {
  await env.clearDatabase();
  await seed({
    'moderators/mod': true,
    webinar: { title: 'T', startsAt: 1, speakers: '', description: '', videoId: 'Ej7bw_v5IxI', status: 'live', chatLocked: false, chatSlowSeconds: 0 },
    'questions/q1': { text: 'Approved', name: 'N', role: '', votes: 0, answered: false, createdAt: 1 },
    'polls/p1': { question: 'P?', options: ['a', 'b'], counts: [0, 0], status: 'open', createdAt: 1 },
    'polls/p2': { question: 'P2?', options: ['a', 'b'], counts: [0, 0], status: 'closed', createdAt: 2 },
    'pollDrafts/d1': { question: 'Draft?', options: ['a', 'b'], counts: [0, 0], status: 'draft', createdAt: 3 },
  });
});

test('public data is readable by anyone; nothing is writable without sign-in', async () => {
  await assertSucceeds(anon.ref('webinar').get());
  await assertSucceeds(anon.ref('questions').get());
  await assertSucceeds(anon.ref('polls').get());
  await assertSucceeds(anon.ref('chat').get());
  await assertFails(anon.ref('pending').get());
  await assertFails(anon.ref('pollDrafts').get());
  await assertFails(anon.ref('moderators').get());
  await assertFails(anon.ref('presence').get());
  await assertFails(anon.ref(`chat/${k('m1')}`).set(chatMsg('x')));
  await assertFails(anon.ref('questions/q1/votes').set(1));
  await assertFails(anon.ref().update({ [`pending/x/${k('q')}`]: question(), 'pendingLast/x': stamp(k('q')) }));
});

test('audience: submit a question, privately, with validation and a 20 s limit', async () => {
  await assertSucceeds(askQuestion(alice, 'alice', 'qa'));
  await assertSucceeds(alice.ref('pending/alice').get());
  await assertFails(bob.ref('pending/alice').get());
  await assertFails(bob.ref('pending').get());
  await assertSucceeds(mod.ref('pending').get());

  await assertFails(askQuestion(alice, 'alice', 'qb'), 'second question within 20 s');
  await assertFails(alice.ref('pendingLast/alice').remove(), 'cannot erase own rate limit');
  await assertFails(alice.ref(`pending/alice/${k('qc')}`).set(question()), 'must stamp pendingLast in the same write');

  await assertFails(askQuestion(bob, 'alice', 'qd'), 'cannot write as someone else');
  await assertFails(askQuestion(bob, 'bob', 'q1', question({ text: 'x'.repeat(301) })), 'too long');
  await assertFails(askQuestion(bob, 'bob', 'q2', question({ text: '   ' })), 'blank');
  await assertFails(askQuestion(bob, 'bob', 'q3', question({ name: '' })), 'no name');
  await assertFails(askQuestion(bob, 'bob', 'q4', question({ name: 'n'.repeat(61) })), 'name too long');
  await assertFails(askQuestion(bob, 'bob', 'q5', question({ votes: 99 })), 'extra field');
  await assertFails(askQuestion(bob, 'bob', 'q6', question({ createdAt: 5 })), 'forged time');
  await assertFails(bob.ref('questions/qx').set({ text: 'Self-approved', name: 'B', role: '', votes: 0, answered: false, createdAt: 1 }));
  await assertSucceeds(askQuestion(bob, 'bob', 'q7'));
  await assertFails(bob.ref(`pending/bob/${k('q7')}/text`).set('edited after sending'));
});

test('audience: exactly one upvote per person per question', async () => {
  await assertSucceeds(upvote(alice, 'alice', 'q1'));
  await assertFails(upvote(alice, 'alice', 'q1'), 'second upvote');
  await assertSucceeds(upvote(bob, 'bob', 'q1'));
  await assertFails(alice.ref('questions/q1/votes').set(50), 'direct count write');
  await assertFails(env.authenticatedContext('carol').database().ref('questions/q1/votes').set(INC), 'count without vote record');
  await assertFails(env.authenticatedContext('dave').database().ref('qvotes/dave/q1').set(true), 'vote record without count');
  await assertFails(env.authenticatedContext('erin').database().ref().update({ 'qvotes/erin/q1': true, 'questions/q1/votes': 5 }), 'jumping the count');
  await assertFails(upvote(env.authenticatedContext('frank').database(), 'frank', 'nope'), 'question does not exist');
  await assertFails(alice.ref('qvotes/alice/q1').remove(), 'cannot withdraw and re-vote');
  await assertFails(alice.ref('questions/q1/text').set('defaced'));
  await assertFails(alice.ref('questions/q1/answered').set(true));
});

test('audience: one poll vote, only while the poll is open', async () => {
  await assertSucceeds(votePoll(alice, 'alice', 'p1', 0));
  await assertFails(votePoll(alice, 'alice', 'p1', 1), 'second vote');
  await assertFails(votePoll(bob, 'bob', 'p2', 0), 'closed poll');
  await assertFails(votePoll(bob, 'bob', 'd1', 0), 'draft poll');
  await assertFails(votePoll(bob, 'bob', 'p1', 5), 'option does not exist');
  await assertFails(bob.ref('polls/p1/counts/0').set(INC), 'count without vote record');
  await assertFails(bob.ref('pvotes/bob/p1').set('0'), 'vote record without count');
  await assertFails(bob.ref().update({ 'pvotes/bob/p1': '0', 'polls/p1/counts/1': INC }), 'record and count disagree');
  await assertFails(bob.ref('polls/p1/status').set('closed'));
  await assertFails(bob.ref('polls/p9').set({ question: 'Mine', options: ['a', 'b'], counts: [0, 0], status: 'open', createdAt: 1 }));
  await assertSucceeds(votePoll(bob, 'bob', 'p1', 1));
});

test('audience: chat respects identity, limits, the 3 s floor, slow mode and lock', async () => {
  await assertSucceeds(sendChat(alice, 'alice', 'm1'));
  await assertFails(sendChat(alice, 'alice', 'm2'), 'within 3 s');
  await assertFails(sendChat(bob, 'bob', 'm3', chatMsg('alice')), 'impersonating another uid');
  await assertFails(sendChat(bob, 'bob', 'm4', chatMsg('bob', { text: 'x'.repeat(301) })), 'too long');
  await assertFails(sendChat(bob, 'bob', 'm5', chatMsg('bob', { text: ' ' })), 'blank');
  await assertFails(bob.ref(`chat/${k('m6')}`).set(chatMsg('bob')), 'must stamp chatLast in the same write');
  await assertFails(bob.ref(`chat/${k('m1')}`).remove(), 'cannot delete others\' messages');
  await assertFails(alice.ref(`chat/${k('m1')}/text`).set('edited'), 'cannot edit');
  await assertFails(alice.ref('chatLast/alice').remove(), 'cannot erase own rate limit');

  await sleep(3100);
  await assertSucceeds(sendChat(alice, 'alice', 'm7'));

  await seed({ 'webinar/chatSlowSeconds': 10 });
  await sleep(3100);
  await assertFails(sendChat(alice, 'alice', 'm8'), 'slow mode 10 s');
  await assertSucceeds(sendChat(bob, 'bob', 'm9'), 'first message is not delayed');

  await seed({ 'webinar/chatSlowSeconds': 0, 'webinar/chatLocked': true });
  await assertFails(sendChat(env.authenticatedContext('carol').database(), 'carol', 'm10', chatMsg('carol')), 'chat locked');

  await seed({ 'webinar/chatLocked': false, 'webinar/status': 'ended' });
  await assertFails(sendChat(env.authenticatedContext('dave').database(), 'dave', 'm11', chatMsg('dave')), 'webinar ended');
  await assertFails(askQuestion(env.authenticatedContext('dave').database(), 'dave', 'qz'), 'webinar ended');
});

test('audience cannot touch moderator territory', async () => {
  await assertFails(alice.ref('webinar/status').set('ended'));
  await assertFails(alice.ref('webinar/title').set('Hijacked'));
  await assertFails(alice.ref('webinar/chatLocked').set(true));
  await assertFails(alice.ref('moderators/alice').set(true));
  await assertFails(alice.ref('moderators').get());
  await assertSucceeds(alice.ref('moderators/alice').get());
  await assertFails(alice.ref('pollDrafts/x').set({ question: 'Q', options: ['a', 'b'], counts: [0, 0], status: 'draft', createdAt: 1 }));
  await assertFails(alice.ref('presence').get());
  await assertFails(alice.ref('presence/bob').set(true));
  await assertSucceeds(alice.ref('presence/alice').set(true));
  await assertFails(alice.ref('archive').get());
  await assertFails(alice.ref('archive/1').set({ x: 1 }));
  await assertFails(alice.ref('questions').remove());
  await assertFails(alice.ref('chat').remove());
});

test('moderators can run the room, but cannot make new moderators from the page', async () => {
  await assertSucceeds(askQuestion(alice, 'alice', 'qa'));
  await assertSucceeds(sendChat(alice, 'alice', 'm1'));

  await assertSucceeds(mod.ref('webinar').update({ title: 'New', videoId: 'Ej7bw_v5IxI', status: 'live', chatSlowSeconds: 30, chatLocked: true }));
  await assertFails(mod.ref('webinar/status').set('paused'), 'unknown status');
  await assertFails(mod.ref('webinar/chatSlowSeconds').set(7), 'unknown slow mode');
  await assertSucceeds(mod.ref().update({
    'questions/qa': { text: 'Is exercise useful?', name: 'Dr. A', role: 'Physio', votes: 0, answered: false, createdAt: 5 },
    [`pending/alice/${k('qa')}`]: null,
  }));
  await assertSucceeds(mod.ref('questions/qa/answered').set(true));
  await assertSucceeds(mod.ref('questions/qa').remove());
  await assertSucceeds(mod.ref(`chat/${k('m1')}`).remove());
  await assertSucceeds(mod.ref('pollDrafts/d2').set({ question: 'Q', options: ['a', 'b'], counts: [0, 0], status: 'draft', createdAt: 1 }));
  await assertSucceeds(mod.ref('pollDrafts').get());
  await assertSucceeds(mod.ref().update({ 'polls/d1': { question: 'Draft?', options: ['a', 'b'], counts: [0, 0], status: 'open', createdAt: 3 }, 'pollDrafts/d1': null }));
  await assertSucceeds(mod.ref('polls/d1/status').set('closed'));
  await assertSucceeds(mod.ref('presence').get());
  await assertSucceeds(mod.ref().update({
    'archive/123': { questions: { q1: { text: 'a' } } },
    questions: null, qvotes: null, polls: null, pollDrafts: null, pvotes: null,
    chat: null, chatLast: null, pending: null, pendingLast: null,
    webinar: null,
  }));
  await assertFails(mod.ref('moderators/alice').set(true));
  await assertFails(mod.ref('moderators').get());
});

test('one message or question per write: a batch cannot slip past the rate limit', async () => {
  // Several messages with a single stamp: the stamp can name only one of them.
  await assertFails(alice.ref().update({
    [`chat/${k('b1')}`]: chatMsg('alice'),
    [`chat/${k('b2')}`]: chatMsg('alice'),
    'chatLast/alice': stamp(k('b1')),
  }), 'two chat messages in one write');
  await assertFails(alice.ref().update({
    [`pending/alice/${k('b1')}`]: question(),
    [`pending/alice/${k('b2')}`]: question(),
    'pendingLast/alice': stamp(k('b1')),
  }), 'two questions in one write');

  // Hand-picked keys that would sort after every real message, or be huge.
  const custom = (key) => alice.ref().update({ [`chat/${key}`]: chatMsg('alice'), 'chatLast/alice': stamp(key) });
  await assertFails(custom('~~~~pinned-to-bottom'), 'key not shaped like a push id');
  await assertFails(custom(`-${'x'.repeat(700)}`), 'oversized key');
  await assertFails(alice.ref().update({ 'pending/alice/q1': question(), 'pendingLast/alice': stamp('q1') }), 'pending key not shaped like a push id');
  await assertFails(alice.ref('chatLast/alice').set({ at: TS, id: 'x'.repeat(200) }), 'oversized stamp');
  await assertFails(alice.ref('chatLast/alice').set({ at: 5, id: k('z') }), 'backdated stamp');

  await assertSucceeds(sendChat(alice, 'alice', 'ok'));
  await assertSucceeds(anon.ref('chat').orderByChild('createdAt').limitToLast(100).get());
});
