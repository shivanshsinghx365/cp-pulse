import { useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, RotateCcw } from "lucide-react";
import type { ContestRecord, Platform, ProblemProgress } from "../types";
import { GENERIC_TAGS, makeProblemKey } from "../lib/tags";

interface TierDef {
  id: string;
  label: string;
  plat: Platform;
  tier: string | null;
  slots: string[];
}

const TIER_DEFS: TierDef[] = [
  { id: "LC_ALL", label: "LeetCode (All)", plat: "LeetCode", tier: null, slots: ["Q1", "Q2", "Q3", "Q4"] },
  { id: "LC_W", label: "LC Weekly", plat: "LeetCode", tier: "Weekly", slots: ["Q1", "Q2", "Q3", "Q4"] },
  { id: "LC_BW", label: "LC Biweekly", plat: "LeetCode", tier: "Biweekly", slots: ["Q1", "Q2", "Q3", "Q4"] },
  { id: "CF_ALL", label: "Codeforces (2/3/4)", plat: "Codeforces", tier: null, slots: ["A", "B", "C", "D", "E", "F", "G"] },
  { id: "CF_4", label: "CF Div. 4", plat: "Codeforces", tier: "Div. 4", slots: ["A", "B", "C", "D", "E", "F", "G", "H"] },
  { id: "CF_3", label: "CF Div. 3", plat: "Codeforces", tier: "Div. 3", slots: ["A", "B", "C", "D", "E", "F", "G", "H"] },
  { id: "CF_2", label: "CF Div. 2", plat: "Codeforces", tier: "Div. 2", slots: ["A", "B", "C", "D", "E", "F", "G"] },
  { id: "AC_ABC", label: "AtCoder ABC", plat: "AtCoder", tier: "ABC", slots: ["A", "B", "C", "D", "E", "F", "G"] },
];

interface Props {
  contests: ContestRecord[];
  weakTags: string[];
  progress: Record<string, ProblemProgress>;
  onToggleStatus: (key: string, meta: { title: string; platform: Platform; url: string }) => void;
}

export function HeatmapTab({ contests, weakTags, progress, onToggleStatus }: Props) {
  const [tierId, setTierId] = useState("LC_ALL");
  const [hideGeneric, setHideGeneric] = useState(true);
  const [drill, setDrill] = useState<{ slot: string; tag: string } | null>(null);

  const def = TIER_DEFS.find((t) => t.id === tierId) || TIER_DEFS[0];
  const weakSet = useMemo(() => new Set(weakTags), [weakTags]);

  const { filteredProbs, slotStats, rowTags } = useMemo(() => {
    const fc = contests.filter((c) => c.platform === def.plat && (!def.tier || c.tier === def.tier));
    const probs = fc.flatMap((c) => c.questions);
    const vis = (tags: string[]) => (hideGeneric ? tags.filter((t) => !GENERIC_TAGS.has(t)) : tags);

    const stats: Record<
      string,
      { count: number; tagCounts: Record<string, number>; medRating: number | null; topDiff: string }
    > = {};

    for (const sl of def.slots) {
      const qs = probs.filter((q) => q.slot === sl);
      const tc: Record<string, number> = {};
      for (const q of qs) {
        for (const t of new Set(vis(q.tags))) {
          tc[t] = (tc[t] || 0) + 1;
        }
      }
      const rs = qs
        .map((q) => q.rating)
        .filter((r): r is number => r !== null)
        .sort((a, b) => a - b);
      const medRating = rs.length ? rs[Math.floor(rs.length / 2)] : null;
      const dc: Record<string, number> = {};
      for (const q of qs) dc[q.difficulty] = (dc[q.difficulty] || 0) + 1;
      const topD = Object.entries(dc).sort((a, b) => b[1] - a[1])[0];
      stats[sl] = {
        count: qs.length,
        tagCounts: tc,
        medRating,
        topDiff: topD ? `${topD[0]} (${Math.round((100 * topD[1]) / Math.max(1, qs.length))}%)` : "",
      };
    }

    const overall: Record<string, number> = {};
    for (const q of probs) {
      for (const t of new Set(vis(q.tags))) overall[t] = (overall[t] || 0) + 1;
    }
    const rTags = Object.entries(overall)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
      .map((x) => x[0]);

    return { filteredProbs: probs, slotStats: stats, rowTags: rTags };
  }, [contests, def, hideGeneric]);

  const drillProbs = useMemo(() => {
    if (!drill) return [];
    return filteredProbs
      .filter((q) => q.slot === drill.slot && q.tags.includes(drill.tag))
      .sort((a, b) => b.startTime - a.startTime);
  }, [filteredProbs, drill]);

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {TIER_DEFS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTierId(t.id);
                  setDrill(null);
                }}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
                  tierId === t.id
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideGeneric}
              onChange={(e) => setHideGeneric(e.target.checked)}
              className="accent-indigo-500"
            />
            Focus algorithmic tags (hide generic Array / Implementation)
          </label>
        </div>

        {/* Slot cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {def.slots.map((sl) => {
            const sd = slotStats[sl];
            const top3 = Object.entries(sd.tagCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3);
            return (
              <div key={sl} className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-white">{sl}</span>
                  <span className="text-xs text-slate-400">n={sd.count}</span>
                </div>
                <div className="text-xs text-indigo-400 font-medium">
                  {def.plat === "LeetCode"
                    ? `${sd.topDiff}${sd.medRating ? ` · ~${sd.medRating}` : ""}`
                    : sd.medRating !== null
                    ? `Median ~${sd.medRating}`
                    : "Unrated"}
                </div>
                <div className="space-y-0.5 pt-1">
                  {top3.map(([t, c]) => (
                    <div key={t} className="flex justify-between text-xs gap-1">
                      <span className={`truncate ${weakSet.has(t) ? "text-rose-400" : "text-slate-300"}`}>
                        {t}
                      </span>
                      <span className="font-mono text-slate-400 shrink-0">
                        {Math.round((100 * c) / Math.max(1, sd.count))}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-slate-900/70 border border-slate-800 rounded-xl p-4 overflow-x-auto">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-white">Rolling 12-Month Topic × Question Slot Heatmap</h2>
            <p className="text-xs text-slate-400">
              Red badges indicate your current gap/capped topics. Click any cell to drill down and tick off problems.
            </p>
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="py-2 px-2.5 text-slate-400 font-semibold">Topic</th>
                {def.slots.map((sl) => (
                  <th key={sl} className="py-2 px-2 text-center font-semibold text-slate-200 min-w-[58px]">
                    {sl}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowTags.map((tag) => (
                <tr key={tag} className="border-b border-slate-800/60">
                  <td className="py-1.5 px-2.5 font-medium whitespace-nowrap text-slate-200">
                    {tag}
                    {weakSet.has(tag) && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        Gap
                      </span>
                    )}
                  </td>
                  {def.slots.map((sl) => {
                    const n = slotStats[sl].count;
                    const cnt = slotStats[sl].tagCounts[tag] || 0;
                    const pct = n ? Math.round((100 * cnt) / n) : 0;
                    const alpha = cnt === 0 ? 0.04 : Math.min(0.9, 0.12 + (pct / 70) * 0.78);
                    const active = drill?.slot === sl && drill?.tag === tag;
                    return (
                      <td key={sl} className="p-1 text-center">
                        <button
                          onClick={() => setDrill({ slot: sl, tag })}
                          style={{ backgroundColor: `rgba(99, 102, 241, ${alpha.toFixed(2)})` }}
                          className={`w-full py-1.5 rounded transition ${
                            pct >= 40 ? "text-white font-bold" : cnt > 0 ? "text-slate-100" : "text-slate-500"
                          } ${active ? "ring-2 ring-amber-400" : "hover:brightness-110"}`}
                          title={`${tag} in ${sl}: ${cnt}/${n} (${pct}%)`}
                        >
                          {pct}%
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-white">
              {drill ? `${def.label} · ${drill.slot} · ${drill.tag}` : "Click any heatmap cell"}
            </h3>
            <p className="text-xs text-slate-400">
              {drill
                ? `${drillProbs.length} matching problems in the past 12 months`
                : "Inspect problems and mark your upsolve progress."}
            </p>
          </div>
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {drillProbs.map((q) => {
              const pKey = makeProblemKey(q.platform, q.id);
              const st = progress[pKey]?.status || "todo";
              return (
                <div
                  key={pKey}
                  className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-2"
                >
                  <div className="min-w-0">
                    <a
                      href={q.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-slate-100 hover:text-indigo-400 inline-flex items-center gap-1 truncate max-w-full"
                    >
                      <span className="truncate">{q.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {q.contestTitle} · {q.dateStr} · {q.rating ?? q.difficulty}
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      onToggleStatus(pKey, { title: q.title, platform: q.platform, url: q.url })
                    }
                    title="Toggle status (Todo -> Done -> Revisit)"
                    className={`shrink-0 p-1.5 rounded-lg border text-xs ${
                      st === "done"
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                        : st === "revisit"
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                        : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                    }`}
                  >
                    {st === "revisit" ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
