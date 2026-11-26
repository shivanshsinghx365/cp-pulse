import { useMemo } from "react";
import { ArrowUpRight, CheckCircle2, ExternalLink, Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ProfileDiagnosis } from "../lib/analyzer";
import type { AcRatingPoint, OwnerSnapshot } from "../types";
import type { LiveCfResult } from "../lib/liveApi";

interface Props {
  diagnosis: ProfileDiagnosis;
  cfData: LiveCfResult | null;
  lcData: OwnerSnapshot["leetcode"] | null;
  acRatingHistory: AcRatingPoint[];
  isOwner: boolean;
  hasProfile: boolean;
  targetCfRating: number;
  targetLcRating: number;
  onJumpToTopic: (tag: string) => void;
}

export function PerformanceTab({
  diagnosis,
  cfData,
  lcData,
  acRatingHistory,
  isOwner,
  hasProfile,
  targetCfRating,
  targetLcRating,
  onJumpToTopic,
}: Props) {
  const lcSeries = useMemo(() => {
    if (!lcData?.contestHistory?.length) return [];
    return lcData.contestHistory.slice().sort((a, b) => a.startTime - b.startTime);
  }, [lcData]);

  const cfSeries = useMemo(() => {
    if (!cfData?.ratingHistory?.length) return [];
    return cfData.ratingHistory.slice().sort((a, b) => a.ratingUpdateTimeSeconds - b.ratingUpdateTimeSeconds);
  }, [cfData]);

  const acSeries = useMemo(() => {
    if (!acRatingHistory.length) return [];
    return acRatingHistory.filter((r) => r.isRated && r.ts > 0).slice().sort((a, b) => a.ts - b.ts);
  }, [acRatingHistory]);

  const lcRecentDelta = useMemo(() => {
    if (lcSeries.length < 2) return null;
    const prev = lcSeries[Math.max(0, lcSeries.length - 6)];
    return Math.round(lcSeries[lcSeries.length - 1].rating - prev.rating);
  }, [lcSeries]);

  const cfRecentDelta = useMemo(() => {
    if (cfSeries.length < 2) return null;
    const prev = cfSeries[Math.max(0, cfSeries.length - 6)];
    return cfSeries[cfSeries.length - 1].newRating - prev.newRating;
  }, [cfSeries]);

  const acRecentDelta = useMemo(() => {
    if (acSeries.length < 2) return null;
    const prev = acSeries[Math.max(0, acSeries.length - 6)];
    return acSeries[acSeries.length - 1].newRating - prev.newRating;
  }, [acSeries]);

  if (!hasProfile) {
    return (
      <div className="surface-card rounded-2xl p-6 sm:p-8 text-center space-y-2">
        <h2 className="text-sm font-semibold text-primary-ui">No Profile Loaded</h2>
        <p className="text-xs text-muted-ui max-w-lg mx-auto leading-relaxed">
          {isOwner
            ? "Save your Codeforces / AtCoder handles or import your snapshot in Settings to view your performance breakdown."
            : "The owner profile is private and hidden by default. Sign in as the Owner or enter your own Codeforces / AtCoder handle above to inspect your standing, topics, and questions locally."}
        </p>
      </div>
    );
  }

  const goodTopics = diagnosis.cfAudit.filter((r) => r.verdict === "Strong").sort((a, b) => b.ok - a.ok);
  const avgTopics = diagnosis.cfAudit.filter((r) => r.verdict === "Capped").sort((a, b) => b.ok - a.ok);
  const weakSet = new Set(diagnosis.weakTags);
  const badTopics = diagnosis.cfAudit
    .filter((r) => r.verdict === "Gap" || (r.verdict === "Untouched" && weakSet.has(r.tag)))
    .sort((a, b) => b.fail - a.fail || a.acRate - b.acRate);

  const lcQ2Row =
    lcData && lcData.contestHistory.length > 0
      ? Math.round((100 * lcData.contestHistory.filter((h) => h.solved >= 2).length) / lcData.contestHistory.length)
      : null;
  const cfBRow = diagnosis.cfSlotStats.find((s) => s.slot === "B");
  const cfBPct = cfBRow && cfBRow.total ? Math.round((100 * cfBRow.solved) / cfBRow.total) : null;

  function standingBadge(delta: number | null, earlyPct: number | null) {
    if (delta === null && earlyPct === null) return { label: "Needs Snapshot", cls: "pill-inactive" };
    if ((delta ?? 0) >= 10 && (earlyPct ?? 100) >= 75) return { label: "Good · Climbing", cls: "badge-ok" };
    if ((delta ?? 0) < -25 || (earlyPct !== null && earlyPct < 60)) return { label: "Needs Focus", cls: "badge-gap" };
    return { label: "Average · Steady", cls: "badge-warn" };
  }

  const lcStanding = standingBadge(lcRecentDelta, lcQ2Row);
  const cfStanding = standingBadge(cfRecentDelta, cfBPct);
  const acStanding = acSeries.length
    ? standingBadge(acRecentDelta, 80)
    : diagnosis.acSolvedCount > 0
    ? { label: "Active Practice", cls: "badge-accent" }
    : { label: "No Activity", cls: "pill-inactive" };
  const acPeak = acSeries.length ? Math.max(...acSeries.map((p) => p.newRating)) : null;

  return (
    <div className="space-y-4">
      {/* Standing Overview: LeetCode / Codeforces / AtCoder / Topics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="surface-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-ui">Codeforces Standing</span>
            <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${cfStanding.cls}`}>
              {cfStanding.label}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-primary-ui">
              {cfData?.info.rating ?? "—"}
            </span>
            <span className="text-xs font-mono text-muted-ui">
              Peak {cfData?.info.maxRating ?? "—"} · Goal {targetCfRating}
            </span>
          </div>
          <div className="text-xs text-muted-ui flex items-center gap-2">
            {cfRecentDelta !== null ? (
              <span className={`inline-flex items-center gap-0.5 font-mono ${cfRecentDelta >= 0 ? "text-ok-ui" : "text-gap-ui"}`}>
                {cfRecentDelta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {cfRecentDelta >= 0 ? `+${cfRecentDelta}` : cfRecentDelta} last 5
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Minus className="w-3 h-3" /> No CF history
              </span>
            )}
            {cfBPct !== null && <span>· B {cfBPct}%</span>}
          </div>
        </div>

        <div className="surface-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-ui">AtCoder Standing</span>
            <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${acStanding.cls}`}>
              {acStanding.label}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-primary-ui">
              {acSeries.length ? acSeries[acSeries.length - 1].newRating : `${diagnosis.acSolvedCount} ACs`}
            </span>
            <span className="text-xs font-mono text-muted-ui">
              {acPeak !== null
                ? `Peak ${acPeak} · ${diagnosis.acSolvedCount} ACs`
                : diagnosis.acMaxDiff !== null
                ? `Max diff ~${diagnosis.acMaxDiff}`
                : "ABC practice"}
            </span>
          </div>
          <div className="text-xs text-muted-ui flex items-center gap-2">
            {acRecentDelta !== null ? (
              <span className={`inline-flex items-center gap-0.5 font-mono ${acRecentDelta >= 0 ? "text-ok-ui" : "text-gap-ui"}`}>
                {acRecentDelta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {acRecentDelta >= 0 ? `+${acRecentDelta}` : acRecentDelta} last 5 rounds
              </span>
            ) : (
              <span>{diagnosis.acUnsolved.length} attempted &amp; unsolved</span>
            )}
          </div>
        </div>

        <div className="surface-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-ui">LeetCode Standing</span>
            <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${lcStanding.cls}`}>
              {lcStanding.label}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-primary-ui">
              {lcSeries.length ? Math.round(lcSeries[lcSeries.length - 1].rating) : "—"}
            </span>
            <span className="text-xs font-mono text-muted-ui">/ {targetLcRating} goal</span>
          </div>
          <div className="text-xs text-muted-ui flex items-center gap-2">
            {lcRecentDelta !== null ? (
              <span className={`inline-flex items-center gap-0.5 font-mono ${lcRecentDelta >= 0 ? "text-ok-ui" : "text-gap-ui"}`}>
                {lcRecentDelta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {lcRecentDelta >= 0 ? `+${lcRecentDelta}` : lcRecentDelta} last 5
              </span>
            ) : (
              <span>Import snapshot in Settings for LC stats</span>
            )}
            {lcQ2Row !== null && <span>· Q2 {lcQ2Row}%</span>}
          </div>
        </div>

        <div className="surface-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-ui">Topic Health Split</span>
            <span className="text-xs font-mono text-muted-ui">
              {goodTopics.length + avgTopics.length + badTopics.length} topics
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-xs font-mono">
            <div className="surface-inset rounded-lg px-2 py-1.5">
              <div className="text-muted-ui font-sans">Good</div>
              <div className="text-sm font-bold text-ok-ui">{goodTopics.length}</div>
            </div>
            <div className="surface-inset rounded-lg px-2 py-1.5">
              <div className="text-muted-ui font-sans">Average</div>
              <div className="text-sm font-bold text-warn-ui">{avgTopics.length}</div>
            </div>
            <div className="surface-inset rounded-lg px-2 py-1.5">
              <div className="text-muted-ui font-sans">Focus</div>
              <div className="text-sm font-bold text-gap-ui">{badTopics.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Topic Standing: Good / Average / Needs Focus */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="surface-card rounded-2xl p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-ok-ui">Topics Doing Good</h3>
            <p className="text-xs text-muted-ui">High AC rate (≥65%) and reaching your target rating.</p>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {goodTopics.length === 0 ? (
              <div className="text-xs text-muted-ui">No topics reach Strong threshold yet.</div>
            ) : (
              goodTopics.map((r) => (
                <button
                  key={r.tag}
                  onClick={() => onJumpToTopic(r.tag)}
                  className="w-full surface-inset px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 hover:brightness-110 transition text-left"
                >
                  <span className="font-medium text-primary-ui truncate">{r.tag}</span>
                  <span className="font-mono text-ok-ui shrink-0">
                    {r.acRate}% · {r.ok} AC · max {r.maxRating ?? "—"}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="surface-card rounded-2xl p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-warn-ui">Topics Doing Average</h3>
            <p className="text-xs text-muted-ui">Decent accuracy, but highest solved rating is below target ({targetCfRating}).</p>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {avgTopics.length === 0 ? (
              <div className="text-xs text-muted-ui">No capped/average topics flagged.</div>
            ) : (
              avgTopics.map((r) => (
                <button
                  key={r.tag}
                  onClick={() => onJumpToTopic(r.tag)}
                  className="w-full surface-inset px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 hover:brightness-110 transition text-left"
                >
                  <span className="font-medium text-primary-ui truncate">{r.tag}</span>
                  <span className="font-mono text-warn-ui shrink-0 inline-flex items-center gap-1">
                    {r.acRate}% · max {r.maxRating ?? "—"}
                    <ArrowUpRight className="w-3 h-3" />
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="surface-card rounded-2xl p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gap-ui">Topics Doing Bad / Focus</h3>
            <p className="text-xs text-muted-ui">Low AC rate, repeated unsolved attempts, or untouched core topics.</p>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {badTopics.length === 0 ? (
              <div className="text-xs text-muted-ui">No weak topics flagged.</div>
            ) : (
              badTopics.map((r) => (
                <button
                  key={r.tag}
                  onClick={() => onJumpToTopic(r.tag)}
                  className="w-full surface-inset px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 hover:brightness-110 transition text-left"
                >
                  <span className="font-medium text-primary-ui truncate">{r.tag}</span>
                  <span className="font-mono text-gap-ui shrink-0 inline-flex items-center gap-1">
                    {r.ok === 0 ? "0 solved" : `${r.acRate}% · ${r.fail} fail`}
                    <ArrowUpRight className="w-3 h-3" />
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Question Breakdown: Doing Bad vs Doing Good */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gap-ui">Questions Struggling On (Focus Next)</h3>
            <p className="text-xs text-muted-ui">
              Unsolved attempts &amp; missed contest questions sorted by retries and priority.
            </p>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {diagnosis.upsolveQueue
              .filter((i) => i.bucket === "attempted_unsolved" || i.bucket === "missed_contest")
              .slice(0, 15)
              .map((q) => (
                <a
                  key={q.key}
                  href={q.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="surface-inset p-3 rounded-xl flex items-start justify-between gap-2.5 hover:brightness-110 transition text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-muted-ui">{q.platform} · {q.slot}</span>
                      <span className="font-semibold text-primary-ui truncate">{q.title}</span>
                    </div>
                    <div className="text-gap-ui">{q.reason}</div>
                  </div>
                  <span className="badge-accent font-mono px-2 py-0.5 rounded shrink-0 inline-flex items-center gap-1">
                    {q.ratingLabel}
                    <ExternalLink className="w-3 h-3" />
                  </span>
                </a>
              ))}
          </div>
        </div>

        <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-ok-ui">Questions Doing Good (Top Clean Wins)</h3>
            <p className="text-xs text-muted-ui">
              Your highest-rated Codeforces &amp; AtCoder ACs showing the ceiling you already solve.
            </p>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {diagnosis.cfGoodSolves.length === 0 ? (
              <div className="text-xs text-muted-ui">Load Codeforces or AtCoder handles to list your top solved problems.</div>
            ) : (
              diagnosis.cfGoodSolves.slice(0, 15).map((q) => (
                <a
                  key={q.key}
                  href={q.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="surface-inset p-3 rounded-xl flex items-start justify-between gap-2.5 hover:brightness-110 transition text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-muted-ui">{q.slot}</span>
                      <span className="font-semibold text-primary-ui truncate">{q.title}</span>
                    </div>
                    <div className="text-muted-ui flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-ok-ui">
                        <CheckCircle2 className="w-3 h-3" />
                        {q.cleanAc ? "First-try AC" : `AC (${q.failCount} prior fail${q.failCount > 1 ? "s" : ""})`}
                      </span>
                      <span className="truncate">{q.tags.slice(0, 2).join(", ")}</span>
                    </div>
                  </div>
                  <span className="badge-ok font-mono px-2 py-0.5 rounded shrink-0 inline-flex items-center gap-1">
                    {q.ratingLabel}
                    <ExternalLink className="w-3 h-3" />
                  </span>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
