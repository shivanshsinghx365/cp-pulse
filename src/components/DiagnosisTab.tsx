import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { ProfileDiagnosis } from "../lib/analyzer";
import type { OwnerSnapshot } from "../types";
import type { LiveCfResult } from "../lib/liveApi";

interface Props {
  diagnosis: ProfileDiagnosis;
  cfData: LiveCfResult | null;
  lcData: OwnerSnapshot["leetcode"] | null;
  isOwner: boolean;
  hasProfile: boolean;
  targetCfRating: number;
  targetLcRating: number;
  onJumpToTopic: (tag: string) => void;
}

export function DiagnosisTab({
  diagnosis,
  cfData,
  lcData,
  isOwner,
  hasProfile,
  targetCfRating,
  targetLcRating,
  onJumpToTopic,
}: Props) {
  const [tagFilter, setTagFilter] = useState("");
  const rows = diagnosis.cfAudit.filter(
    (r) => !tagFilter.trim() || r.tag.toLowerCase().includes(tagFilter.trim().toLowerCase())
  );

  const badgeClass = (v: string) => {
    if (v === "Strong") return "badge-ok";
    if (v === "Capped") return "badge-warn";
    if (v === "Gap") return "badge-gap";
    return "pill-inactive";
  };

  if (!hasProfile) {
    return (
      <div className="surface-card rounded-2xl p-6 sm:p-8 text-center space-y-2">
        <h2 className="text-sm font-semibold text-primary-ui">No Profile Loaded</h2>
        <p className="text-xs text-muted-ui max-w-lg mx-auto leading-relaxed">
          {isOwner
            ? "Save your Codeforces / AtCoder handles or import your LeetCode snapshot in Settings to populate your private diagnosis."
            : "The owner profile is private and hidden by default. Sign in as the Owner or enter your own Codeforces / AtCoder handle above to inspect ratings, weak topics, and slot consistency locally."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="surface-card rounded-2xl p-4 space-y-1">
          <div className="text-xs text-muted-ui">Codeforces ({cfData?.info.handle || "No handle loaded"})</div>
          <div className="text-xl font-bold text-primary-ui font-mono">
            {cfData?.info.rating ?? "—"}
            <span className="text-xs font-sans font-normal text-muted-ui ml-2">
              Peak {cfData?.info.maxRating ?? "—"} · Goal {targetCfRating}
            </span>
          </div>
          <div className="text-xs text-muted-ui">
            {diagnosis.cfSolvedCount} solved · <span className="text-gap-ui">{diagnosis.cfUnsolved.length} attempted &amp; unsolved</span>
          </div>
        </div>

        <div className="surface-card rounded-2xl p-4 space-y-1">
          <div className="text-xs text-muted-ui">AtCoder ABC</div>
          <div className="text-xl font-bold text-primary-ui font-mono">
            {diagnosis.acSolvedCount} <span className="text-sm font-sans font-semibold">ACs</span>
            <span className="text-xs font-sans font-normal text-muted-ui ml-2">
              Max diff: {diagnosis.acMaxDiff ?? "—"}
            </span>
          </div>
          <div className="text-xs text-muted-ui">
            {diagnosis.acUnsolved.length} attempted &amp; unsolved
          </div>
        </div>

        <div className="surface-card rounded-2xl p-4 space-y-1">
          <div className="text-xs text-muted-ui">
            LeetCode {lcData?.ranking ? "(Live Synced)" : "(Enter handle & click Fetch Live)"}
          </div>
          <div className="text-xl font-bold text-primary-ui font-mono">
            {lcData?.ranking ? Math.round(lcData.ranking.rating) : "—"}
            <span className="text-xs font-sans font-normal text-muted-ui ml-2">
              Goal {targetLcRating} (Guardian)
            </span>
          </div>
          <div className="text-xs text-muted-ui">
            {lcData?.ranking
              ? `${lcData.ranking.attendedContestsCount} contests · Top ${lcData.ranking.topPercentage}%`
              : "Enter your LeetCode handle above & click Fetch Live"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <div className="surface-card rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-primary-ui">Codeforces Solved Distribution by Rating</h2>
              <p className="text-xs text-muted-ui">
                Shows where your solved volume drops off before Expert (1600) / CM (1900).
              </p>
            </div>
            <div className="space-y-2">
              {diagnosis.cfRatingBuckets.length === 0 ? (
                <div className="text-xs text-muted-ui">Load a Codeforces handle to inspect rating distribution.</div>
              ) : (
                diagnosis.cfRatingBuckets.map((b) => {
                  const maxC = Math.max(...diagnosis.cfRatingBuckets.map((x) => x.count));
                  const pct = Math.round((100 * b.count) / Math.max(1, maxC));
                  const num = Number(b.label);
                  const col =
                    num >= 1600 ? "bg-sky-500" : num >= 1400 ? "bg-cyan-500" : num >= 1200 ? "bg-teal-500" : "bg-slate-400";
                  return (
                    <div key={b.label} className="flex items-center gap-2.5 text-xs">
                      <span className="w-11 font-mono text-secondary-ui">{b.label}</span>
                      <div className="flex-1 h-2.5 rounded-full surface-inset overflow-hidden">
                        <div className={`h-full rounded-full ${col}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right font-mono text-muted-ui">{b.count}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-300/40 dark:border-slate-800/80 grid grid-cols-3 gap-2 text-xs">
            <div className="surface-inset rounded-xl p-2.5">
              <div className="text-muted-ui">Strong Tags</div>
              <div className="text-base font-bold text-ok-ui font-mono">
                {diagnosis.cfAudit.filter((r) => r.verdict === "Strong").length}
              </div>
            </div>
            <div className="surface-inset rounded-xl p-2.5">
              <div className="text-muted-ui">Capped / Gaps</div>
              <div className="text-base font-bold text-warn-ui font-mono">
                {diagnosis.cfAudit.filter((r) => r.verdict === "Gap" || r.verdict === "Capped").length}
              </div>
            </div>
            <div className="surface-inset rounded-xl p-2.5">
              <div className="text-muted-ui">Untouched</div>
              <div className="text-base font-bold text-gap-ui font-mono">
                {diagnosis.cfAudit.filter((r) => r.verdict === "Untouched").length}
              </div>
            </div>
          </div>
        </div>

        <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="space-y-2.5">
            <div>
              <h2 className="text-sm font-semibold text-primary-ui">Focus Topics to Strengthen</h2>
              <p className="text-xs text-muted-ui">
                Click any topic chip to jump directly to matching upsolve drills in Tab 1.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {diagnosis.weakTags.length === 0 ? (
                <span className="text-xs text-muted-ui">No weak tags flagged yet.</span>
              ) : (
                diagnosis.weakTags.map((t) => (
                  <button
                    key={t}
                    onClick={() => onJumpToTopic(t)}
                    className="badge-gap text-xs px-2.5 py-1 rounded-lg font-medium hover:brightness-110 transition inline-flex items-center gap-1"
                  >
                    <span>{t}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-80" />
                  </button>
                ))
              )}
            </div>
          </div>

          {lcData && (
            <div className="pt-3 border-t border-slate-300/40 dark:border-slate-800/80 space-y-2">
              <div className="text-xs font-semibold text-primary-ui">Recent LeetCode Contests (Last 6 Attended)</div>
              <div className="space-y-1.5">
                {lcData.contestHistory.slice(-6).reverse().map((h) => (
                  <div
                    key={h.slug}
                    className="surface-inset flex items-center justify-between text-xs px-3 py-2 rounded-xl"
                  >
                    <span className="text-primary-ui truncate">{h.title}</span>
                    <span className="font-mono text-muted-ui shrink-0">
                      {h.solved}/{h.total} · Rank {h.ranking} · <span className="text-accent-ui">{h.rating}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-primary-ui">Attended Codeforces Slot Consistency (Div. 2 / 3 / 4)</h2>
            <p className="text-xs text-muted-ui">
              Solve rate across {diagnosis.cfAttendedCount} rated rounds (pure Div. 1 excluded). Missed early slots auto-queue in Tab 1.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {diagnosis.cfSlotStats.map((s) => {
              const pct = s.total ? Math.round((100 * s.solved) / s.total) : 0;
              return (
                <div key={s.slot} className="surface-inset rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between font-semibold text-primary-ui">
                    <span>CF {s.slot}</span>
                    <span className="font-mono text-accent-ui">{pct}%</span>
                  </div>
                  <div className="text-muted-ui font-mono">
                    {s.solved}/{s.total}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-primary-ui">Attended LeetCode Slot Consistency (Q1–Q4)</h2>
            <p className="text-xs text-muted-ui">
              Clear rate across {lcData ? lcData.contestHistory.length : 0} attended contests. Any missed Q1/Q2 ranks top in Upsolve.
            </p>
          </div>
          {lcData && lcData.contestHistory.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 text-xs">
              {[1, 2, 3, 4].map((qNum) => {
                const cleared = lcData.contestHistory.filter((h) => h.solved >= qNum).length;
                const tot = lcData.contestHistory.length;
                const pct = Math.round((100 * cleared) / tot);
                return (
                  <div key={qNum} className="surface-inset rounded-xl p-3 space-y-1">
                    <div className="flex items-center justify-between font-semibold text-primary-ui">
                      <span>Q{qNum}</span>
                      <span className="font-mono text-ok-ui">{pct}%</span>
                    </div>
                    <div className="text-muted-ui font-mono">
                      {cleared}/{tot}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-muted-ui">LeetCode contest history loads from the owner snapshot.</div>
          )}
        </div>
      </div>

      <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-primary-ui">Tag-by-Tag Codeforces Audit</h2>
            <p className="text-xs text-muted-ui">
              Checks both AC rate and your highest solved rating per topic against your target ({targetCfRating}).
            </p>
          </div>
          <input
            type="text"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            aria-label="Filter topic in audit table"
            placeholder="Filter topic..."
            className="input-field text-xs px-3 py-1.5 rounded-xl w-52"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-300/50 dark:border-slate-800 text-left text-muted-ui">
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
                <tr key={r.tag} className="border-b border-slate-300/30 dark:border-slate-800/50 hover:bg-slate-500/5 transition">
                  <td className="py-2 px-2.5 font-medium text-primary-ui">{r.tag}</td>
                  <td className="py-2 px-2.5">
                    <span className={`px-2 py-0.5 rounded border ${badgeClass(r.verdict)}`}>{r.verdict}</span>
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono">{r.ok}</td>
                  <td className="py-2 px-2.5 text-right font-mono text-gap-ui">{r.fail}</td>
                  <td className="py-2 px-2.5 text-right font-mono">{r.ok + r.fail ? `${r.acRate}%` : "—"}</td>
                  <td className="py-2 px-2.5 text-right font-mono">{r.medRating ?? "—"}</td>
                  <td className="py-2 px-2.5 text-right font-mono">{r.maxRating ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
