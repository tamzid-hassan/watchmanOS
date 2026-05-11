import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Import the Firebase configuration
import firebaseConfig from '../firebase-applet-config.json';

// Fix for cross-site cookie blocking on Vercel with Google Auth Redirect
const config = { ...firebaseConfig };
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  if (!hostname.includes('localhost') && !hostname.includes('run.app')) {
    config.authDomain = hostname;
  }
}

// Initialize Firebase SDK
const app = initializeApp(config);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
