// ═══════════════════════════════════════════════════════════
//  firebase-config.js — спільна конфігурація Firebase і допоміжні функції
//  Використовують: admin.html, materials.html, lesson.html
//  Усі звернення до Firebase (база й вхід) — лише через цей файл.
// ═══════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyASpQTZaka3P-YUJ4tfHNmG-LCI-hQPhAI",
  authDomain: "edvault-d4a7f.firebaseapp.com",
  projectId: "edvault-d4a7f",
  databaseURL: "https://edvault-d4a7f-default-rtdb.firebaseio.com/",
  storageBucket: "edvault-d4a7f.firebasestorage.app",
  messagingSenderId: "181496726566",
  appId: "1:181496726566:web:5a86e78588c9440a0b52e7"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, push, remove, onValue, update }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider,
  signInWithEmailAndPassword, signInWithCredential }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app  = initializeApp(FIREBASE_CONFIG);
const db   = getDatabase(app);
const auth = getAuth(app);

// ── Вхід ──────────────────────────────────────────────────
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/** Вхід через Google у спливному вікні → user */
async function signInWithGoogle() {
  return (await signInWithPopup(auth, googleProvider)).user;
}
/** Вхід за email і паролем → user */
async function signInEmail(email, pass) {
  return (await signInWithEmailAndPassword(auth, email, pass)).user;
}
/** Вхід за ID-токеном Google Identity Services → user */
async function signInGoogleIdToken(idToken) {
  return (await signInWithCredential(auth, GoogleAuthProvider.credential(idToken))).user;
}
async function authSignOut() { await signOut(auth); }
/** Підписка на зміну користувача — cb(user | null); повертає функцію відписки */
function onAuth(cb) { return onAuthStateChanged(auth, cb); }

// ── База ──────────────────────────────────────────────────
/** Прочитати шлях один раз → значення або null */
async function dbGet(path) {
  const snap = await get(ref(db, path));
  return snap.exists() ? snap.val() : null;
}
/** Записати (замінити) значення */
async function dbSet(path, value) { await set(ref(db, path), value); }
/** Злити ключі в шляху. З path = '/' і ключами-шляхами — атомарний запис кількох місць */
async function dbUpdate(path, value) { await update(ref(db, path), value); }
/** Додати дочірній елемент з автоключем → ключ */
async function dbPush(path, value) { return (await push(ref(db, path), value)).key; }
async function dbRemove(path) { await remove(ref(db, path)); }
/** Слухати зміни — cb(value) щоразу; повертає функцію відписки */
function dbListen(path, cb) {
  return onValue(ref(db, path), snap => cb(snap.exists() ? snap.val() : null));
}

// ── Допоміжне ─────────────────────────────────────────────
/** Компактний випадковий ID (62^len варіантів) */
function generateId(len = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}
/** { key: {...} } → [{ id: key, ... }] */
function objToArray(obj) {
  if (!obj) return [];
  return Object.entries(obj).map(([id, val]) => ({ id, ...val }));
}

export {
  db, auth,
  dbGet, dbSet, dbUpdate, dbPush, dbRemove, dbListen,
  generateId, objToArray,
  signInWithGoogle, signInEmail, signInGoogleIdToken, authSignOut, onAuth
};
