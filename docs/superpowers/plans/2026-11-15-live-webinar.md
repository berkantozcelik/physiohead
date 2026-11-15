# PhysioHead Live Webinars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live page, moderator page and speaker view on the static PhysioHead site that play a YouTube-relayed Zoom broadcast and carry moderated Q&A, polls and chat for 800–900 viewers.

**Architecture:** Three static HTML pages share one data-store interface with two interchangeable back ends: an in-browser demo store (localStorage + BroadcastChannel) and a Firebase Realtime Database store. Page controllers only talk to the interface, so everything is buildable and verifiable in demo mode before a Firebase project exists. Security lives in database rules, tested with the Firebase emulator.

**Tech Stack:** Plain HTML/CSS/ES modules, no build step. Firebase JS SDK (app, auth, database) from `https://www.gstatic.com/firebasejs/<version>/`, pinned to the version `npm view firebase version` reports at build time. Dev-only: Node 22 `node --test`, `firebase-tools`, `@firebase/rules-unit-testing`.

**Spec:** `docs/superpowers/specs/2026-11-15-live-webinar-design.md`

## Global Constraints

- No React, Tailwind or bundler. Pages must work when served as static files (`python3 -m http.server 8765`).
- Use existing tokens from `assets/css/styles.css` (`--forest`, `--sea`, `--clay`, `--ink`, `--paper`, `--mist`, `--font-title`, `--font-sans`, radii, shadows). New styles go in `assets/css/live.css` only.
- Header, nav and footer markup copied from `activities.html`. No new main-nav item.
- Interface text in English.
- All user-supplied text is rendered with `textContent`, never `innerHTML`.
- Limits: question 300 chars, chat 300 chars, name 60, profession 60, poll question 200, poll option 80, 2–6 poll options. Slow mode values 0, 10, 30, 60 seconds; a 3 s floor always applies to chat and a 20 s floor to question submission.
- Chat shows the last 100 messages.
- Video is embedded from `https://www.youtube-nocookie.com/embed/<id>`.
- If the store fails or disconnects, the video keeps playing and the panel shows "Q&A is temporarily unavailable".
- No commits: the owner has not asked for any. Leave changes in the working tree on `main`.

## Review Focus

1. Name, profession, question or chat containing HTML (`<img onerror=…>`): shown as literal text. → Task 3 browser check.
2. Moderator pastes a full YouTube URL (watch, youtu.be, live, embed) instead of an ID: the ID is extracted. → Task 1 test.
3. Double-click or repeated upvote / poll vote from one person: counted once. → Task 2 contract test, Task 6 rules test.
4. Viewer's clock is wrong: countdown still ends when the moderator presses Go live, because state comes from the store, not the clock. → Task 3 browser check.
5. Whitespace-only or over-length text: rejected with a visible message, nothing stored. → Task 1 test, Task 6 rules test.

---

## File Structure

| File | Responsibility |
|---|---|
| `live.html`, `live-moderator.html`, `live-speaker.html` | Page markup |
| `assets/css/live.css` | All live-section styles |
| `assets/js/live/logic.js` | Pure functions, no DOM, no store |
| `assets/js/live/demo-store.js` | In-browser store |
| `assets/js/live/firebase-store.js` | Firebase store |
| `assets/js/live/store.js` | `createStore()`: picks demo or Firebase |
| `assets/js/live/config.js` | `export const firebaseConfig = null` until the owner fills it in |
| `assets/js/live/player.js` | Video embed |
| `assets/js/live/dom.js` | `el(tag, props, children)`, `formatTime` helpers |
| `assets/js/live/audience.js`, `moderator.js`, `speaker.js` | Page controllers |
| `firebase/database.rules.json`, `firebase.json` | Security rules, emulator config |
| `tests/logic.test.mjs`, `tests/store-contract.test.mjs`, `tests/rules.test.mjs` | Tests |
| `package.json` | Dev dependencies and test scripts only |
| `docs/live-webinar-setup.md` | Owner's step-by-step guide |
| `activities.html`, `assets/js/activities.js` | Live / upcoming card |

## Shared types (used by every task)

```js
// Webinar | null
{ title, startsAt /* ms epoch */, speakers, description, videoId,
  status /* 'scheduled' | 'live' | 'ended' */, chatLocked /* bool */, chatSlowSeconds /* 0|10|30|60 */ }
// Question
{ id, text, name, role, votes, answered, createdAt }
// Poll
{ id, question, options /* string[] */, counts /* number[] */, status /* 'draft' | 'open' | 'closed' */, createdAt }
// ChatMessage
{ id, uid, name, role, text, createdAt }
```

Store interface. Every `on*` takes a callback, fires immediately with current data, and returns an unsubscribe function. Every action returns a Promise that rejects with an `Error` whose `code` is one of `'invalid' | 'too-fast' | 'locked' | 'denied' | 'offline'`.

```js
ready()                       // Promise<{ uid }>
onConnection(cb /* bool */)
onWebinar(cb)  onQuestions(cb)  onMyPending(cb)  onMyVotes(cb /* Set<qid> */)
onPolls(cb)    onMyPollVotes(cb /* Map<pid, idx> */)   onChat(cb)
submitQuestion({ text, name, role })   upvote(qid)
votePoll(pid, idx)                     sendChat({ text, name, role })
// moderator
signIn(email, password)  signOut()  onModerator(cb /* bool */)
saveWebinar(partial)  setStatus(status)  resetRoom()
onPending(cb /* (Question & { uid })[] */)  approve(pending)  reject(pending)
markAnswered(qid, bool)  removeQuestion(qid)
deleteChat(mid)  setChat({ locked, slowSeconds })
createPoll({ question, options })  setPollStatus(pid, status)  deletePoll(pid)
onPresenceCount(cb /* number */)
```

---

### Task 1: Pure logic

**Files:** Create `assets/js/live/logic.js`, `tests/logic.test.mjs`, `package.json` (`"type": "module"`, script `"test": "node --test tests/logic.test.mjs tests/store-contract.test.mjs"`). Add `node_modules/` to `.gitignore`.

**Interfaces — Produces:**

```js
LIMITS = { question: 300, chat: 300, name: 60, role: 60, pollQuestion: 200, pollOption: 80, pollMin: 2, pollMax: 6, chatFloor: 3, questionFloor: 20 }
cleanText(value, max)            // trimmed string, or null if empty or longer than max
parseYouTubeId(input)            // 11-char id from id / watch?v= / youtu.be/ / live/ / embed/ URL, else null
sortQuestions(list)              // { open: Question[], answered: Question[] } open by votes desc then createdAt asc
pollPercentages(counts)          // integers summing to 100 (largest remainder), all 0 when no votes
countdownParts(msRemaining)      // { days, hours, minutes, seconds }, clamped at 0
chatWaitSeconds(now, lastSentAt, slowSeconds) // seconds still to wait, using max(slowSeconds, LIMITS.chatFloor)
displayName(name, role)          // "Name · Role", or "Name" when role empty
```

- [ ] **Step 1:** Write `tests/logic.test.mjs` with these assertions: `cleanText('  hi  ', 300) === 'hi'`; `cleanText('   ', 300) === null`; `cleanText('x'.repeat(301), 300) === null`; `parseYouTubeId` returns `'Ej7bw_v5IxI'` for the bare id, `https://www.youtube.com/watch?v=Ej7bw_v5IxI&t=3`, `https://youtu.be/Ej7bw_v5IxI`, `https://www.youtube.com/live/Ej7bw_v5IxI`, `https://www.youtube.com/embed/Ej7bw_v5IxI`, and `null` for `'hello'`; `sortQuestions` puts 5 votes before 2, older first on ties, answered in its own list; `pollPercentages([1,1,1])` sums to 100; `pollPercentages([0,0])` is `[0,0]`; `countdownParts(-5)` is all zeros; `countdownParts(90061000)` is `{days:1,hours:1,minutes:1,seconds:1}`; `chatWaitSeconds(10000, 9000, 0) === 2`; `chatWaitSeconds(100000, 9000, 30) === 0`.
- [ ] **Step 2:** Run `node --test tests/logic.test.mjs`. Expected: fails, module not found.
- [ ] **Step 3:** Implement `logic.js`.
- [ ] **Step 4:** Run again. Expected: all pass.

### Task 2: Demo store and store contract

**Files:** Create `assets/js/live/demo-store.js`, `assets/js/live/store.js`, `assets/js/live/config.js`, `tests/store-contract.test.mjs`.

**Interfaces — Consumes:** `LIMITS`, `cleanText` from Task 1.
**Produces:** `createDemoStore({ storage, channel, uid, now })` implementing the full store interface (all four arguments injectable for tests; defaults are `localStorage`, `new BroadcastChannel('physiohead-live-demo')`, a random id kept in `sessionStorage`, `Date.now`). In demo mode `signIn` accepts any email with password `demo`. State is one JSON blob under the key `physiohead-live-demo`; when it is absent the store seeds a sample webinar (status `live`, videoId `Ej7bw_v5IxI`), four approved questions, one open poll and six chat messages. `createStore()` in `store.js` returns the demo store when the URL has `?demo=1` or `firebaseConfig` is `null`, otherwise dynamically imports `firebase-store.js`.

- [ ] **Step 1:** Write `tests/store-contract.test.mjs` exporting `runContract(name, makeTwoClients)` and calling it for the demo store with an in-memory storage and channel shared by two clients (different uids). Assertions: a question submitted by A appears in A's `onMyPending` and in the moderator's `onPending`, not in `onQuestions`; after `approve` it is in B's `onQuestions` with `votes === 0`; B upvoting twice leaves `votes === 1`; `markAnswered` sets `answered`; `votePoll` twice by the same client counts once and a draft or closed poll rejects with `code === 'locked'`; `sendChat` twice within 3 s rejects with `'too-fast'`; with `setChat({ locked: true })` `sendChat` rejects with `'locked'`; whitespace text rejects with `'invalid'`; a second `submitQuestion` within 20 s rejects with `'too-fast'`; moderator actions from a non-moderator reject with `'denied'`; `onChat` never delivers more than 100 messages; `resetRoom` empties questions, pending, polls and chat and sets status `'scheduled'`.
- [ ] **Step 2:** Run `npm test`. Expected: contract tests fail, module not found.
- [ ] **Step 3:** Implement `demo-store.js`, `store.js`, `config.js`.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.

### Task 3: Live page (audience)

**Files:** Create `live.html`, `assets/css/live.css`, `assets/js/live/player.js`, `assets/js/live/dom.js`, `assets/js/live/audience.js`.

**Interfaces — Consumes:** store interface, Task 1 functions.
**Produces:** `mountPlayer(container, { provider: 'youtube', videoId, title })` returning `{ destroy() }`; `el()` and `formatTime()` in `dom.js`; CSS classes prefixed `live-` reused by Tasks 4 and 5 (`live-panel`, `live-tabs`, `live-tab`, `live-question`, `live-poll`, `live-chat-message`, `live-badge`, `live-empty`).

Layout and states exactly as the spec's "Live page" section: two columns 68/32 from 960 px up, sticky player with the panel filling the remaining viewport height below that; dark navy surround behind the player; LIVE badge with a pulsing red dot that respects `prefers-reduced-motion`; tabs Q&A (default), Polls, Chat with the same keyboard behaviour as `.hub-tab` in `assets/js/activities.js`; a dot on the Polls tab while an open poll is unanswered. The name and profession form appears inline in the panel the first time a person tries to post, and the values are stored under `localStorage['physiohead-live-profile']` (the page must still work if `localStorage` throws). Errors by code: `too-fast` → "Please wait N seconds", `locked` → "Chat is paused by the moderators", `invalid` → "Please enter up to 300 characters", otherwise "Something went wrong. Please try again."

- [ ] **Step 1:** Build markup, styles and controller.
- [ ] **Step 2:** Start the `static` preview server and open `live.html?demo=1`. Check: no console errors; player iframe present; submitting a question shows "Awaiting moderator"; upvote count changes once; voting shows bars summing to 100%; chat message appears and a second one within 3 s shows the wait message.
- [ ] **Step 3:** Review Focus 1: post name and question `<img src=x onerror=alert(1)>`; expected: shown as literal text, no alert.
- [ ] **Step 4:** Review Focus 4: in the console set the demo webinar to `scheduled` with `startsAt` one hour ahead (countdown shown), then `setStatus('live')` from a second tab; expected: first tab switches to the player without reload.
- [ ] **Step 5:** Resize to mobile (375×812): player sticks to top, panel scrolls inside itself, no horizontal scroll. Check `ended` and `null` webinar states render.

### Task 4: Moderator page

**Files:** Create `live-moderator.html`, `assets/js/live/moderator.js`; extend `assets/css/live.css`. Add `<meta name="robots" content="noindex">`.

**Interfaces — Consumes:** store moderator methods, `parseYouTubeId`, `live-` classes.

Sections as in the spec's "Moderator page": sign-in card until `onModerator(true)`; webinar setup form (`datetime-local` for start, video field accepts URL or ID and shows "Not a valid YouTube link" when `parseYouTubeId` returns null); Go live (disabled without a valid video), End webinar, Reset for next webinar (both behind a `confirm`); question queue with Pending / Approved / Answered groups; chat list with delete, slow-mode select and lock toggle; poll builder with add/remove option rows; "People connected now".

- [ ] **Step 1:** Build the page.
- [ ] **Step 2:** With `live.html?demo=1` open in one tab and `live-moderator.html?demo=1` in another: sign in with password `demo`; approve a question submitted from the audience tab and see it appear there; mark answered; delete a chat message; lock chat and see the audience input disabled; create and launch a poll and see the dot on the audience Polls tab; press End and see the replay state. No console errors.

### Task 5: Speaker view and Activities card

**Files:** Create `live-speaker.html`, `assets/js/live/speaker.js`; modify `activities.html` (insert card container at the top of `#panel-webinars`, add `<script type="module">` for the card), `assets/js/activities.js` untouched unless needed; extend `assets/css/live.css`.

Speaker view: no site header or footer, dark background, questions at 1.6 rem minimum, open questions only, most upvoted first, active poll results beneath; `noindex`. Activities card: reads `onWebinar`; shows "Live now" with the LIVE badge when `live`, "Next webinar · <date>" when `scheduled`, nothing when `ended` or null or when the store fails; links to `live.html`.

- [ ] **Step 1:** Build both.
- [ ] **Step 2:** Verify in demo mode: speaker view updates when the moderator approves or marks answered; the Activities card reflects each status; `activities.html` still has no console errors and the existing video dialog still opens.

### Task 6: Firebase store and security rules

**Files:** Create `assets/js/live/firebase-store.js`, `firebase/database.rules.json`, `firebase.json`, `tests/rules.test.mjs`; add dev dependencies `firebase-tools`, `@firebase/rules-unit-testing`, `firebase` and script `"test:rules": "firebase emulators:exec --only database --project demo-physiohead 'node --test tests/rules.test.mjs'"`.

**Database paths:**

```
/webinar                     Webinar
/moderators/{uid}            true   (written only from the Firebase console)
/pending/{uid}/{qid}         { text, name, role, createdAt }
/pendingLast/{uid}           server timestamp
/questions/{qid}             { text, name, role, votes, answered, createdAt }
/qvotes/{qid}/{uid}          true
/polls/{pid}                 { question, options, counts, status, createdAt }
/pvotes/{pid}/{uid}          option index
/chat/{mid}                  { uid, name, role, text, createdAt }
/chatLast/{uid}              server timestamp
/presence/{uid}              true, removed on disconnect
/archive/{resetTimestamp}    { webinar, questions, polls }
```

Audience signs in with `signInAnonymously`; moderators with `signInWithEmailAndPassword`. An upvote is one multi-path `update` writing `qvotes/{qid}/{uid}: true` and `questions/{qid}/votes: increment(1)`; a poll vote likewise with `pvotes` and `polls/{pid}/counts/{idx}`; a chat message writes `chat/{mid}` and `chatLast/{uid}` together; a question writes `pending/{uid}/{qid}` and `pendingLast/{uid}` together. `onChat` uses `limitToLast(100)`. `onPresenceCount` is only subscribed on the moderator page. Map Firebase `PERMISSION_DENIED` to the store error codes by checking the same conditions client-side first (`too-fast`, `locked`, `invalid`), falling back to `denied`.

- [ ] **Step 1:** Write `tests/rules.test.mjs` asserting, against the emulator: unauthenticated read of `/questions` succeeds and any write fails; anonymous user can write own `/pending/{uid}` with valid fields, cannot read another user's pending, cannot write `/questions`; text of 301 chars or whitespace only fails; a second pending question within 20 s fails; the upvote multi-path update succeeds once and fails the second time; writing `votes` without the matching `qvotes` entry fails; `votes` +2 fails; poll vote succeeds once on an `open` poll and fails on `draft` and `closed`; chat write fails when `chatLocked`, fails within the slow window, fails with a `uid` that is not the writer's, succeeds otherwise; non-moderator cannot write `/webinar`, `/polls`, `/moderators`, delete `/chat/{mid}` or read `/presence`; a uid listed in `/moderators` can do all of those.
- [ ] **Step 2:** Run `npm run test:rules`. Expected: fails (no rules). If Java is not installed the emulator cannot start: stop and report it, do not skip silently.
- [ ] **Step 3:** Write `database.rules.json` and `firebase.json`.
- [ ] **Step 4:** Run `npm run test:rules`. Expected: all pass.
- [ ] **Step 5:** Implement `firebase-store.js`. In `tests/store-contract.test.mjs`, run `runContract` against it when `FIREBASE_DATABASE_EMULATOR_HOST` is set; add script `"test:firebase"` that runs the contract inside `firebase emulators:exec --only database,auth`. Expected: the same contract passes for both stores.

### Task 7: Owner's setup guide

**Files:** Create `docs/live-webinar-setup.md`.

Plain-language, numbered, covering in order: enabling custom live streaming in Zoom settings; enabling live streaming on the YouTube channel and creating an unlisted stream with embedding allowed and "not made for kids"; creating the Firebase project, enabling Realtime Database, Anonymous and Email/Password sign-in, switching to pay-as-you-go, setting a $5 budget alert; pasting the web config into `assets/js/live/config.js`; publishing the rules (`npx firebase deploy --only database`); creating moderator accounts and adding their UIDs under `/moderators`; restricting the API key to the site's domain; the test-broadcast checklist; the webinar-day checklist (the five steps from the spec). State plainly which steps cost money and that pricing must be checked on the Firebase pricing page.

- [ ] **Step 1:** Write the guide.
- [ ] **Step 2:** Read it against the spec's "What Berkant has to do" list; every item has a step.
