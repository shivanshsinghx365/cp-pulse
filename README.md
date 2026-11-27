# CP Pulse — Rolling 12-Month Contest Tracker, Gap Analyzer & Private Upsolve Hub

[![Open CP Pulse](https://img.shields.io/badge/Open_CP_Pulse-Live_App-0ea5e9?style=for-the-badge&logo=googlechrome&logoColor=white)](https://shivanshsinghx365.github.io/cp-pulse/)

A GitHub Pages–hosted competitive programming analytics & upsolve tracker covering **LeetCode (Weekly, Biweekly & POTD)**, **Codeforces (Div. 4 / 3 / 2 / 1+2)**, and **AtCoder ABC** over a **rolling 365-day sliding window**.

## Security & Guest vs. Owner Design
- **Guest Mode (Zero Login Required):** Any visitor can explore the 1-year contest heatmap, today's LeetCode POTD, and enter their own **Codeforces / AtCoder handles** (fetched live in-browser via CORS) to diagnose their weak points. **Guests never read or write to your Firebase and never get access to your Gemini API key.**
- **Owner Mode (Email + Password via Firebase Auth):** Logging in as the repository owner unlocks:
  - Persistent **Tickmarks (`Todo` / `Done` / `Revisit`)** and **Per-Problem Notes** in Cloud Firestore.
  - **Owner-only Gemini AI Coach** (your Gemini API key is stored inside your private Firestore document `users/{uid}/private/settings`, protected by `firestore.rules` — **never** bundled into public repo source).
- **Want your own private notes & AI Coach?** Clone this repo and plug in your own Firebase + Gemini credentials.

---

## 5-Minute Setup Guide (GitHub Pages + Firebase)

### 1. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/) → **Add Project** → Register a **Web App**.
2. Go to **Authentication → Sign-in method**:
   - Enable **Google** (one-click OAuth; no password needed!).
   - Go to **Authentication → Settings → Authorized domains** → click **Add domain** → add `<YOUR_USERNAME>.github.io`.
   - Pin your verified owner email in `firestore.rules` so no other Google account can ever read or write your Firestore data.
3. Go to **Firestore Database → Create database** (Production mode).
4. Paste the rules from `firestore.rules` (replacing `YOUR_OWNER_EMAIL@gmail.com` with your email) and **Publish**.

### 2. Push to GitHub & Configure Variables/Secrets
1. Create a new GitHub repo (e.g. `cp-pulse`) and push this folder:
   ```bash
   git init
   git add .
   git commit -m "Initial CP Pulse setup"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/cp-pulse.git
   git push -u origin main
   ```
2. In your GitHub Repo → **Settings → Pages → Source**: select **GitHub Actions**.
3. In **Settings → Secrets and variables → Actions → Variables**, add:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_OWNER_EMAIL` (your Firebase Auth email)
   - `OWNER_LC_HANDLE`, `OWNER_CF_HANDLE`, `OWNER_AC_HANDLE` (defaults to `shivanshx365`)
4. *(Optional)* In **Secrets → Repository secrets**, add `GEMINI_API_KEY` so the daily GitHub Action auto-tags brand-new untagged contest questions.
5. After deploying, click **Owner Sign In** on your live GitHub Pages URL → open **Owner Settings** → paste your `GEMINI_API_KEY` once (saved privately in Firestore under your UID only).

### 3. Local Development
```bash
npm install
python scripts/sync_all.py   # refreshes public/data/*.json
npm run dev
```
