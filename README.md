# CP Pulse — Rolling 12-Month Contest Tracker, Gap Analyzer & Private Upsolve Hub

[![Open CP Pulse](https://img.shields.io/badge/Open_CP_Pulse-Live_App-0ea5e9?style=for-the-badge&logo=googlechrome&logoColor=white)](https://shivanshsinghx365.github.io/cp-pulse/)

A GitHub Pages–hosted competitive programming analytics & upsolve tracker covering **LeetCode (Weekly, Biweekly & POTD)**, **Codeforces (Div. 4 / 3 / 2 / 1+2)**, and **AtCoder ABC** over a **rolling 365-day sliding window**.

---

## Security & Guest vs. Owner Design
- **Guest Mode (Zero Login Required):** Visitors can explore the public 12-month contest heatmap, today's LeetCode POTD, and enter **their own** Codeforces / AtCoder / LeetCode handles to analyze their profile live in-browser. **Guests never read or write to your Firebase and never see your handles, ratings, notes, or Gemini API key.**
- **Owner Mode (Google Sign-In via Firebase Auth):** Signing in as the repository owner unlocks:
  - Persistent **Tickmarks (`Todo` / `Done` / `Revisit`)** and **Per-Problem Notes** in Cloud Firestore.
  - **Auto-synced private handles & snapshot** stored in `cp_pulse_users/{uid}/private/*`.
  - **Owner-only Gemini AI Coach** (your Gemini API key is stored strictly inside your private Firestore document, protected by `firestore.rules` — **never** bundled into the public repo or `dist/`).

---

## Step-by-Step Setup Guide (Fork / Self-Host)

### 1. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/) → **Add Project** → Register a **Web App**.
2. Go to **Authentication → Sign-in method**:
   - Enable **Google** (one-click OAuth).
   - Go to **Authentication → Settings → Authorized domains** → **Add domain** → add `<YOUR_USERNAME>.github.io`.
3. Go to **Firestore Database → Create database** (Production mode).
4. Paste the rules from `firestore.rules` (replacing `YOUR_OWNER_EMAIL@gmail.com` with your Google email) and **Publish**.

### 2. Deploy the Free Cloudflare Worker (for Live LeetCode & POTD)
Codeforces (`codeforces.com/api/*`) and AtCoder (`kenkoooo.com/atcoder/proxy/...`) work directly in the browser via CORS, while LeetCode's GraphQL API blocks browser CORS. A tiny free-tier Cloudflare Worker solves this:
1. Open `worker/cp-proxy.js` and add your GitHub Pages origin (`https://<YOUR_USERNAME>.github.io`) to `ALLOWED_ORIGINS`.
2. Deploy using **either** method:
   - **Option A (CLI, Node 20+):**
     ```bash
     cd worker
     npx wrangler@3 login
     npx wrangler@3 deploy
     ```
   - **Option B (Cloudflare Dashboard, no CLI):**
     Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Start with Hello World!** → name it `cp-proxy` → **Deploy** → **Edit code** → paste `worker/cp-proxy.js` → **Deploy**.
3. Copy your Worker URL (e.g. `https://cp-proxy.<your-subdomain>.workers.dev`).

### 3. Push to GitHub & Configure Variables / Secrets
1. Fork or push this repo to GitHub, then go to **Settings → Pages → Source** and select **GitHub Actions**.
2. In **Settings → Secrets and variables → Actions → Variables**, add:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_OWNER_EMAIL` (your Google Sign-In email)
   - `VITE_CP_PROXY_URL` (your Cloudflare Worker URL from Step 2)
3. *(Optional)* In **Settings → Secrets and variables → Actions → Secrets**, add:
   - `GEMINI_API_KEY` (lets the daily GitHub Action auto-tag brand-new untagged contest problems)
   - `FIREBASE_SERVICE_ACCOUNT` + `OWNER_UID` (optional: if you also want the daily GitHub Action to push your private snapshot to Firestore; otherwise live browser fetch updates it automatically)
4. Trigger **Actions → Sync Rolling 12-Month CP Data & Deploy to GitHub Pages → Run workflow** once.
5. Open your live site → click **Owner Sign In** → open **Settings** → enter your **CF / AtCoder / LeetCode handles** and your **Gemini API Key** (for in-app AI Coach Hints).

---

## FAQ & How It Stays Up to Date Automatically
- **Why do Guests and Owner both see `214 Contests` and the same Heatmap?**
  That count (`public/data/contests_1yr.json`) is the **global public catalog** of all LeetCode Weekly/Biweekly, Codeforces Div 1–4, and AtCoder ABC contests held worldwide in the last 365 days — not personal user data. For Guests, the heatmap shows global topic frequencies with zero personal weak-tag highlights or tickmarks.
- **How do ratings & missed problems stay fresh?**
  - **Codeforces:** Fetched live in-browser (`codeforces.com/api/*`).
  - **AtCoder:** Submissions & rating history fetched live in-browser (`kenkoooo.com` + `kenkoooo.com/atcoder/proxy/...`).
  - **LeetCode:** Contest ranking, history, and live POTD fallback fetched via your Cloudflare Worker (`cp-proxy`), and missed Q1–Q4 problems are matched client-side against the rolling 1-year contest dataset.
- **What about AI Coach Hints when Gemini models update?**
  `fetchGeminiHint` dynamically queries `GET /v1beta/models` for your API key at runtime and falls through available Flash models if one is overloaded (`503`/`429`) or deprecated (`404`).
- **Does the daily GitHub Action stop after 60 days without commits?**
  No — the scheduled workflow commits updated `public/data/*.json` with `[skip ci]` so GitHub keeps the daily schedule active.

---

## Local Development
```bash
npm install
python scripts/sync_all.py --public-only   # refreshes public/data/*.json
npm run dev
```
