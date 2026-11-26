import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Flame,
  NotebookPen,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import type {
  ContestQuestion,
  Platform,
  PotdPayload,
  ProblemProgress,
  UpsolveItem,
} from "../types";
import { makeProblemKey } from "../lib/tags";
import { fetchGeminiHint } from "../lib/liveApi";

interface Props {
  potd: PotdPayload | null;
  potdFollowUps: ContestQuestion[];
  upsolveQueue: UpsolveItem[];
  weakTags: string[];
  progress: Record<string, ProblemProgress>;
  isOwner: boolean;
  geminiKey: string;
  topicJumpFilter: string;
  onClearTopicJump: () => void;
  onUpdateProgress: (
    key: string,
    patch: Partial<ProblemProgress> & { title: string; platform: Platform; url: string }
  ) => void;
}

const BUCKET_ACCENT: Record<UpsolveItem["bucket"], string> = {
  attempted_unsolved: "border-l-2 border-l-[#d96c52]",
  missed_contest: "border-l-2 border-l-amber-500/75",
  potd_match: "border-l-2 border-l-sky-500/80",
  weak_pillar: "border-l-2 border-l-teal-500/70",
};

export function UpsolveTab({
  potd,
  potdFollowUps,
  upsolveQueue,
  weakTags,
  progress,
  isOwner,
  geminiKey,
  topicJumpFilter,
  onClearTopicJump,
  onUpdateProgress,
}: Props) {
  const [bucket, setBucket] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openNoteKey, setOpenNoteKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [aiHints, setAiHints] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (topicJumpFilter) {
      setSearch(topicJumpFilter);
      setBucket("all");
      setStatusFilter("open");
    }
  }, [topicJumpFilter]);

  const weakSet = useMemo(() => new Set(weakTags), [weakTags]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return upsolveQueue.filter((item) => {
      if (bucket !== "all" && item.bucket !== bucket) return false;
      if (levelFilter === "early") {
        const isEarlyLc = item.platform === "LeetCode" && (item.slot === "Q1" || item.slot === "Q2");
        const isEarlyCf =
          item.platform === "Codeforces" &&
          ((item.numericRating !== null && item.numericRating <= 1300) ||
            /[A-B][12]?$/i.test(item.slot));
        const isEarlyAc =
          item.platform === "AtCoder" &&
          ((item.numericRating !== null && item.numericRating < 800) || /\b[ABC]$/i.test(item.slot));
        if (!isEarlyLc && !isEarlyCf && !isEarlyAc) return false;
      } else if (levelFilter === "late") {
        const isLateLc = item.platform === "LeetCode" && (item.slot === "Q3" || item.slot === "Q4");
        const isLateCf = item.platform === "Codeforces" && item.numericRating !== null && item.numericRating > 1300;
        const isLateAc = item.platform === "AtCoder" && item.numericRating !== null && item.numericRating >= 800;
        if (!isLateLc && !isLateCf && !isLateAc) return false;
      }
      const st = progress[item.key]?.status || "todo";
      if (statusFilter === "open" && st === "done") return false;
      if (statusFilter === "done" && st !== "done") return false;
      if (statusFilter === "revisit" && st !== "revisit") return false;
      if (q) {
        const hay = `${item.slot} ${item.title} ${item.platform} ${item.tags.join(" ")} ${item.reason}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [upsolveQueue, bucket, levelFilter, statusFilter, search, progress]);

  async function handleAskGemini(item: {
    key: string;
    platform: string;
    title: string;
    ratingLabel: string;
    tags: string[];
    reason?: string;
  }) {
    setAiError(null);
    setAiLoading(item.key);
    try {
      const text = await fetchGeminiHint(geminiKey, item);
      setAiHints((prev) => ({ ...prev, [item.key]: text }));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Gemini request failed");
    } finally {
      setAiLoading(null);
    }
  }

  function cycleStatus(item: UpsolveItem) {
    const cur = progress[item.key]?.status || "todo";
    const next = cur === "todo" ? "done" : cur === "done" ? "revisit" : "todo";
    onUpdateProgress(item.key, {
      status: next,
      title: item.title,
      platform: item.platform,
      url: item.url,
    });
  }

  return (
    <div className="space-y-4">
      {potd?.today && (
        <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3.5 border-sky-500/25">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-accent-ui">
                <Flame className="w-4 h-4 text-amber-500" />
                <span>Today&apos;s LeetCode POTD · {potd.today.date}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={potd.today.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-bold text-primary-ui hover:text-accent-ui inline-flex items-center gap-1.5"
                >
                  {potd.today.id}. {potd.today.title}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <span className="pill-inactive text-xs px-2 py-0.5 rounded-md font-medium">
                  {potd.today.difficulty}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {potd.today.tags.map((t) => (
                  <span
                    key={t}
                    className={`text-xs px-2 py-0.5 rounded-md border ${
                      weakSet.has(t)
                        ? "badge-gap"
                        : "pill-inactive"
                    }`}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isOwner && geminiKey && (
                <button
                  onClick={() =>
                    handleAskGemini({
                      key: makeProblemKey("LeetCode", potd.today.slug),
                      platform: "LeetCode",
                      title: potd.today.title,
                      ratingLabel: potd.today.difficulty,
                      tags: potd.today.tags,
                      reason: "Daily POTD",
                    })
                  }
                  disabled={aiLoading === makeProblemKey("LeetCode", potd.today.slug)}
                  className="btn-primary text-xs px-3 py-2 rounded-xl font-medium inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {aiLoading === makeProblemKey("LeetCode", potd.today.slug) ? "Thinking..." : "AI Coach Hint"}
                </button>
              )}
              <button
                onClick={() => {
                  const k = makeProblemKey("LeetCode", potd.today.slug);
                  const cur = progress[k]?.status || "todo";
                  onUpdateProgress(k, {
                    status: cur === "done" ? "todo" : "done",
                    title: `${potd.today.id}. ${potd.today.title}`,
                    platform: "LeetCode",
                    url: potd.today.url,
                  });
                }}
                className={`text-xs px-3.5 py-2 rounded-xl border font-medium inline-flex items-center gap-1.5 transition ${
                  progress[makeProblemKey("LeetCode", potd.today.slug)]?.status === "done"
                    ? "badge-ok"
                    : "pill-inactive"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {progress[makeProblemKey("LeetCode", potd.today.slug)]?.status === "done" ? "POTD Done" : "Mark POTD Done"}
              </button>
            </div>
          </div>

          {aiHints[makeProblemKey("LeetCode", potd.today.slug)] && (
            <div className="surface-inset p-3.5 rounded-xl border-sky-500/30 text-xs text-primary-ui whitespace-pre-wrap leading-relaxed">
              {aiHints[makeProblemKey("LeetCode", potd.today.slug)]}
            </div>
          )}

          {potdFollowUps.length > 0 && (
            <div className="pt-2.5 border-t border-slate-300/40 dark:border-slate-800/80">
              <div className="text-xs text-muted-ui mb-2">
                Rolling 12-month contest follow-ups sharing today&apos;s POTD topics:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {potdFollowUps.slice(0, 3).map((q) => (
                  <a
                    key={`${q.platform}-${q.id}`}
                    href={q.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="surface-inset p-2.5 rounded-xl hover:border-sky-500/50 text-xs flex items-start justify-between gap-2 transition"
                  >
                    <div className="min-w-0">
                      <div className="text-muted-ui font-mono">
                        {q.platform} · {q.slot}
                      </div>
                      <div className="text-primary-ui font-medium line-clamp-2 mt-0.5">{q.title}</div>
                    </div>
                    <span className="badge-accent font-mono shrink-0 px-1.5 py-0.5 rounded">
                      {q.rating ?? q.difficulty}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {aiError && (
        <div className="badge-gap p-3 rounded-xl text-xs">
          {aiError}
        </div>
      )}

      <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              ["all", "All"],
              ["attempted_unsolved", "Attempted"],
              ["missed_contest", "Contest Missed"],
              ["potd_match", "POTD Match"],
              ["weak_pillar", "Gap Drills"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setBucket(id)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
                  bucket === id
                    ? "btn-primary"
                    : "pill-inactive"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {topicJumpFilter && (
              <button
                onClick={() => {
                  onClearTopicJump();
                  setSearch("");
                }}
                className="badge-accent text-xs px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1"
              >
                Topic: {topicJumpFilter} <X className="w-3 h-3" />
              </button>
            )}
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              aria-label="Filter by contest slot or difficulty"
              className="input-field text-xs px-2.5 py-1.5 rounded-lg"
            >
              <option value="all">All Slots (Q1–Q4 · A–G)</option>
              <option value="early">Early Contest (Q1–Q2 · A–B · ≤1300)</option>
              <option value="late">Later Contest (Q3–Q4 · 1300+)</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by upsolve status"
              className="input-field text-xs px-2.5 py-1.5 rounded-lg"
            >
              <option value="open">Pending / Revisit</option>
              <option value="revisit">Revisit Only</option>
              <option value="done">Completed ✓</option>
              <option value="all">All Statuses</option>
            </select>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search upsolve questions"
              placeholder="Search title, tag, platform..."
              className="input-field text-xs px-3 py-1.5 rounded-lg w-52"
            />
          </div>
        </div>

        <div className="text-xs text-muted-ui">
          Showing <span className="font-mono text-primary-ui font-medium">{filtered.length}</span> questions ·{" "}
          {isOwner
            ? "Synced with your private Firebase Firestore (ticks & notes persist across devices)."
            : "Guest session mode (changes are temporary in memory only)."}
        </div>

        <div className="space-y-2.5">
          {filtered.slice(0, 60).map((item) => {
            const p = progress[item.key];
            const st = p?.status || "todo";
            const isNoteOpen = openNoteKey === item.key;

            return (
              <div
                key={item.key}
                className={`p-3.5 rounded-xl border transition ${BUCKET_ACCENT[item.bucket]} ${
                  st === "done"
                    ? "badge-ok"
                    : st === "revisit"
                    ? "badge-warn"
                    : "surface-inset"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="pill-inactive text-xs font-mono px-2 py-0.5 rounded-md">
                        {item.platform} · {item.slot}
                      </span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-primary-ui hover:text-accent-ui inline-flex items-center gap-1"
                      >
                        {item.title}
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                      <span className="badge-accent text-xs font-mono px-2 py-0.5 rounded-md">
                        {item.ratingLabel}
                      </span>
                    </div>
                    <div className="text-xs text-muted-ui">{item.reason}</div>
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((t) => (
                        <span
                          key={t}
                          className={`text-xs px-2 py-0.5 rounded-md border ${
                            weakSet.has(t)
                              ? "badge-gap"
                              : "pill-inactive"
                          }`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isOwner && geminiKey && (
                      <button
                        onClick={() => handleAskGemini(item)}
                        disabled={aiLoading === item.key}
                        className="badge-accent text-xs px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1 hover:brightness-110"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {aiLoading === item.key ? "..." : "AI Hint"}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (isNoteOpen) {
                          setOpenNoteKey(null);
                        } else {
                          setOpenNoteKey(item.key);
                          setNoteDraft(p?.note || "");
                        }
                      }}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border inline-flex items-center gap-1 ${
                        p?.note
                          ? "badge-accent"
                          : "pill-inactive"
                      }`}
                    >
                      <NotebookPen className="w-3.5 h-3.5" />
                      {p?.note ? "Note" : "+ Note"}
                    </button>

                    <button
                      onClick={() => cycleStatus(item)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border inline-flex items-center gap-1 ${
                        st === "done"
                          ? "badge-ok"
                          : st === "revisit"
                          ? "badge-warn"
                          : "pill-inactive"
                      }`}
                    >
                      {st === "revisit" ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" /> Revisit
                        </>
                      ) : st === "done" ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Done
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Tick
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {p?.note && !isNoteOpen && (
                  <div className="surface-card mt-2.5 px-3 py-2 rounded-lg text-xs text-secondary-ui">
                    <span className="text-accent-ui font-medium">Note: </span>
                    {p.note}
                  </div>
                )}

                {aiHints[item.key] && (
                  <div className="surface-card mt-2.5 px-3 py-2.5 rounded-lg border-sky-500/30 text-xs text-primary-ui whitespace-pre-wrap leading-relaxed">
                    {aiHints[item.key]}
                  </div>
                )}

                {isNoteOpen && (
                  <div className="mt-2.5 space-y-2 pt-2.5 border-t border-slate-300/40 dark:border-slate-800">
                    <textarea
                      rows={3}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Write key observation, invariant, or mistake to remember..."
                      className="input-field w-full text-xs p-2.5 rounded-lg"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setOpenNoteKey(null)}
                        className="pill-inactive text-xs px-3 py-1 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          onUpdateProgress(item.key, {
                            note: noteDraft.trim(),
                            title: item.title,
                            platform: item.platform,
                            url: item.url,
                          });
                          setOpenNoteKey(null);
                        }}
                        className="btn-primary text-xs px-3 py-1 rounded-lg"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
