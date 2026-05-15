import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDnNLsCZT9fEDv8kKzZYqfgnTn9v1DFlEc",
  authDomain: "astique-mounjaro.firebaseapp.com",
  projectId: "astique-mounjaro",
  storageBucket: "astique-mounjaro.firebasestorage.app",
  messagingSenderId: "979724494631",
  appId: "1:979724494631:web:588ab72c09f2240177ab02",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
