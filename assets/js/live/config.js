/**
 * PhysioHead Live - connection settings.
 *
 * These are the Firebase web settings for the physiohead-live project. They
 * only identify the project and are not secret; the security rules published
 * in Firebase are what protect the data (see docs/live-webinar-setup.md).
 *
 * To go back to preview mode (sample data kept in your own browser), set
 * firebaseConfig to null, or add ?demo=1 to a live page address.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyATZrN1_XfRerGLYRWa-7vFJwujVIGIw8s',
  authDomain: 'physiohead-live.firebaseapp.com',
  databaseURL: 'https://physiohead-live-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'physiohead-live',
  storageBucket: 'physiohead-live.firebasestorage.app',
  messagingSenderId: '637094269612',
  appId: '1:637094269612:web:e5979ecebb415d12208509',
};
