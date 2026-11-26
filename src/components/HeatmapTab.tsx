import { useMemo, useRef, useState } from "react";
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

function heatClass(pct: number, cnt: number): string {
  if (cnt === 0) return "heat-0";
  if (pct >= 45) return "heat-4";
  if (pct >= 30) return "heat-3";
  if (pct >= 15) return "heat-2";
  return "heat-1";
}

export function HeatmapTab({ contests, weakTags, progress, onToggleStatus }: Props) {
  const [tierId, setTierId] = useState("LC_ALL");
  const [hideGeneric, setHideGeneric] = useState(true);
  const [drill, setDrill] = useState<{ slot: string; tag: string } | null>(null);
  const drillRef = useRef<HTMLDivElement | null>(null);

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
        topDiff: topD ? `${topD[0]} ${Math.round((100 * topD[1]) / Math.max(1, qs.length))}%` : "",
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

  const slotGridCols =
    def.slots.length === 4
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      : def.slots.length <= 7
      ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-7"
      : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-8";

  function handleCellClick(slot: string, tag: string) {
    setDrill({ slot, tag });
    if (window.innerWidth < 1024) {
      setTimeout(() => drillRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
    }
  }

  return (
    <div className="space-y-4">
      <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-4">
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
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                    : "pill-inactive"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-secondary-ui cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideGeneric}
              onChange={(e) => setHideGeneric(e.target.checked)}
              className="accent-indigo-500"
            />
            Focus algorithmic tags (hide Array / Impl)
          </label>
        </div>

        <div className={`grid ${slotGridCols} gap-2.5`}>
          {def.slots.map((sl) => {
            const sd = slotStats[sl];
            const top3 = Object.entries(sd.tagCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3);
            return (
              <div key={sl} className="surface-inset rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-primary-ui">{sl}</span>
                  <span className="text-xs font-mono text-muted-ui">n={sd.count}</span>
                </div>
                <div className="text-xs text-indigo-500 dark:text-indigo-400 font-medium whitespace-nowrap truncate">
                  {def.plat === "LeetCode"
                    ? `${sd.topDiff}${sd.medRating ? ` · ~${sd.medRating}` : ""}`
                    : sd.medRating !== null
                    ? `Median ~${sd.medRating}`
                    : "Unrated"}
                </div>
                <div className="space-y-1 pt-1.5 border-t border-slate-300/40 dark:border-slate-800/70">
                  {top3.map(([t, c]) => (
                    <div key={t} className="flex justify-between items-center text-xs gap-2">
                      <span className={`truncate ${weakSet.has(t) ? "text-rose-500 font-medium" : "text-secondary-ui"}`}>
                        {t}
                      </span>
                      <span className="font-mono text-muted-ui shrink-0">
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

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)] gap-4 items-start">
        <div className="surface-card rounded-2xl p-4 sm:p-5 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-sm font-semibold text-primary-ui">Rolling 12-Month Topic × Question Slot Heatmap</h2>
              <p className="text-xs text-muted-ui">Click any cell to inspect problems and tick off upsolves.</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-ui">
              <span>0%</span>
              <span className="w-3.5 h-3 rounded heat-0" />
              <span className="w-3.5 h-3 rounded heat-1" />
              <span className="w-3.5 h-3 rounded heat-2" />
              <span className="w-3.5 h-3 rounded heat-3" />
              <span className="w-3.5 h-3 rounded heat-4" />
              <span>45%+</span>
            </div>
          </div>

          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-300/50 dark:border-slate-800 text-left">
                <th className="py-2 pr-3 text-muted-ui font-semibold w-52">Topic</th>
                {def.slots.map((sl) => (
                  <th key={sl} className="py-2 px-1 text-center font-semibold text-primary-ui min-w-[54px]">
                    {sl}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowTags.map((tag) => (
                <tr key={tag} className="border-b border-slate-300/30 dark:border-slate-800/50">
                  <td className="py-1.5 pr-3 font-medium whitespace-nowrap text-primary-ui max-w-[220px]">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate">{tag}</span>
                      {weakSet.has(tag) && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500 border border-rose-500/30 shrink-0">
                          Gap
                        </span>
                      )}
                    </div>
                  </td>
                  {def.slots.map((sl) => {
                    const n = slotStats[sl].count;
                    const cnt = slotStats[sl].tagCounts[tag] || 0;
                    const pct = n ? Math.round((100 * cnt) / n) : 0;
                    const active = drill?.slot === sl && drill?.tag === tag;
                    return (
                      <td key={sl} className="p-1 text-center">
                        <button
                          onClick={() => handleCellClick(sl, tag)}
                          className={`w-full py-1.5 rounded-md font-mono transition ${heatClass(pct, cnt)} ${
                            active ? "ring-2 ring-amber-400" : "hover:brightness-110"
                          }`}
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

        <div ref={drillRef} className="surface-card rounded-2xl p-4 sm:p-5 space-y-3 lg:sticky lg:top-4">
          <div>
            <h3 className="text-sm font-semibold text-primary-ui">
              {drill ? `${def.label} · ${drill.slot} · ${drill.tag}` : "Problem Drill-Down"}
            </h3>
            <p className="text-xs text-muted-ui">
              {drill
                ? `${drillProbs.length} matching problems in the past 12 months`
                : "Click any cell in the heatmap to list matching questions here."}
            </p>
          </div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {drillProbs.map((q) => {
              const pKey = makeProblemKey(q.platform, q.id);
              const st = progress[pKey]?.status || "todo";
              return (
                <div
                  key={pKey}
                  className="surface-inset p-3 rounded-xl flex items-start justify-between gap-2.5 transition"
                >
                  <div className="min-w-0">
                    <a
                      href={q.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary-ui hover:text-indigo-500 inline-flex items-center gap-1 max-w-full"
                    >
                      <span className="truncate">{q.title}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                    <div className="text-xs text-muted-ui mt-0.5">
                      {q.contestTitle} · {q.dateStr} · <span className="font-mono text-indigo-500 dark:text-indigo-300">{q.rating ?? q.difficulty}</span>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      onToggleStatus(pKey, { title: q.title, platform: q.platform, url: q.url })
                    }
                    title="Toggle status (Todo -> Done -> Revisit)"
                    aria-label={`Toggle status for ${q.title}`}
                    className={`shrink-0 p-1.5 rounded-lg border text-xs transition ${
                      st === "done"
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-500"
                        : st === "revisit"
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-500"
                        : "pill-inactive"
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
