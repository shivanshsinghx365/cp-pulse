import { useState } from "react";
import type { ProfileDiagnosis } from "../lib/analyzer";
import type { OwnerSnapshot } from "../types";
import type { LiveCfResult } from "../lib/liveApi";

interface Props {
  diagnosis: ProfileDiagnosis;
  cfData: LiveCfResult | null;
  lcData: OwnerSnapshot["leetcode"] | null;
  isOwner: boolean;
  targetCfRating: number;
  targetLcRating: number;
}

export function DiagnosisTab({
  diagnosis,
  cfData,
  lcData,
  isOwner,
  targetCfRating,
  targetLcRating,
}: Props) {
  const [tagFilter, setTagFilter] = useState("");
  const rows = diagnosis.cfAudit.filter(
    (r) => !tagFilter.trim() || r.tag.toLowerCase().includes(tagFilter.trim().toLowerCase())
  );

  const badgeClass = (v: string) => {
    if (v === "Strong") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (v === "Capped") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    if (v === "Gap") return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    return "bg-slate-800 text-slate-400 border-slate-700";
  };

  return (
    <div className="space-y-4">
      {/* Live Profile KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400">Codeforces ({cfData?.info.handle || "No handle loaded"})</div>
          <div className="text-lg font-bold text-white">
            {cfData?.info.rating ?? "—"}
            <span className="text-xs font-normal text-slate-400 ml-2">
              Peak {cfData?.info.maxRating ?? "—"} · Goal {targetCfRating}
            </span>
          </div>
          <div className="text-xs text-slate-400">
            {diagnosis.cfSolvedCount} solved · {diagnosis.cfUnsolved.length} attempted &amp; unsolved
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400">AtCoder ABC</div>
          <div className="text-lg font-bold text-white">
            {diagnosis.acSolvedCount} ACs
            <span className="text-xs font-normal text-slate-400 ml-2">
              Max diff: {diagnosis.acMaxDiff ?? "—"}
            </span>
          </div>
          <div className="text-xs text-slate-400">
            {diagnosis.acUnsolved.length} attempted &amp; unsolved
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400">
            LeetCode {lcData ? "(Synced via Daily Action)" : "(Guest: Clone repo for LC Sync)"}
          </div>
          <div className="text-lg font-bold text-white">
            {lcData?.ranking ? Math.round(lcData.ranking.rating) : "—"}
            <span className="text-xs font-normal text-slate-400 ml-2">
              Goal {targetLcRating} (Guardian)
            </span>
          </div>
          <div className="text-xs text-slate-400">
            {lcData?.ranking
              ? `${lcData.ranking.attendedContestsCount} contests · Top ${lcData.ranking.topPercentage}%`
              : isOwner
              ? "Run GitHub Action sync to refresh LeetCode snapshot"
              : "LeetCode blocks browser CORS; CF & AtCoder run live."}
          </div>
        </div>
      </div>

      {/* CF Rating Distribution + Weak Pillars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Codeforces Solved Distribution by Rating</h2>
            <p className="text-xs text-slate-400">
              Shows where your solved volume drops off before Expert (1600) / CM (1900).
            </p>
          </div>
          <div className="space-y-2">
            {diagnosis.cfRatingBuckets.length === 0 ? (
              <div className="text-xs text-slate-400">Load a Codeforces handle to inspect rating distribution.</div>
            ) : (
              diagnosis.cfRatingBuckets.map((b) => {
                const maxC = Math.max(...diagnosis.cfRatingBuckets.map((x) => x.count));
                const pct = Math.round((100 * b.count) / Math.max(1, maxC));
                const num = Number(b.label);
                const col =
                  num >= 1600 ? "bg-indigo-500" : num >= 1400 ? "bg-cyan-500" : num >= 1200 ? "bg-emerald-500" : "bg-slate-500";
                return (
                  <div key={b.label} className="flex items-center gap-2 text-xs">
                    <span className="w-12 font-mono text-slate-300">{b.label}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-slate-950 overflow-hidden">
                      <div className={`h-full rounded-full ${col}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right font-mono text-slate-400">{b.count}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Detected Weak / Capped Topics</h2>
            <p className="text-xs text-slate-400">
              Automatically flagged where your AC rate is low, max rating solved is below {targetCfRating}, or high-demand contest tags are untouched.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {diagnosis.weakTags.length === 0 ? (
              <span className="text-xs text-slate-400">No weak tags flagged yet.</span>
            ) : (
              diagnosis.weakTags.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 font-medium"
                >
                  {t}
                </span>
              ))
            )}
          </div>

          {lcData && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-200">Recent LeetCode Contests (Last 6 Attended)</div>
              <div className="space-y-1.5">
                {lcData.contestHistory.slice(-6).reverse().map((h) => (
                  <div
                    key={h.slug}
                    className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800"
                  >
                    <span className="text-slate-200 truncate">{h.title}</span>
                    <span className="font-mono text-slate-400 shrink-0">
                      {h.solved}/{h.total} · Rank {h.ranking} · <span className="text-indigo-400">{h.rating}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tag Audit Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">Tag-by-Tag Codeforces Audit</h2>
            <p className="text-xs text-slate-400">
              Checks both AC rate and your highest solved rating per topic against your target ({targetCfRating}).
            </p>
          </div>
          <input
            type="text"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            placeholder="Filter topic..."
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 w-48"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-400">
                <th className="py-2 px-2.5">Topic</th>
                <th className="py-2 px-2.5">Verdict</th>
                <th className="py-2 px-2.5 text-right">OK</th>
                <th className="py-2 px-2.5 text-right">Unsolved</th>
                <th className="py-2 px-2.5 text-right">AC Rate</th>
                <th className="py-2 px-2.5 text-right">Median</th>
                <th className="py-2 px-2.5 text-right">Max Rating</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tag} className="border-b border-slate-800/60 hover:bg-slate-950/50">
                  <td className="py-1.5 px-2.5 font-medium text-slate-200">{r.tag}</td>
                  <td className="py-1.5 px-2.5">
                    <span className={`px-2 py-0.5 rounded border ${badgeClass(r.verdict)}`}>{r.verdict}</span>
                  </td>
                  <td className="py-1.5 px-2.5 text-right font-mono">{r.ok}</td>
                  <td className="py-1.5 px-2.5 text-right font-mono text-rose-400">{r.fail}</td>
                  <td className="py-1.5 px-2.5 text-right font-mono">{r.ok + r.fail ? `${r.acRate}%` : "—"}</td>
                  <td className="py-1.5 px-2.5 text-right font-mono">{r.medRating ?? "—"}</td>
                  <td className="py-1.5 px-2.5 text-right font-mono">{r.maxRating ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
