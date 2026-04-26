# 📚 Навчальний Портал — Learning Materials Portal

A serverless learning materials portal built with Vanilla JS + Firebase Realtime Database, hosted on GitHub Pages.

---

## 🗂 Project File Structure

```
/
├── index.html              ← Public portal (subjects & lessons browse)
├── admin.html              ← Admin panel (Step 2 & 3)
├── lesson.html             ← Lesson viewer (Step 4)
├── styles.css              ← Design system (do NOT modify)
├── firebase-config.js      ← Firebase init + shared utilities
├── database-structure.json ← Sample DB seed (import to Firebase)
└── README.md
```

---

## 🚀 Setup Instructions

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project** → follow the wizard
3. Go to **Build → Realtime Database → Create database**
   - Choose your region
   - Start in **test mode** (you can tighten rules later)

### 2. Get Your Firebase Config

1. In Firebase Console → **Project Settings** (gear icon) → **Your apps**
2. Click the **</>** (Web) icon to register a web app
3. Copy the `firebaseConfig` object

### 3. Paste Config into `firebase-config.js`

Open `firebase-config.js` and replace the `FIREBASE_CONFIG` object:

```js
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSy...",
  authDomain:        "my-project.firebaseapp.com",
  databaseURL:       "https://my-project-default-rtdb.firebaseio.com",
  projectId:         "my-project",
  storageBucket:     "my-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abcdef"
};
```

### 4. Seed the Database (Optional)

1. In Firebase Console → Realtime Database → **⋮ menu → Import JSON**
2. Upload `database-structure.json`
3. **Remember to change the admin password!**

### 5. Set Firebase Security Rules

In Firebase Console → Realtime Database → **Rules**, paste:

```json
{
  "rules": {
    "admins": {
      ".read": false,
      ".write": false
    },
    "categories": {
      ".read": true,
      ".write": false
    },
    "subjects": {
      ".read": true,
      ".write": false
    },
    "lessons": {
      ".read": true,
      ".write": false
    }
  }
}
```

> ⚠️ These rules make content public (read) but block writes. Writes happen from the admin panel using the config directly — for a production app, set up Firebase Auth or restrict by IP.

### 6. Deploy to GitHub Pages

1. Push all files to a GitHub repository
2. Go to **Settings → Pages**
3. Set source to `main` branch, root `/`
4. Your portal will be live at `https://yourusername.github.io/your-repo/`

---

## 📐 Database Structure

```
/admins
  /{username}
    username: string
    password: string  ← plain text (client-side check only — not secure for production)

/categories
  /{catId}
    name: string

/subjects
  /{subjId}
    name: string
    categoryId: string  ← references /categories/{catId}

/lessons
  /{lessonId}           ← alphanumeric ID, e.g. "aB3mK9pX2r"
    title: string
    subjectId: string   ← references /subjects/{subjId}
    htmlContent: string ← raw HTML from rich text editor
    links: [
      { title: string, url: string }
    ]
    materials: [
      { title: string, fileUrl: string }
    ]
```

---

## 🔐 Security Note

The admin authentication in this project is a **simple client-side check** (username + password stored in Firebase). This is suitable for a private/internal tool but **not recommended for public-facing admin panels**. For production, replace with Firebase Authentication.

---

## 📦 Dependencies (all via CDN — no npm needed)

| Library | Purpose |
|---|---|
| Firebase SDK v10 | Realtime Database |
| DOMPurify | Sanitize HTML in lesson viewer (lesson.html) |
| Google Fonts (Inter + Lora) | Typography |

---

## 🧩 Step Build Plan

| Step | Files | Status |
|---|---|---|
| Step 1 | `firebase-config.js`, `styles.css`, `index.html` | ✅ Done |
| Step 2 | `admin.html` — Auth, Dashboard, Category/Subject management | Pending |
| Step 3 | `admin.html` — Lesson editor (RTE, Links, Materials) | Pending |
| Step 4 | `lesson.html` — Viewer, DOMPurify, TOC, Links/Materials | Pending |
