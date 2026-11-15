/**
 * Runs the shared store contract against the real Firebase store, talking to
 * the local emulators. Run with `npm run test:firebase` (needs Java).
 * Slow by design: rate limits are waited out in real time.
 */
import * as app from 'firebase/app';
import * as auth from 'firebase/auth';
import * as database from 'firebase/database';
import { readFileSync } from 'node:fs';
import { runContract } from './store-contract.test.mjs';
import { createFirebaseStore } from '../assets/js/live/firebase-store.js';

const PROJECT = 'demo-physiohead';
const NS = `${PROJECT}-default-rtdb`;
const [dbHost, dbPort] = (process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000').split(':');
const authUrl = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'}`;
const config = { apiKey: 'demo-key', projectId: PROJECT, databaseURL: `http://${dbHost}:${dbPort}?ns=${NS}` };
const emulator = { databaseHost: dbHost, databasePort: Number(dbPort), authUrl };
const rules = readFileSync(new URL('../firebase/database.rules.json', import.meta.url), 'utf8');

const admin = (path, body, method = 'PUT') => fetch(`http://${dbHost}:${dbPort}/${path}?ns=${NS}`, {
  method, headers: { Authorization: 'Bearer owner' }, body: typeof body === 'string' ? body : JSON.stringify(body),
}).then(async (res) => { if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`); });

let counter = 0;
runContract('firebase store', async () => {
  counter += 1;
  await admin('.settings/rules.json', rules);
  await admin('.json', null);
  const make = (label) => createFirebaseStore({ config, sdk: { app, auth, database }, emulator, appName: `${label}-${counter}` });
  const [a, b, mod] = await Promise.all([make('a'), make('b'), make('mod')]);
  await Promise.all([a.ready(), b.ready(), mod.ready()]);

  // Create a moderator account in the Auth emulator and put it on the list.
  const helper = app.initializeApp(config, `helper-${counter}`);
  const helperAuth = auth.getAuth(helper);
  auth.connectAuthEmulator(helperAuth, authUrl, { disableWarnings: true });
  const email = `mod${counter}-${Date.now()}@physiohead.test`;
  const { user } = await auth.createUserWithEmailAndPassword(helperAuth, email, 'correct-horse');
  await admin(`moderators/${user.uid}.json`, true);
  await app.deleteApp(helper);
  await mod.signIn(email, 'correct-horse');

  return {
    a, b, mod,
    advance: (ms) => new Promise((r) => setTimeout(r, ms)),
    close: () => Promise.all([a.close(), b.close(), mod.close()]),
  };
});
