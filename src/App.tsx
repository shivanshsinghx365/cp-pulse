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
  TrendingUp,
  UserCheck,
  Zap,
} from "lucide-react";
import {
  isFirebaseConfigured,
  isOwnerUser,
  loadAllProgress,
  loadOwnerSettings,
  loadOwnerSnapshot,
  ownerSignInWithGoogle,
  ownerSignOut,
  saveOwnerSettings,
  saveOwnerSnapshot,
  saveProblemProgress,
  watchAuth,
  type OwnerPrivateSettings,
} from "./lib/firebase";
import { fetchLiveAtCoder, fetchLiveCodeforces, fetchLiveLeetCode, fetchLiveAcRatingHistory, fetchLivePotd, type LiveCfResult, type LiveLcResult } from "./lib/liveApi";
import { analyzeProfile, unpackContests, type RawCompactContests } from "./lib/analyzer";
import type {
  AcRatingPoint,
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
import { PerformanceTab } from "./components/PerformanceTab";
import { OwnerLoginModal, OwnerSettingsModal } from "./components/Modals";

type TabId = "upsolve" | "performance" | "diagnosis" | "heatmap";

const QUOTES = [
  {
    text: "Consistency usually beats intensity. One honest upsolve a day adds up quietly over a year.",
    author: "Daily Practice",
  },
  {
    text: "Every wrong answer narrows down what to learn next. Treat missed contest problems as free feedback.",
    author: "Contest Review",
  },
  {
    text: "Progress is rarely loud — it shows up weeks later when an unfamiliar idea starts feeling routine.",
    author: "Long-Term Craft",
  },
  {
    text: "Pick one topic at a time, understand why an invariant holds, and move forward at your own pace.",
    author: "Deliberate Study",
  },
  {
    text: "Reading an editorial after a real attempt teaches twice as much as rushing straight to the next problem.",
    author: "Upsolving Habit",
  },
  {
    text: "Small blind spots disappear fast once you start writing down what tripped you up.",
    author: "Reflection",
  },
  {
    text: "Stay patient with hard problems; even 20 minutes of stuck thinking reshapes how you notice patterns.",
    author: "Problem Solving",
  },
  {
    text: "You do not need to solve everything today — only keep showing up for the next step.",
    author: "Steady Growth",
  },
];

function pickDailyQuoteIndex(): number {
  const now = new Date();
  const key = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % QUOTES.length;
}

export function App() {
  const [tab, setTab] = useState<TabId>("upsolve");
  const [topicJumpFilter, setTopicJumpFilter] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return localStorage.getItem("cp_pulse_theme") === "light" ? "light" : "dark";
  });
  const quoteIdx = useMemo(() => pickDailyQuoteIndex(), []);

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

  const [cfHandleInput, setCfHandleInput] = useState("");
  const [acHandleInput, setAcHandleInput] = useState("");
  const [lcHandleInput, setLcHandleInput] = useState("");
  const [liveCf, setLiveCf] = useState<LiveCfResult | null>(null);
  const [liveAc, setLiveAc] = useState<AcSubmission[]>([]);
  const [liveLc, setLiveLc] = useState<LiveLcResult | null>(null);
  const [liveAcRating, setLiveAcRating] = useState<AcRatingPoint[]>([]);
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
        const [cRes, pRes] = await Promise.all([
          fetch(`${base}data/contests_1yr.json`, { cache: "no-store" }),
          fetch(`${base}data/potd.json`, { cache: "no-store" }),
        ]);
        const cJson: RawCompactContests = await cRes.json();
        setContests(unpackContests(cJson));
        if (pRes.ok) {
          const pJson: PotdPayload = await pRes.json();
          setPotd(pJson);
          const todayUtc = new Date().toISOString().slice(0, 10);
          if (pJson?.today?.date !== todayUtc) {
            fetchLivePotd().then((liveToday) => {
              if (!liveToday) return;
              setPotd((prev) => {
                if (!prev) return { updatedAt: Math.floor(Date.now() / 1000), today: liveToday, recent: [] };
                if (prev.today?.slug === liveToday.slug && prev.today?.date === liveToday.date) return prev;
                const prevToday = prev.today;
                const nextRecent =
                  prevToday && prevToday.slug !== liveToday.slug && !prev.recent.some((r) => r.slug === prevToday.slug)
                    ? [prevToday, ...prev.recent].slice(0, 30)
                    : prev.recent;
                return { updatedAt: Math.floor(Date.now() / 1000), today: liveToday, recent: nextRecent };
              });
            });
          }
        }
      } finally {
        setLoadingData(false);
      }
    }
    boot();
  }, []);

  async function refreshLiveHandles(
    cfH: string,
    acH: string,
    lcH: string,
    asGuest: boolean,
    persistTarget?: { uid: string; baseSnap: OwnerSnapshot | null }
  ) {
    setRefreshingLive(true);
    setLiveError(null);
    try {
      const [cfRes, acSubRes, lcRes, acRatingRes] = await Promise.all([
        cfH.trim() ? fetchLiveCodeforces(cfH) : Promise.resolve(null),
        acH.trim() ? fetchLiveAtCoder(acH) : Promise.resolve([]),
        lcH.trim() ? fetchLiveLeetCode(lcH).catch(() => null) : Promise.resolve(null),
        acH.trim() ? fetchLiveAcRatingHistory(acH).catch(() => []) : Promise.resolve([]),
      ]);
      setLiveCf(cfRes);
      setLiveAc(acSubRes);
      setLiveLc(lcRes);
      setLiveAcRating(acRatingRes);
      setActiveGuestMode(asGuest);

      // Persist live-fetched LC, AtCoder rating, and CF summary back to Firestore for the owner
      if (!asGuest && persistTarget && (lcRes || acRatingRes.length > 0 || cfRes)) {
        const prev = persistTarget.baseSnap;
        const mergedSnap: OwnerSnapshot = {
          updatedAt: Math.floor(Date.now() / 1000),
          handles: {
            leetcode: lcH.trim() || prev?.handles?.leetcode || "",
            codeforces: cfH.trim() || prev?.handles?.codeforces || "",
            atcoder: acH.trim() || prev?.handles?.atcoder || "",
          },
          leetcode: lcRes
            ? {
                ranking: lcRes.ranking,
                contestHistory: lcRes.contestHistory,
                acStats: prev?.leetcode?.acStats ?? [],
                tagCounts: prev?.leetcode?.tagCounts ?? {},
                missedContestQuestions: prev?.leetcode?.missedContestQuestions ?? [],
                recentAc: prev?.leetcode?.recentAc ?? [],
              }
            : prev?.leetcode ?? {
                ranking: null,
                acStats: [],
                tagCounts: {},
                contestHistory: [],
                missedContestQuestions: [],
                recentAc: [],
              },
          codeforces: cfRes
            ? cfRes
            : prev?.codeforces ?? {
                info: { handle: cfH.trim() },
                ratingHistory: [],
                submissions: [],
              },
          atcoder: {
            ratingHistory:
              acRatingRes.length > 0 ? acRatingRes : prev?.atcoder?.ratingHistory ?? [],
          },
        };
        setOwnerSnapshot(mergedSnap);
        saveOwnerSnapshot(persistTarget.uid, mergedSnap).catch(() => {});
      }
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : "Failed to fetch live handles");
    } finally {
      setRefreshingLive(false);
    }
  }

  useEffect(() => {
    return watchAuth(async (u) => {
      setUser(u);
      if (u && isOwnerUser(u)) {
        const [prog, st, snap] = await Promise.all([
          loadAllProgress(u.uid),
          loadOwnerSettings(u.uid),
          loadOwnerSnapshot(u.uid),
        ]);
        setProgress(prog);
        setOwnerSettings(st);
        setOwnerSnapshot(snap);
        const cfH = (st.cfHandle || snap?.handles?.codeforces || "").trim();
        const acH = (st.acHandle || snap?.handles?.atcoder || "").trim();
        const lcH = (st.lcHandle || snap?.handles?.leetcode || "").trim();
        setCfHandleInput(cfH);
        setAcHandleInput(acH);
        setLcHandleInput(lcH);
        if (snap?.codeforces) setLiveCf(snap.codeforces);
        setActiveGuestMode(false);
        if (cfH || acH || lcH) {
          refreshLiveHandles(cfH, acH, lcH, false, { uid: u.uid, baseSnap: snap });
        }
      } else {
        setOwnerSettings({});
        setOwnerSnapshot(null);
        setProgress({});
        setLiveCf(null);
        setLiveAc([]);
        setLiveLc(null);
        setLiveAcRating([]);
        setCfHandleInput("");
        setAcHandleInput("");
        setLcHandleInput("");
        setActiveGuestMode(false);
      }
    });
  }, []);

  const targetCf = ownerSettings.targetCfRating || 1600;
  const targetLc = ownerSettings.targetLcRating || 2150;

  // Prefer live-fetched data; fall back to Owner's Firestore snapshot only when signed in as Owner
  const isOwnerActive = isOwner && !activeGuestMode;
  const activeLcData = useMemo(() => {
    const baseSnapLc = isOwnerActive ? ownerSnapshot?.leetcode ?? null : null;
    if (liveLc) {
      // Derive missed Q1-Q4 directly from live LC contestHistory + rolling 1-year contests dataset
      const lcContestMap = new Map<string, ContestRecord>();
      for (const c of contests) {
        if (c.platform === "LeetCode") lcContestMap.set(c.id, c);
      }
      const derivedMissed: OwnerSnapshot["leetcode"]["missedContestQuestions"] = [];
      for (const h of liveLc.contestHistory) {
        const c = lcContestMap.get(h.slug);
        if (!c) continue;
        c.questions.forEach((q, idx) => {
          if (idx + 1 > h.solved) {
            derivedMissed.push({
              platform: "LeetCode",
              contestTitle: c.title,
              slot: q.slot,
              id: q.id,
              title: q.title,
              url: `https://leetcode.com/problems/${q.id}/`,
              difficulty: q.difficulty,
              rating: q.rating,
              tags: q.tags,
              reason: `Missed in ${c.title} (${h.solved}/${c.questions.length} solved)`,
              ts: c.startTime,
            });
          }
        });
      }
      const snapshotMissed = baseSnapLc?.missedContestQuestions ?? [];
      return {
        ranking: liveLc.ranking,
        contestHistory: liveLc.contestHistory,
        acStats: baseSnapLc?.acStats ?? [],
        tagCounts: baseSnapLc?.tagCounts ?? {},
        missedContestQuestions: derivedMissed.length > 0 ? derivedMissed : snapshotMissed,
        recentAc: baseSnapLc?.recentAc ?? [],
      };
    }
    return baseSnapLc;
  }, [isOwnerActive, liveLc, ownerSnapshot, contests]);

  const activeAcRating = useMemo(
    () => (liveAcRating.length > 0 ? liveAcRating : isOwnerActive ? ownerSnapshot?.atcoder?.ratingHistory ?? [] : []),
    [isOwnerActive, liveAcRating, ownerSnapshot]
  );

  const diagnosis = useMemo(() => {
    const useOwnerLc = activeLcData?.missedContestQuestions ?? null;
    const recentAcSlugs = activeLcData?.recentAc?.map((a) => a.titleSlug) ?? [];
    return analyzeProfile(contests, potd, liveCf, liveAc, useOwnerLc, targetCf, recentAcSlugs);
  }, [contests, potd, liveCf, liveAc, activeLcData, targetCf]);

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
  const hasProfile = Boolean(
    liveCf || liveAc.length > 0 || liveLc || liveAcRating.length > 0 || (isOwner && ownerSnapshot)
  );

  const lcRatingVal = activeLcData?.ranking?.rating ? Math.round(activeLcData.ranking.rating) : null;
  const acRatingVal = activeAcRating.filter((r) => r.isRated).slice(-1)[0]?.newRating ?? null;
  const quote = QUOTES[quoteIdx % QUOTES.length];
  const baseUrl = import.meta.env.BASE_URL || "./";

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Top Bar */}
        <header className="surface-card rounded-2xl px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl badge-accent flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-primary-ui">CP Pulse</h1>
                <span className="badge-accent text-xs px-2.5 py-0.5 rounded-full font-mono">
                  12-Mo · {contests.length} Contests
                </span>
                {isOwner ? (
                  <span className="badge-ok text-xs px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
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
              {theme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-accent-ui" />}
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
                  className="pill-inactive text-xs px-3 py-2 rounded-xl inline-flex items-center gap-1.5 transition"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                className="btn-primary text-xs px-3.5 py-2 rounded-xl font-semibold shadow-sm inline-flex items-center gap-1.5 transition"
              >
                <Lock className="w-3.5 h-3.5" /> Owner Sign In
              </button>
            )}
          </div>
        </header>

        {/* Daily Quote & Snapshot Hero */}
        <section className="surface-card rounded-2xl p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-5 items-center overflow-hidden">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-ui">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {hasProfile
                  ? `Steady Practice · Targets: ${targetLc} LC · ${targetCf} CF`
                  : "Steady Practice · Daily POTDs & 12-Month Contest Explorer"}
              </span>
            </div>

            <blockquote className="space-y-1.5">
              <div className="flex items-start gap-2">
                <Quote className="w-5 h-5 text-accent-ui opacity-70 shrink-0 mt-0.5" />
                <p className="text-base sm:text-lg font-semibold tracking-tight text-primary-ui leading-snug">
                  {quote.text}
                </p>
              </div>
              <footer className="pl-7 text-xs text-muted-ui">
                <span>— {quote.author}</span>
              </footer>
            </blockquote>

            <div className="pl-7 flex flex-wrap gap-2 pt-1 text-xs">
              {hasProfile ? (
                <>
                  <span className="surface-inset px-2.5 py-1 rounded-lg font-mono text-primary-ui">
                    LC {lcRatingVal ?? "—"} <span className="text-accent-ui">→ {targetLc}</span>
                  </span>
                  <span className="surface-inset px-2.5 py-1 rounded-lg font-mono text-primary-ui">
                    CF {liveCf?.info.rating ?? "—"} <span className="text-ok-ui">→ {targetCf}</span>
                  </span>
                  <span className="surface-inset px-2.5 py-1 rounded-lg font-mono text-primary-ui">
                    AC {acRatingVal !== null ? `${acRatingVal} · ` : ""}{diagnosis.acSolvedCount} ACs
                  </span>
                  <span className="surface-inset px-2.5 py-1 rounded-lg font-mono text-primary-ui">
                    {doneCount} upsolved · {diagnosis.upsolveQueue.length} queued
                  </span>
                </>
              ) : (
                <>
                  <span className="surface-inset px-2.5 py-1 rounded-lg font-mono text-muted-ui">
                    LC —
                  </span>
                  <span className="surface-inset px-2.5 py-1 rounded-lg font-mono text-muted-ui">
                    CF —
                  </span>
                  <span className="surface-inset px-2.5 py-1 rounded-lg font-mono text-muted-ui">
                    AC —
                  </span>
                  <span className="surface-inset px-2.5 py-1 rounded-lg font-mono text-primary-ui">
                    {diagnosis.upsolveQueue.length} daily POTDs
                  </span>
                </>
              )}
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
              <span>365-Day Contest Log</span>
              <span className="text-teal-300">
                {hasProfile ? `${diagnosis.weakTags.length} focus topics` : "Sign in for personal sync"}
              </span>
            </div>
          </div>
        </section>

        {/* Labeled Live Handle Analyzer Bar */}
        <section className="surface-card rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2.5 items-end flex-1 max-w-3xl">
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
            <div className="space-y-1">
              <label htmlFor="lc-handle-input" className="block text-xs font-medium text-muted-ui">
                LeetCode Handle
              </label>
              <input
                id="lc-handle-input"
                value={lcHandleInput}
                onChange={(e) => setLcHandleInput(e.target.value)}
                placeholder="e.g. neal_wu"
                className="input-field w-full text-xs px-3 py-2 rounded-lg"
              />
            </div>
            <button
              onClick={async () => {
                const cfH = cfHandleInput.trim();
                const acH = acHandleInput.trim();
                const lcH = lcHandleInput.trim();
                await refreshLiveHandles(
                  cfH,
                  acH,
                  lcH,
                  !isOwner,
                  isOwner && user ? { uid: user.uid, baseSnap: ownerSnapshot } : undefined
                );
                if (isOwner && user) {
                  const nextSettings = { ...ownerSettings, cfHandle: cfH, acHandle: acH, lcHandle: lcH };
                  setOwnerSettings(nextSettings);
                  await saveOwnerSettings(user.uid, nextSettings);
                }
              }}
              disabled={refreshingLive || (!cfHandleInput.trim() && !acHandleInput.trim() && !lcHandleInput.trim())}
              className="pill-inactive text-xs px-3.5 py-2 rounded-lg font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-60 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingLive ? "animate-spin" : ""}`} />
              {refreshingLive ? "Syncing..." : "Fetch Live"}
            </button>
          </div>

          <div className="text-xs text-muted-ui flex items-center gap-1.5 pb-1">
            {!isOwner && (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-warn-ui shrink-0" />
                <span>Guest analysis runs locally in your browser (no owner Firebase/Gemini used).</span>
              </>
            )}
          </div>
        </section>

        {liveError && (
          <div className="badge-gap p-3 rounded-xl text-xs">
            {liveError}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex flex-wrap gap-2 border-b border-slate-300/50 dark:border-slate-800/80 pb-3">
          <button
            onClick={() => setTab("upsolve")}
            className={`text-xs font-medium px-3.5 py-2 rounded-xl border inline-flex items-center gap-1.5 transition ${
              tab === "upsolve"
                ? "btn-primary shadow-sm"
                : "pill-inactive"
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" /> POTD &amp; Dynamic Upsolve Queue ({diagnosis.upsolveQueue.length})
          </button>
          <button
            onClick={() => setTab("performance")}
            className={`text-xs font-medium px-3.5 py-2 rounded-xl border inline-flex items-center gap-1.5 transition ${
              tab === "performance"
                ? "btn-primary shadow-sm"
                : "pill-inactive"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" /> Performance Overview
          </button>
          <button
            onClick={() => setTab("diagnosis")}
            className={`text-xs font-medium px-3.5 py-2 rounded-xl border inline-flex items-center gap-1.5 transition ${
              tab === "diagnosis"
                ? "btn-primary shadow-sm"
                : "pill-inactive"
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> My Weak Points &amp; Tag Audit
          </button>
          <button
            onClick={() => setTab("heatmap")}
            className={`text-xs font-medium px-3.5 py-2 rounded-xl border inline-flex items-center gap-1.5 transition ${
              tab === "heatmap"
                ? "btn-primary shadow-sm"
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
            hasProfile={hasProfile}
            geminiKey={ownerSettings.geminiKey || ""}
            topicJumpFilter={topicJumpFilter}
            onClearTopicJump={() => setTopicJumpFilter("")}
            onUpdateProgress={handleUpdateProgress}
          />
        )}

        {tab === "performance" && (
          <PerformanceTab
            diagnosis={diagnosis}
            cfData={liveCf}
            lcData={activeLcData}
            acRatingHistory={activeAcRating}
            isOwner={isOwner}
            hasProfile={hasProfile}
            targetCfRating={targetCf}
            targetLcRating={targetLc}
            onJumpToTopic={(tag) => {
              setTopicJumpFilter(tag);
              setTab("upsolve");
            }}
          />
        )}

        {tab === "diagnosis" && (
          <DiagnosisTab
            diagnosis={diagnosis}
            cfData={liveCf}
            lcData={activeLcData}
            isOwner={isOwner}
            hasProfile={hasProfile}
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
        hasSnapshot={Boolean(ownerSnapshot)}
        onSave={async (s) => {
          if (user) {
            await saveOwnerSettings(user.uid, s);
            setOwnerSettings(s);
            setCfHandleInput(s.cfHandle || "");
            setAcHandleInput(s.acHandle || "");
            setLcHandleInput(s.lcHandle || "");
            if (s.cfHandle || s.acHandle || s.lcHandle) {
              await refreshLiveHandles(
                s.cfHandle || "",
                s.acHandle || "",
                s.lcHandle || "",
                false,
                { uid: user.uid, baseSnap: ownerSnapshot }
              );
            }
          }
        }}
        onImportSnapshot={async (snap) => {
          if (user) {
            await saveOwnerSnapshot(user.uid, snap);
            setOwnerSnapshot(snap);
            if (snap.codeforces && !liveCf) setLiveCf(snap.codeforces);
          }
        }}
      />
    </div>
  );
}

export default App;
