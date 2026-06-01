import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCTBndVpqemfFBZbXrlaW6N5xgGG9Gk7LQ",
  authDomain: "remontada-1240e.firebaseapp.com",
  projectId: "remontada-1240e",
  storageBucket: "remontada-1240e.firebasestorage.app",
  messagingSenderId: "922091661394",
  appId: "1:922091661394:web:0981d2380040851e73178b",
  measurementId: "G-3JJSPSC4HC"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Optional: Pass the required domain as a hint, though backend enforcement is required.
// googleProvider.setCustomParameters({
//   hd: 'iut-dhaka.edu'
// });

// Function to handle login
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);