import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCIoSibuapjHpNpru0596lQxUOLf4rJyiA",
  authDomain: "dekatan-2026.firebaseapp.com",
  projectId: "dekatan-2026",
  storageBucket: "dekatan-2026.firebasestorage.app",
  messagingSenderId: "113834248341",
  appId: "1:113834248341:web:6653065584a8846961b39c",
  measurementId: "G-L4T5GJCXMS"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);