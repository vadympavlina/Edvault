// ═══════════════════════════════════════════════════════════
//  firebase-config.js  —  Shared Firebase config & utilities
//  Used by: index.html, admin.html, lesson.html
// ═══════════════════════════════════════════════════════════

// ── 🔧 REPLACE WITH YOUR FIREBASE PROJECT CONFIG ──────────
// Go to: Firebase Console → Project Settings → Your Apps → SDK config

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyASpQTZaka3P-YUJ4tfHNmG-LCI-hQPhAI",
  authDomain: "edvault-d4a7f.firebaseapp.com",
  projectId: "edvault-d4a7f",
  databaseURL: "https://edvault-d4a7f-default-rtdb.firebaseio.com/",
  storageBucket: "edvault-d4a7f.firebasestorage.app",
  messagingSenderId: "181496726566",
  appId: "1:181496726566:web:5a86e78588c9440a0b52e7"
};
// ──────────────────────────────────────────────────────────

import { initializeApp }            from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, push, remove, onValue, update }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Initialise Firebase (safe to call from multiple pages)
const app  = initializeApp(FIREBASE_CONFIG);
const db   = getDatabase(app);
const auth = getAuth(app);

// ── Google Auth ───────────────────────────────────────────

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/** Sign in with Google popup → returns user object */
async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

/** Sign out current user */
async function authSignOut() {
  await signOut(auth);
}

/** Listen for auth state changes — cb(user | null) */
function onAuth(cb) {
  return onAuthStateChanged(auth, cb);
}

// ── DB helpers ────────────────────────────────────────────

/** Read a path once → returns snapshot value or null */
async function dbGet(path) {
  const snap = await get(ref(db, path));
  return snap.exists() ? snap.val() : null;
}

/** Write / overwrite a value at an exact path */
async function dbSet(path, value) {
  await set(ref(db, path), value);
}

/** Update (merge) keys at a path */
async function dbUpdate(path, value) {
  await update(ref(db, path), value);
}

/** Push a new child with auto-key → returns the new key string */
async function dbPush(path, value) {
  const r = await push(ref(db, path), value);
  return r.key;
}

/** Delete a node */
async function dbRemove(path) {
  await remove(ref(db, path));
}

/** Real-time listener — calls cb(value) each time data changes.
 *  Returns the unsubscribe function. */
function dbListen(path, cb) {
  const r = ref(db, path);
  onValue(r, snap => cb(snap.exists() ? snap.val() : null));
  // Return an unsubscribe ref for cleanup
  return () => onValue(r, () => {}, { onlyOnce: true });
}

// ── ID generator ─────────────────────────────────────────

/**
 * Generates a compact, URL-safe alphanumeric ID.
 * Uses crypto.getRandomValues for real randomness.
 * Default length = 10 chars  →  62^10 ≈ 8.4 × 10^17 combinations
 *
 * Example: "aB3mK9pX2r"
 */
function generateId(len = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const arr   = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

// ── Object ↔ array converters ─────────────────────────────

/**
 * Firebase stores objects with push-keys as keys.
 * This converts { key1: {...}, key2: {...} } → [{id:'key1',...}, {id:'key2',...}]
 */
function objToArray(obj) {
  if (!obj) return [];
  return Object.entries(obj).map(([id, val]) => ({ id, ...val }));
}

// ── Exports ───────────────────────────────────────────────

export {
  db, auth,
  dbGet, dbSet, dbUpdate, dbPush, dbRemove, dbListen,
  generateId,
  objToArray,
  signInWithGoogle, authSignOut, onAuth
};
