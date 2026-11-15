import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIMITS, cleanText, parseYouTubeId, sortQuestions, pollPercentages,
  countdownParts, chatWaitSeconds, displayName,
} from '../assets/js/live/logic.js';

test('cleanText trims and enforces limits', () => {
  assert.equal(cleanText('  hi  ', 300), 'hi');
  assert.equal(cleanText('   ', 300), null);
  assert.equal(cleanText('x'.repeat(301), 300), null);
  assert.equal(cleanText('x'.repeat(300), 300).length, 300);
  assert.equal(cleanText(undefined, 300), null);
  assert.equal(cleanText(42, 300), null);
});

test('parseYouTubeId accepts ids and common URL shapes', () => {
  const id = 'Ej7bw_v5IxI';
  assert.equal(parseYouTubeId(id), id);
  assert.equal(parseYouTubeId(`https://www.youtube.com/watch?v=${id}&t=3`), id);
  assert.equal(parseYouTubeId(`https://youtu.be/${id}`), id);
  assert.equal(parseYouTubeId(`https://youtu.be/${id}?si=abc`), id);
  assert.equal(parseYouTubeId(`https://www.youtube.com/live/${id}`), id);
  assert.equal(parseYouTubeId(`https://www.youtube.com/embed/${id}`), id);
  assert.equal(parseYouTubeId(`  ${id}  `), id);
  assert.equal(parseYouTubeId('hello'), null);
  assert.equal(parseYouTubeId(''), null);
  assert.equal(parseYouTubeId(`https://evil.example/watch?v=${id}`), null);
});

test('sortQuestions orders by votes then age and separates answered', () => {
  const list = [
    { id: 'a', votes: 2, createdAt: 1, answered: false },
    { id: 'b', votes: 5, createdAt: 2, answered: false },
    { id: 'c', votes: 2, createdAt: 0, answered: false },
    { id: 'd', votes: 9, createdAt: 3, answered: true },
  ];
  const { open, answered } = sortQuestions(list);
  assert.deepEqual(open.map((q) => q.id), ['b', 'c', 'a']);
  assert.deepEqual(answered.map((q) => q.id), ['d']);
});

test('pollPercentages sums to 100 or is all zero', () => {
  assert.equal(pollPercentages([1, 1, 1]).reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(pollPercentages([0, 0]), [0, 0]);
  assert.deepEqual(pollPercentages([3, 1]), [75, 25]);
  assert.deepEqual(pollPercentages([]), []);
});

test('countdownParts clamps and splits', () => {
  assert.deepEqual(countdownParts(-5), { days: 0, hours: 0, minutes: 0, seconds: 0 });
  assert.deepEqual(countdownParts(90061000), { days: 1, hours: 1, minutes: 1, seconds: 1 });
});

test('chatWaitSeconds applies the floor and slow mode', () => {
  assert.equal(LIMITS.chatFloor, 3);
  assert.equal(chatWaitSeconds(10000, 9000, 0), 2);
  assert.equal(chatWaitSeconds(100000, 9000, 30), 0);
  assert.equal(chatWaitSeconds(20000, 9000, 30), 19);
  assert.equal(chatWaitSeconds(20000, 0, 30), 0);
});

test('displayName joins name and role', () => {
  assert.equal(displayName('Dr. A', 'Physiotherapist'), 'Dr. A · Physiotherapist');
  assert.equal(displayName('Dr. A', ''), 'Dr. A');
});
