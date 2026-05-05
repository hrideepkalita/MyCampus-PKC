import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDDYBiZbATRtNs-LXWYrW6Gc3SczBk7SAQ",
  authDomain: "mycampus-48b3e.firebaseapp.com",
  projectId: "mycampus-48b3e",
  storageBucket: "mycampus-48b3e.firebasestorage.app",
  messagingSenderId: "986139018819",
  appId: "1:986139018819:web:9840a821d5586bb52176f6",
  measurementId: "G-MLDNJXBPYV",
};

const app = initializeApp(firebaseConfig);

let messagingInstance: ReturnType<typeof getMessaging> | null = null;

export async function getFirebaseMessaging() {
  if (messagingInstance) return messagingInstance;
  const supported = await isSupported();
  if (!supported) return null;
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

export { getToken, onMessage };
