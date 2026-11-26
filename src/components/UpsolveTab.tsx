import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Flame,
  NotebookPen,
  RotateCcw,
  Sparkles,
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
  onUpdateProgress: (
    key: string,
    patch: Partial<ProblemProgress> & { title: string; platform: Platform; url: string }
  ) => void;
}

export function UpsolveTab({
  potd,
  potdFollowUps,
  upsolveQueue,
  weakTags,
  progress,
  isOwner,
  geminiKey,
  onUpdateProgress,
}: Props) {
  const [bucket, setBucket] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [search, setSearch] = useState("");
  const [openNoteKey, setOpenNoteKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [aiHints, setAiHints] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const weakSet = useMemo(() => new Set(weakTags), [weakTags]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return upsolveQueue.filter((item) => {
      if (bucket !== "all" && item.bucket !== bucket) return false;
      const st = progress[item.key]?.status || "todo";
      if (statusFilter === "open" && st === "done") return false;
      if (statusFilter === "done" && st !== "done") return false;
      if (statusFilter === "revisit" && st !== "revisit") return false;
      if (q) {
        const hay = `${item.title} ${item.platform} ${item.tags.join(" ")} ${item.reason}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [upsolveQueue, bucket, statusFilter, search, progress]);

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
      {/* POTD Spotlight */}
      {potd?.today && (
        <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Today's LeetCode POTD ({potd.today.date})</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={potd.today.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base font-bold text-white hover:text-indigo-300 inline-flex items-center gap-1.5"
                >
                  {potd.today.id}. {potd.today.title}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <span className="text-xs px-2 py-0.5 rounded border border-slate-700 bg-slate-950/70 text-slate-200">
                  {potd.today.difficulty}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {potd.today.tags.map((t) => (
                  <span
                    key={t}
                    className={`text-xs px-2 py-0.5 rounded border ${
                      weakSet.has(t)
                        ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                        : "bg-slate-950/60 border-slate-800 text-slate-300"
                    }`}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
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
                  className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white inline-flex items-center gap-1.5 disabled:opacity-60"
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
                className={`text-xs px-3 py-1.5 rounded-lg border inline-flex items-center gap-1.5 ${
                  progress[makeProblemKey("LeetCode", potd.today.slug)]?.status === "done"
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-slate-950 border-slate-700 text-slate-200 hover:border-slate-500"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {progress[makeProblemKey("LeetCode", potd.today.slug)]?.status === "done" ? "POTD Done" : "Mark POTD Done"}
              </button>
            </div>
          </div>

          {aiHints[makeProblemKey("LeetCode", potd.today.slug)] && (
            <div className="p-3 rounded-lg bg-slate-950/80 border border-indigo-500/30 text-xs text-slate-200 whitespace-pre-wrap">
              {aiHints[makeProblemKey("LeetCode", potd.today.slug)]}
            </div>
          )}

          {potdFollowUps.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80">
              <div className="text-xs text-slate-400 mb-2">
                Rolling 12-month contest follow-ups sharing today's POTD topics:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {potdFollowUps.slice(0, 3).map((q) => (
                  <a
                    key={q.id}
                    href={q.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 text-xs flex items-center justify-between gap-2"
                  >
                    <span className="truncate text-slate-200">
                      {q.platform} {q.slot} · {q.title}
                    </span>
                    <span className="font-mono text-indigo-300 shrink-0">{q.rating ?? q.difficulty}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {aiError && (
        <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
          {aiError}
        </div>
      )}

      {/* Upsolve Controls */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              ["all", "All Recommended"],
              ["attempted_unsolved", "Attempted & Unsolved"],
              ["missed_contest", "Missed Contest Q3/Q4"],
              ["potd_match", "POTD Matches"],
              ["weak_pillar", "12-Mo Gap Drills"],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setBucket(id)}
                className={`text-xs px-3 py-1.5 rounded-lg border ${
                  bucket === id
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
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
              placeholder="Search title, tag, platform..."
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 w-52"
            />
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Showing {filtered.length} questions ·{" "}
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
                className={`p-3 rounded-xl border transition ${
                  st === "done"
                    ? "bg-emerald-950/20 border-emerald-500/30"
                    : st === "revisit"
                    ? "bg-amber-950/20 border-amber-500/30"
                    : "bg-slate-950/70 border-slate-800"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                        {item.platform} · {item.slot}
                      </span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-white hover:text-indigo-400 inline-flex items-center gap-1"
                      >
                        {item.title}
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">
                        {item.ratingLabel}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">{item.reason}</div>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {item.tags.map((t) => (
                        <span
                          key={t}
                          className={`text-xs px-2 py-0.5 rounded border ${
                            weakSet.has(t)
                              ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                              : "bg-slate-900 border-slate-800 text-slate-300"
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
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 inline-flex items-center gap-1"
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
                          ? "bg-sky-500/15 border-sky-500/40 text-sky-300"
                          : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      <NotebookPen className="w-3.5 h-3.5" />
                      {p?.note ? "Note" : "+ Note"}
                    </button>

                    <button
                      onClick={() => cycleStatus(item)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border inline-flex items-center gap-1 ${
                        st === "done"
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : st === "revisit"
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                          : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
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
                  <div className="mt-2 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
                    <span className="text-sky-400 font-medium">Note: </span>
                    {p.note}
                  </div>
                )}

                {aiHints[item.key] && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-xs text-slate-200 whitespace-pre-wrap">
                    {aiHints[item.key]}
                  </div>
                )}

                {isNoteOpen && (
                  <div className="mt-2.5 space-y-2 pt-2 border-t border-slate-800">
                    <textarea
                      rows={3}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Write key observation, invariant, or mistake to remember..."
                      className="w-full text-xs p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setOpenNoteKey(null)}
                        className="text-xs px-3 py-1 rounded-lg border border-slate-700 text-slate-300"
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
                        className="text-xs px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
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
