import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import {
  Activity,
  BarChart3,
  ListChecks,
  Lock,
  LogOut,
  Moon,
  Quote,
  RefreshCw,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  UserCheck,
  Zap,
} from "lucide-react";
import {
  isFirebaseConfigured,
  isOwnerUser,
  loadAllProgress,
  loadOwnerSettings,
  ownerSignInWithGoogle,
  ownerSignOut,
  saveOwnerSettings,
  saveProblemProgress,
  watchAuth,
  type OwnerPrivateSettings,
} from "./lib/firebase";
import { fetchLiveAtCoder, fetchLiveCodeforces, type LiveCfResult } from "./lib/liveApi";
import { analyzeProfile, unpackContests, type RawCompactContests } from "./lib/analyzer";
import type {
  AcSubmission,
  ContestRecord,
  OwnerSnapshot,
  Platform,
  PotdPayload,
  ProblemProgress,
} from "./types";
import { HeatmapTab } from "./components/HeatmapTab";
import { UpsolveTab } from "./components/UpsolveTab";
import { DiagnosisTab } from "./components/DiagnosisTab";
import { OwnerLoginModal, OwnerSettingsModal } from "./components/Modals";

type TabId = "upsolve" | "diagnosis" | "heatmap";

const QUOTES = [
  {
    text: "Ad-hoc gets you into the room; structured upsolving is what turns consistency into Guardian and Candidate Master.",
    author: "Daily Training Principle",
  },
  {
    text: "Every unsolved WA in your contest history is a blueprint of the next rating jump waiting to be claimed.",
    author: "Contest Upsolve Rule",
  },
  {
    text: "You do not rise to the level of your peak contest; you fall to the level of your weakest core topic under clock pressure.",
    author: "Competitive Mastery",
  },
  {
    text: "Solve the problem you avoided yesterday. Comfort builds speed; discomfort builds ceiling.",
    author: "Deliberate Practice",
  },
];

export function App() {
  const [tab, setTab] = useState<TabId>("upsolve");
  const [topicJumpFilter, setTopicJumpFilter] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return localStorage.getItem("cp_pulse_theme") === "light" ? "light" : "dark";
  });
  const [quoteIdx, setQuoteIdx] = useState(() => new Date().getDate() % QUOTES.length);

  const [contests, setContests] = useState<ContestRecord[]>([]);
  const [potd, setPotd] = useState<PotdPayload | null>(null);
  const [ownerSnapshot, setOwnerSnapshot] = useState<OwnerSnapshot | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [user, setUser] = useState<User | null>(null);
  const isOwner = isOwnerUser(user);
  const [ownerSettings, setOwnerSettings] = useState<OwnerPrivateSettings>({});
  const [progress, setProgress] = useState<Record<string, ProblemProgress>>({});
  const [loginOpen, setLoginOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const defaultCf = import.meta.env.VITE_OWNER_CF_HANDLE || "shivanshx365";
  const defaultAc = import.meta.env.VITE_OWNER_AC_HANDLE || "shivanshx365";
  const [cfHandleInput, setCfHandleInput] = useState(defaultCf);
  const [acHandleInput, setAcHandleInput] = useState(defaultAc);
  const [liveCf, setLiveCf] = useState<LiveCfResult | null>(null);
  const [liveAc, setLiveAc] = useState<AcSubmission[]>([]);
  const [activeGuestMode, setActiveGuestMode] = useState(false);
  const [refreshingLive, setRefreshingLive] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    const isLight = theme === "light";
    document.documentElement.classList.toggle("dark", !isLight);
    document.documentElement.classList.toggle("light", isLight);
    localStorage.setItem("cp_pulse_theme", theme);
  }, [theme]);

  useEffect(() => {
    async function boot() {
      try {
        const base = import.meta.env.BASE_URL || "./";
        const [cRes, pRes, oRes] = await Promise.all([
          fetch(`${base}data/contests_1yr.json`),
          fetch(`${base}data/potd.json`),
          fetch(`${base}data/owner_snapshot.json`),
        ]);
        const cJson: RawCompactContests = await cRes.json();
        setContests(unpackContests(cJson));
        if (pRes.ok) setPotd(await pRes.json());
        if (oRes.ok) {
          const snap: OwnerSnapshot = await oRes.json();
          setOwnerSnapshot(snap);
          setLiveCf(snap.codeforces);
        }
      } finally {
        setLoadingData(false);
      }
    }
    boot();
  }, []);

  useEffect(() => {
    return watchAuth(async (u) => {
      setUser(u);
      if (u && isOwnerUser(u)) {
        const [prog, st] = await Promise.all([loadAllProgress(u.uid), loadOwnerSettings(u.uid)]);
        setProgress(prog);
        setOwnerSettings(st);
        if (st.cfHandle) setCfHandleInput(st.cfHandle);
        if (st.acHandle) setAcHandleInput(st.acHandle);
        setActiveGuestMode(false);
      } else {
        setOwnerSettings({});
      }
    });
  }, []);

  async function refreshLiveHandles(cfH: string, acH: string, asGuest: boolean) {
    setRefreshingLive(true);
    setLiveError(null);
    try {
      const [cfRes, acRes] = await Promise.all([
        cfH.trim() ? fetchLiveCodeforces(cfH) : Promise.resolve(null),
        acH.trim() ? fetchLiveAtCoder(acH) : Promise.resolve([]),
      ]);
      setLiveCf(cfRes);
      setLiveAc(acRes);
      setActiveGuestMode(asGuest);
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : "Failed to fetch live handles");
    } finally {
      setRefreshingLive(false);
    }
  }

  useEffect(() => {
    if (!loadingData && defaultAc) {
      fetchLiveAtCoder(defaultAc)
        .then((ac) => setLiveAc(ac))
        .catch(() => {});
    }
  }, [loadingData, defaultAc]);

  const targetCf = ownerSettings.targetCfRating || 1600;
  const targetLc = ownerSettings.targetLcRating || 2150;

  const diagnosis = useMemo(() => {
    const useOwnerLc = !activeGuestMode && ownerSnapshot ? ownerSnapshot.leetcode.missedContestQuestions : null;
    return analyzeProfile(contests, potd, liveCf, liveAc, useOwnerLc, targetCf);
  }, [contests, potd, liveCf, liveAc, activeGuestMode, ownerSnapshot, targetCf]);

  async function handleUpdateProgress(
    key: string,
    patch: Partial<ProblemProgress> & { title: string; platform: Platform; url: string }
  ) {
    const cur = progress[key] || { key, status: "todo", note: "", updatedAt: Date.now() };
    const next: ProblemProgress = {
      ...cur,
      ...patch,
      key,
      updatedAt: Date.now(),
    };
    setProgress((prev) => ({ ...prev, [key]: next }));
    if (isOwner && user) {
      await saveProblemProgress(user.uid, next);
    }
  }

  function handleToggleHeatmapStatus(
    key: string,
    meta: { title: string; platform: Platform; url: string }
  ) {
    const cur = progress[key]?.status || "todo";
    const next = cur === "todo" ? "done" : cur === "done" ? "revisit" : "todo";
    handleUpdateProgress(key, { status: next, ...meta });
  }

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-ui">
        Loading rolling 12-month contest dataset...
      </div>
    );
  }

  const doneCount = Object.values(progress).filter((p) => p.status === "done").length;
  const lcRatingVal = !activeGuestMode && ownerSnapshot?.leetcode.ranking ? Math.round(ownerSnapshot.leetcode.ranking.rating) : null;
  const quote = QUOTES[quoteIdx % QUOTES.length];
  const baseUrl = import.meta.env.BASE_URL || "./";

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Top Bar */}
        <header className="surface-card rounded-2xl px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-indigo-600/15 border border-indigo-500/35 flex items-center justify-center text-indigo-500">
              <Zap className="w-4 h-4" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-primary-ui">CP Pulse</h1>
                <span className="badge-accent text-xs px-2.5 py-0.5 rounded-full font-mono">
                  12-Mo · {contests.length} Contests
                </span>
                {isOwner ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 inline-flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> Owner Synced
                  </span>
                ) : (
                  <span className="pill-inactive text-xs px-2.5 py-0.5 rounded-full">
                    Guest Session
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="pill-inactive text-xs px-3 py-2 rounded-xl inline-flex items-center gap-1.5 transition"
            >
              {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-500" />}
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>

            {isOwner ? (
              <>
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="pill-inactive text-xs px-3 py-2 rounded-xl inline-flex items-center gap-1.5 transition"
                >
                  <Settings className="w-3.5 h-3.5" /> Settings
                </button>
                <button
                  onClick={() => ownerSignOut()}
                  className="pill-inactive text-xs px-3 py-2 rounded-xl hover:border-rose-500/50 inline-flex items-center gap-1.5 transition"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                className="text-xs px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm inline-flex items-center gap-1.5 transition"
              >
                <Lock className="w-3.5 h-3.5" /> Owner Sign In
              </button>
            )}
          </div>
        </header>

        {/* Motivating Hero Section */}
        <section className="surface-card rounded-2xl p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-5 items-center overflow-hidden">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-500 dark:text-indigo-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Algorithmic Ascent · Guardian ({targetLc}+) &amp; Expert / CM ({targetCf}+)</span>
            </div>

            <blockquote className="space-y-1.5">
              <div className="flex items-start gap-2">
                <Quote className="w-5 h-5 text-indigo-500/70 shrink-0 mt-0.5" />
                <p className="text-base sm:text-lg font-semibold tracking-tight text-primary-ui leading-snug">
                  {quote.text}
                </p>
              </div>
              <footer className="pl-7 flex items-center gap-3 text-xs text-muted-ui">
                <span>— {quote.author}</span>
                <button
                  onClick={() => setQuoteIdx((i) => (i + 1) % QUOTES.length)}
                  className="text-indigo-500 hover:underline font-medium"
                >
                  Next quote
                </button>
              </footer>
            </blockquote>

            <div className="pl-7 flex flex-wrap gap-2 pt-1 text-xs">
              <span className="surface-inset px-2.5 py-1 rounded-lg font-mono text-primary-ui">
                LC {lcRatingVal ?? "—"} <span className="text-indigo-500">→ {targetLc}</span>
              </span>
              <span className="surface-inset px-2.5 py-1 rounded-lg font-mono text-primary-ui">
                CF {liveCf?.info.rating ?? "—"} <span className="text-emerald-500">→ {targetCf}</span>
              </span>
              <span className="surface-inset px-2.5 py-1 rounded-lg font-mono text-primary-ui">
                AC {diagnosis.acSolvedCount} ACs
              </span>
              <span className="surface-inset px-2.5 py-1 rounded-lg font-mono text-primary-ui">
                {doneCount} upsolved · {diagnosis.upsolveQueue.length} queued
              </span>
            </div>
          </div>

          <div className="relative rounded-xl overflow-hidden border border-slate-300/40 dark:border-slate-800/90 shadow-md">
            <img
              src={`${baseUrl}hero-art.jpg`}
              alt="Geometric mountain ridge formed from glowing graph nodes and ascending algorithmic curves"
              className="w-full h-40 sm:h-48 object-cover block"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs text-slate-200 font-mono">
              <span>Rolling 365-Day Intelligence</span>
              <span className="text-emerald-300">{diagnosis.weakTags.length} gaps tracked</span>
            </div>
          </div>
        </section>

        {/* Labeled Live Handle Analyzer Bar */}
        <section className="surface-card rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2.5 items-end flex-1 max-w-2xl">
            <div className="space-y-1">
              <label htmlFor="cf-handle-input" className="block text-xs font-medium text-muted-ui">
                Codeforces Handle
              </label>
              <input
                id="cf-handle-input"
                value={cfHandleInput}
                onChange={(e) => setCfHandleInput(e.target.value)}
                placeholder="e.g. tourist"
                className="input-field w-full text-xs px-3 py-2 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ac-handle-input" className="block text-xs font-medium text-muted-ui">
                AtCoder Handle
              </label>
              <input
                id="ac-handle-input"
                value={acHandleInput}
                onChange={(e) => setAcHandleInput(e.target.value)}
                placeholder="e.g. tourist"
                className="input-field w-full text-xs px-3 py-2 rounded-lg"
              />
            </div>
            <button
              onClick={() =>
                refreshLiveHandles(
                  cfHandleInput,
                  acHandleInput,
                  !isOwner && cfHandleInput.trim().toLowerCase() !== defaultCf.toLowerCase()
                )
              }
              disabled={refreshingLive}
              className="pill-inactive text-xs px-3.5 py-2 rounded-lg font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-60 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingLive ? "animate-spin" : ""}`} />
              {refreshingLive ? "Syncing..." : "Fetch Live"}
            </button>
          </div>

          <div className="text-xs text-muted-ui flex items-center gap-1.5 pb-1">
            {!isOwner && (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Guest analysis runs locally in your browser (no owner Firebase/Gemini used).</span>
              </>
            )}
          </div>
        </section>

        {liveError && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-500">
            {liveError}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex flex-wrap gap-2 border-b border-slate-300/50 dark:border-slate-800/80 pb-3">
          <button
            onClick={() => setTab("upsolve")}
            className={`text-xs font-medium px-3.5 py-2 rounded-xl border inline-flex items-center gap-1.5 transition ${
              tab === "upsolve"
                ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                : "pill-inactive"
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" /> POTD &amp; Dynamic Upsolve Queue ({diagnosis.upsolveQueue.length})
          </button>
          <button
            onClick={() => setTab("diagnosis")}
            className={`text-xs font-medium px-3.5 py-2 rounded-xl border inline-flex items-center gap-1.5 transition ${
              tab === "diagnosis"
                ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                : "pill-inactive"
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> My Weak Points &amp; Tag Audit
          </button>
          <button
            onClick={() => setTab("heatmap")}
            className={`text-xs font-medium px-3.5 py-2 rounded-xl border inline-flex items-center gap-1.5 transition ${
              tab === "heatmap"
                ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                : "pill-inactive"
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> 1-Year Contest Heatmap
          </button>
        </nav>

        {/* Tab Views */}
        {tab === "upsolve" && (
          <UpsolveTab
            potd={potd}
            potdFollowUps={diagnosis.potdFollowUps}
            upsolveQueue={diagnosis.upsolveQueue}
            weakTags={diagnosis.weakTags}
            progress={progress}
            isOwner={isOwner}
            geminiKey={ownerSettings.geminiKey || ""}
            topicJumpFilter={topicJumpFilter}
            onClearTopicJump={() => setTopicJumpFilter("")}
            onUpdateProgress={handleUpdateProgress}
          />
        )}

        {tab === "diagnosis" && (
          <DiagnosisTab
            diagnosis={diagnosis}
            cfData={liveCf}
            lcData={!activeGuestMode && ownerSnapshot ? ownerSnapshot.leetcode : null}
            isOwner={isOwner}
            targetCfRating={targetCf}
            targetLcRating={targetLc}
            onJumpToTopic={(tag) => {
              setTopicJumpFilter(tag);
              setTab("upsolve");
            }}
          />
        )}

        {tab === "heatmap" && (
          <HeatmapTab
            contests={contests}
            weakTags={diagnosis.weakTags}
            progress={progress}
            onToggleStatus={handleToggleHeatmapStatus}
          />
        )}
      </div>

      <OwnerLoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onGoogleLogin={async () => {
          await ownerSignInWithGoogle();
        }}
        firebaseConfigured={isFirebaseConfigured}
      />

      <OwnerSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={ownerSettings}
        onSave={async (s) => {
          if (user) {
            await saveOwnerSettings(user.uid, s);
            setOwnerSettings(s);
            if (s.cfHandle) setCfHandleInput(s.cfHandle);
            if (s.acHandle) setAcHandleInput(s.acHandle);
          }
        }}
      />
    </div>
  );
}

export default App;
