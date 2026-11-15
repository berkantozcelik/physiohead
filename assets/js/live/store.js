/**
 * PhysioHead Live - picks the data store.
 * Preview store when the address has ?demo=1 or no Firebase settings exist;
 * otherwise the real Firebase store.
 */
import { firebaseConfig } from './config.js';

export function isDemoMode() {
  const forced = new URLSearchParams(window.location.search).get('demo') === '1';
  return forced || !firebaseConfig;
}

export async function createStore() {
  if (isDemoMode()) {
    const { createDemoStore } = await import('./demo-store.js');
    return createDemoStore();
  }
  const { createFirebaseStore } = await import('./firebase-store.js');
  return createFirebaseStore({ config: firebaseConfig });
}
