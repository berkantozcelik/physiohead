/**
 * Writes firebase/database.rules.json. The rules are assembled here from
 * named pieces because the same conditions repeat many times; edit this file
 * and run `node firebase/build-rules.mjs`, then `npm run test:rules`.
 */
import { writeFileSync } from 'node:fs';

const MOD = "auth != null && root.child('moderators').child(auth.uid).val() === true";
const SELF = 'auth != null && auth.uid === $uid';
const NOT_ENDED = "root.child('webinar/status').val() !== 'ended'";
const text = (max) => `newData.isString() && newData.val().length <= ${max} && newData.val().matches(/[^ ]/)`; // at least one character that is not a space
const optionalText = (max) => `newData.isString() && newData.val().length <= ${max}`;
const oneOf = (...values) => values.map((v) => `newData.val() === ${JSON.stringify(v).replace(/"/g, "'")}`).join(' || ');
const NO = { '.validate': false };

// "newData at the database root" as seen from N levels down.
const up = (levels) => `newData${'.parent()'.repeat(levels)}`;

// Keys people create must look like Firebase push ids ("-" + 19 url-safe
// characters). This stops hand-picked keys that are huge or sort last forever.
const pushId = (v) => `${v}.length === 20 && ${v}.matches(/^-[A-Za-z0-9_-]+$/)`;

// "When did this person last post, and which item was it?" Naming the item
// means one write can carry only one message or question.
const lastStamp = {
  '.write': MOD,
  $uid: {
    '.read': SELF,
    '.write': `${SELF} && newData.hasChildren(['at', 'id'])`,
    at: { '.validate': 'newData.val() === now' },
    id: { '.validate': 'newData.isString() && newData.val().length === 20' },
    $other: NO,
  },
};

const rules = {
  '.read': false,
  '.write': false,

  // Webinar settings: everyone reads, only moderators change.
  webinar: {
    '.read': true,
    '.write': MOD,
    title: { '.validate': optionalText(160) },
    startsAt: { '.validate': 'newData.isNumber()' },
    speakers: { '.validate': optionalText(300) },
    description: { '.validate': optionalText(1500) },
    videoId: { '.validate': "newData.isString() && (newData.val() === '' || (newData.val().length === 11 && newData.val().matches(/^[A-Za-z0-9_-]+$/)))" },
    status: { '.validate': oneOf('scheduled', 'live', 'ended') },
    chatLocked: { '.validate': 'newData.isBoolean()' },
    chatSlowSeconds: { '.validate': oneOf(0, 10, 30, 60) },
    $other: NO,
  },

  // The moderator list can only be edited in the Firebase console.
  moderators: {
    $uid: { '.read': SELF },
  },

  // Questions waiting for a moderator: private to their author and moderators.
  pending: {
    '.read': MOD,
    '.write': MOD,
    $uid: {
      '.read': SELF,
      $qid: {
        '.write': [
          SELF, '!data.exists()', 'newData.exists()', NOT_ENDED, pushId('$qid'),
          "(!root.child('pendingLast').child($uid).exists() || now - root.child('pendingLast').child($uid).child('at').val() >= 20000)",
          `${up(3)}.child('pendingLast').child($uid).child('at').val() === now`,
          `${up(3)}.child('pendingLast').child($uid).child('id').val() === $qid`,
        ].join(' && '),
        '.validate': "newData.hasChildren(['text', 'name', 'role', 'createdAt'])",
        text: { '.validate': text(300) },
        name: { '.validate': text(60) },
        role: { '.validate': optionalText(60) },
        createdAt: { '.validate': 'newData.val() === now' },
        $other: NO,
      },
    },
  },
  pendingLast: lastStamp,

  // Approved questions: public. The audience may only add one vote each.
  questions: {
    '.read': true,
    '.write': MOD,
    $qid: {
      '.validate': "newData.hasChildren(['text', 'name', 'role', 'votes', 'answered', 'createdAt'])",
      text: { '.validate': text(300) },
      name: { '.validate': text(60) },
      role: { '.validate': optionalText(60) },
      answered: { '.validate': 'newData.isBoolean()' },
      createdAt: { '.validate': 'newData.isNumber()' },
      votes: {
        '.write': [
          'auth != null', 'data.exists()', 'newData.val() === data.val() + 1',
          "!root.child('qvotes').child(auth.uid).child($qid).exists()",
          `${up(3)}.child('qvotes').child(auth.uid).child($qid).val() === true`,
        ].join(' && '),
        '.validate': 'newData.isNumber()',
      },
      $other: NO,
    },
  },
  qvotes: {
    '.write': MOD,
    $uid: {
      '.read': SELF,
      $qid: {
        '.write': [
          SELF, '!data.exists()', 'newData.val() === true',
          "root.child('questions').child($qid).child('votes').exists()",
          `${up(3)}.child('questions').child($qid).child('votes').val() === root.child('questions').child($qid).child('votes').val() + 1`,
        ].join(' && '),
      },
    },
  },

  // Launched polls: public. Drafts live in pollDrafts until launched.
  polls: {
    '.read': true,
    '.write': MOD,
    $pid: {
      status: { '.validate': oneOf('open', 'closed') },
      counts: {
        $idx: {
          '.write': [
            'auth != null', 'data.exists()',
            "data.parent().parent().child('status').val() === 'open'",
            'newData.val() === data.val() + 1',
            "!root.child('pvotes').child(auth.uid).child($pid).exists()",
            `${up(4)}.child('pvotes').child(auth.uid).child($pid).val() === $idx`,
          ].join(' && '),
          '.validate': 'newData.isNumber()',
        },
      },
    },
  },
  pollDrafts: { '.read': MOD, '.write': MOD },
  pvotes: {
    '.write': MOD,
    $uid: {
      '.read': SELF,
      $pid: {
        '.write': [
          SELF, '!data.exists()', 'newData.isString()',
          "root.child('polls').child($pid).child('status').val() === 'open'",
          "root.child('polls').child($pid).child('counts').child(newData.val()).exists()",
          `${up(3)}.child('polls').child($pid).child('counts').child(newData.val()).val() === root.child('polls').child($pid).child('counts').child(newData.val()).val() + 1`,
        ].join(' && '),
      },
    },
  },

  // Chat: public. One new message at a time, as yourself, respecting the
  // 3-second floor, slow mode and the pause switch.
  chat: {
    '.read': true,
    '.write': MOD,
    '.indexOn': ['createdAt'], // newest 100 are chosen by server time, not by key
    $mid: {
      '.write': [
        'auth != null', '!data.exists()', 'newData.exists()',
        "newData.child('uid').val() === auth.uid",
        NOT_ENDED, pushId('$mid'),
        "root.child('webinar/chatLocked').val() !== true",
        "(!root.child('chatLast').child(auth.uid).exists() || (now - root.child('chatLast').child(auth.uid).child('at').val() >= 3000 && (!root.child('webinar/chatSlowSeconds').isNumber() || now - root.child('chatLast').child(auth.uid).child('at').val() >= root.child('webinar/chatSlowSeconds').val() * 1000)))",
        `${up(2)}.child('chatLast').child(auth.uid).child('at').val() === now`,
        `${up(2)}.child('chatLast').child(auth.uid).child('id').val() === $mid`,
      ].join(' && '),
      '.validate': "newData.hasChildren(['uid', 'name', 'role', 'text', 'createdAt'])",
      uid: { '.validate': 'newData.isString()' },
      text: { '.validate': text(300) },
      name: { '.validate': text(60) },
      role: { '.validate': optionalText(60) },
      createdAt: { '.validate': 'newData.val() === now' },
      $other: NO,
    },
  },
  chatLast: lastStamp,

  // Who is connected: each browser marks itself; only moderators can count.
  presence: {
    '.read': MOD,
    $uid: { '.write': SELF, '.validate': 'newData.val() === true' },
  },

  // Past webinars' questions and polls, kept when the room is reset.
  archive: { '.read': MOD, '.write': MOD },
};

writeFileSync(new URL('./database.rules.json', import.meta.url), `${JSON.stringify({ rules }, null, 2)}\n`);
console.log('Wrote firebase/database.rules.json');
