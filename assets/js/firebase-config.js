// =========================
// FIREBASE CONFIG
// =========================
// Substitua pelos dados do seu projeto Firebase

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAfQGrI07a86emLRfuV8BzirDCmpZ2iY8A",
    authDomain: "loja-suplementos-bbf94.firebaseapp.com",
    projectId: "loja-suplementos-bbf94",
    storageBucket: "loja-suplementos-bbf94.firebasestorage.app",
    messagingSenderId: "796012758779",
    appId: "1:796012758779:web:537934e50fdd1aac34125e"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

export { db, auth, collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy,
         signInWithEmailAndPassword, signOut, onAuthStateChanged };
