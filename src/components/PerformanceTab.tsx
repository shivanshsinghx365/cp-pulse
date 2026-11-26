import { useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, ExternalLink, Minus, TrendingDown, TrendingUp, Upload } from "lucide-react";
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
  onImportSnapshot?: (snap: OwnerSnapshot) => Promise<void>;
}

type PlatName = "LeetCode" | "Codeforces" | "AtCoder";

interface ChartPoint {
  ts: number;
  rating: number;
  title: string;
  detail: string;
  platform: PlatName;
}

function formatMonthYear(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function formatFullDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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
  onImportSnapshot,
}: Props) {
  const [windowRange, setWindowRange] = useState<"all" | "1y" | "6m">("all");
  const [showLc, setShowLc] = useState(true);
  const [showCf, setShowCf] = useState(true);
  const [showAc, setShowAc] = useState(true);
  const [hoverIdx, setHoverIdx] = useState<{ plat: PlatName; idx: number } | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);

  async function handleQuickImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onImportSnapshot) return;
    setImportErr(null);
    try {
      const parsed = JSON.parse(await file.text()) as OwnerSnapshot;
      if (!parsed || !parsed.leetcode) throw new Error("Invalid snapshot JSON");
      await onImportSnapshot(parsed);
    } catch (err) {
      setImportErr(err instanceof Error ? err.message : "Snapshot import failed");
    } finally {
      e.target.value = "";
    }
  }

  const lcSeries = useMemo<ChartPoint[]>(() => {
    if (!lcData?.contestHistory?.length) return [];
    return lcData.contestHistory
      .slice()
      .sort((a, b) => a.startTime - b.startTime)
      .map((h) => ({
        ts: h.startTime,
        rating: Math.round(h.rating),
        title: h.title,
        detail: `${h.solved}/${h.total} solved · Rank ${h.ranking}`,
        platform: "LeetCode" as const,
      }));
  }, [lcData]);

  const cfSeries = useMemo<ChartPoint[]>(() => {
    if (!cfData?.ratingHistory?.length) return [];
    return cfData.ratingHistory
      .slice()
      .sort((a, b) => a.ratingUpdateTimeSeconds - b.ratingUpdateTimeSeconds)
      .map((r) => {
        const delta = r.newRating - r.oldRating;
        const sign = delta >= 0 ? `+${delta}` : String(delta);
        return {
          ts: r.ratingUpdateTimeSeconds,
          rating: r.newRating,
          title: r.contestName,
          detail: `Rank ${r.rank} · ${sign} (${r.oldRating} → ${r.newRating})`,
          platform: "Codeforces" as const,
        };
      });
  }, [cfData]);

  const acSeries = useMemo<ChartPoint[]>(() => {
    if (!acRatingHistory.length) return [];
    return acRatingHistory
      .filter((r) => r.isRated && r.ts > 0)
      .slice()
      .sort((a, b) => a.ts - b.ts)
      .map((r) => {
        const delta = r.newRating - r.oldRating;
        const sign = delta >= 0 ? `+${delta}` : String(delta);
        return {
          ts: r.ts,
          rating: r.newRating,
          title: r.contestName,
          detail: `Rank ${r.place} · ${sign} (Perf ${r.performance})`,
          platform: "AtCoder" as const,
        };
      });
  }, [acRatingHistory]);

  const nowSec = Math.floor(Date.now() / 1000);
  const cutoffSec =
    windowRange === "6m" ? nowSec - 183 * 86400 : windowRange === "1y" ? nowSec - 365 * 86400 : 0;

  const filteredLc = useMemo(
    () => (showLc ? lcSeries.filter((p) => p.ts >= cutoffSec) : []),
    [lcSeries, showLc, cutoffSec]
  );
  const filteredCf = useMemo(
    () => (showCf ? cfSeries.filter((p) => p.ts >= cutoffSec) : []),
    [cfSeries, showCf, cutoffSec]
  );
  const filteredAc = useMemo(
    () => (showAc ? acSeries.filter((p) => p.ts >= cutoffSec) : []),
    [acSeries, showAc, cutoffSec]
  );

  // Recent 5-contest momentum helpers
  const lcRecentDelta = useMemo(() => {
    if (lcSeries.length < 2) return null;
    const prev = lcSeries[Math.max(0, lcSeries.length - 6)];
    return lcSeries[lcSeries.length - 1].rating - prev.rating;
  }, [lcSeries]);

  const cfRecentDelta = useMemo(() => {
    if (cfSeries.length < 2) return null;
    const prev = cfSeries[Math.max(0, cfSeries.length - 6)];
    return cfSeries[cfSeries.length - 1].rating - prev.rating;
  }, [cfSeries]);

  const acRecentDelta = useMemo(() => {
    if (acSeries.length < 2) return null;
    const prev = acSeries[Math.max(0, acSeries.length - 6)];
    return acSeries[acSeries.length - 1].rating - prev.rating;
  }, [acSeries]);

  if (!hasProfile) {
    return (
      <div className="surface-card rounded-2xl p-6 sm:p-8 text-center space-y-2">
        <h2 className="text-sm font-semibold text-primary-ui">No Profile Loaded</h2>
        <p className="text-xs text-muted-ui max-w-lg mx-auto leading-relaxed">
          {isOwner
            ? "Save your Codeforces / AtCoder handles or import your LeetCode + AtCoder snapshot in Settings to unlock your rankings graph and performance breakdown."
            : "The owner profile is private and hidden by default. Sign in as the Owner or enter your own Codeforces / AtCoder handle above to inspect your ranking trend and topic standing locally."}
        </p>
      </div>
    );
  }

  // Topic splits: Good (Strong), Average (Capped), Bad (Gap + High-demand Untouched)
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
    if (delta === null && earlyPct === null) return { label: "No History", cls: "pill-inactive" };
    if ((delta ?? 0) >= 10 && (earlyPct ?? 100) >= 75) return { label: "Good · Climbing", cls: "badge-ok" };
    if ((delta ?? 0) < -25 || (earlyPct !== null && earlyPct < 60)) return { label: "Needs Focus", cls: "badge-gap" };
    return { label: "Average · Steady", cls: "badge-warn" };
  }

  const lcStanding = standingBadge(lcRecentDelta, lcQ2Row);
  const cfStanding = standingBadge(cfRecentDelta, cfBPct);
  const acStanding = standingBadge(acRecentDelta, acSeries.length ? 80 : null);
  const acPeak = acSeries.length ? Math.max(...acSeries.map((p) => p.rating)) : null;

  // SVG chart bounds
  const allPts = [...filteredLc, ...filteredCf, ...filteredAc];
  const W = 820;
  const H = 265;
  const PAD_L = 48;
  const PAD_R = 18;
  const PAD_T = 18;
  const PAD_B = 28;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const minTs = allPts.length ? Math.min(...allPts.map((p) => p.ts)) : nowSec - 86400;
  const maxTs = allPts.length ? Math.max(...allPts.map((p) => p.ts)) : nowSec;
  const spanTs = Math.max(1, maxTs - minTs);

  const ratingsAll = allPts.map((p) => p.rating);
  if (filteredLc.length) ratingsAll.push(targetLcRating);
  if (filteredCf.length) ratingsAll.push(targetCfRating);
  const rawMinY = ratingsAll.length ? Math.min(...ratingsAll) : 400;
  const rawMaxY = ratingsAll.length ? Math.max(...ratingsAll) : 2200;
  const minY = Math.max(0, Math.floor((rawMinY - 80) / 100) * 100);
  const maxY = Math.ceil((rawMaxY + 80) / 100) * 100;
  const spanY = Math.max(200, maxY - minY);

  const xOf = (ts: number) => (allPts.length <= 1 ? PAD_L + plotW / 2 : PAD_L + ((ts - minTs) / spanTs) * plotW);
  const yOf = (r: number) => PAD_T + plotH - ((r - minY) / spanY) * plotH;

  const toPolyline = (pts: ChartPoint[]) => pts.map((p) => `${xOf(p.ts).toFixed(1)},${yOf(p.rating).toFixed(1)}`).join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(minY + f * spanY));

  const hoveredPoint =
    hoverIdx?.plat === "LeetCode"
      ? filteredLc[hoverIdx.idx]
      : hoverIdx?.plat === "Codeforces"
      ? filteredCf[hoverIdx.idx]
      : hoverIdx?.plat === "AtCoder"
      ? filteredAc[hoverIdx.idx]
      : null;

  function handleChartMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!allPts.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * W;
    const relY = ((e.clientY - rect.top) / Math.max(1, rect.height)) * H;

    let best: { plat: PlatName; idx: number; dist: number } | null = null;
    const scan = (pts: ChartPoint[], plat: PlatName) => {
      pts.forEach((p, idx) => {
        const d = Math.hypot(xOf(p.ts) - relX, yOf(p.rating) - relY);
        if (!best || d < best.dist) best = { plat, idx, dist: d };
      });
    };
    scan(filteredLc, "LeetCode");
    scan(filteredCf, "Codeforces");
    scan(filteredAc, "AtCoder");
    if (best && (best as { dist: number }).dist < 85) {
      setHoverIdx({ plat: (best as { plat: PlatName }).plat, idx: (best as { idx: number }).idx });
    }
  }

  return (
    <div className="space-y-4">
      {/* Standing Overview: LeetCode / Codeforces / AtCoder / Topics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="surface-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-ui">LeetCode Standing</span>
            <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${lcStanding.cls}`}>
              {lcStanding.label}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-primary-ui">
              {lcSeries.length ? lcSeries[lcSeries.length - 1].rating : "—"}
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
              <span>No LC history loaded</span>
            )}
            {lcQ2Row !== null && <span>· Q2 {lcQ2Row}%</span>}
          </div>
        </div>

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
              {acSeries.length ? acSeries[acSeries.length - 1].rating : "—"}
            </span>
            <span className="text-xs font-mono text-muted-ui">
              {acPeak !== null ? `Peak ${acPeak}` : `${diagnosis.acSolvedCount} ACs`}
            </span>
          </div>
          <div className="text-xs text-muted-ui flex items-center gap-2">
            {acRecentDelta !== null ? (
              <span className={`inline-flex items-center gap-0.5 font-mono ${acRecentDelta >= 0 ? "text-ok-ui" : "text-gap-ui"}`}>
                {acRecentDelta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {acRecentDelta >= 0 ? `+${acRecentDelta}` : acRecentDelta} last 5 · {diagnosis.acSolvedCount} ACs
              </span>
            ) : (
              <span>{diagnosis.acSolvedCount} ACs · Snapshot needed for rating curve</span>
            )}
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

      {/* Common Unified Rankings Chart */}
      <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-primary-ui">Combined Contest Rating Trajectory</h2>
            <p className="text-xs text-muted-ui">
              Shared timeline across LeetCode, Codeforces &amp; AtCoder with goal benchmarks. Hover any point for contest details.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setShowLc((v) => !v)}
              className={`px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 transition ${
                showLc ? "badge-accent" : "pill-inactive opacity-60"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              LeetCode ({filteredLc.length})
            </button>
            <button
              onClick={() => setShowCf((v) => !v)}
              className={`px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 transition ${
                showCf ? "badge-ok" : "pill-inactive opacity-60"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-teal-400" />
              Codeforces ({filteredCf.length})
            </button>
            <button
              onClick={() => setShowAc((v) => !v)}
              className={`px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 transition ${
                showAc ? "badge-warn" : "pill-inactive opacity-60"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              AtCoder ({filteredAc.length})
            </button>
            <div className="inline-flex rounded-lg border border-slate-300/50 dark:border-slate-800 overflow-hidden">
              {(
                [
                  ["all", "All"],
                  ["1y", "1Y"],
                  ["6m", "6M"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => {
                    setWindowRange(id);
                    setHoverIdx(null);
                  }}
                  className={`px-2.5 py-1 font-mono transition ${
                    windowRange === id ? "btn-primary" : "text-muted-ui hover:text-primary-ui"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Owner Snapshot Notice when LC or AtCoder rated history isn't synced yet */}
        {isOwner && (!lcData || acSeries.length === 0) && onImportSnapshot && (
          <div className="badge-warn rounded-xl px-3.5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2.5">
            <span>
              {!lcData
                ? "LeetCode & AtCoder contest histories load from your private Firestore snapshot (since both block browser CORS)."
                : "AtCoder rated contest history is missing from your snapshot — re-import your refreshed file to add the AtCoder curve."}
            </span>
            <label className="btn-primary px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 cursor-pointer font-medium shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>Import owner_snapshot_private.json</span>
              <input type="file" accept=".json,application/json" onChange={handleQuickImport} className="hidden" />
            </label>
          </div>
        )}
        {importErr && <div className="badge-gap rounded-xl px-3 py-2 text-xs">{importErr}</div>}

        {/* Hover Readout Bar */}
        <div className="surface-inset rounded-xl px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2 min-h-[34px]">
          {hoveredPoint ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={
                    hoveredPoint.platform === "LeetCode"
                      ? "text-accent-ui font-semibold"
                      : hoveredPoint.platform === "Codeforces"
                      ? "text-ok-ui font-semibold"
                      : "text-warn-ui font-semibold"
                  }
                >
                  {hoveredPoint.platform}
                </span>
                <span className="text-primary-ui font-medium">{hoveredPoint.title}</span>
                <span className="text-muted-ui font-mono">({formatFullDate(hoveredPoint.ts)})</span>
              </div>
              <div className="font-mono text-primary-ui">
                Rating <span className="font-bold">{hoveredPoint.rating}</span> ·{" "}
                <span className="text-muted-ui">{hoveredPoint.detail}</span>
              </div>
            </>
          ) : (
            <span className="text-muted-ui">
              {allPts.length
                ? "Hover over the chart to inspect any contest rank, rating jump, or AtCoder performance."
                : "No contest rating history points available for the selected filter."}
            </span>
          )}
        </div>

        {allPts.length > 0 && (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-auto min-w-[540px] select-none"
              onMouseMove={handleChartMove}
              onMouseLeave={() => setHoverIdx(null)}
            >
              {yTicks.map((val) => {
                const y = yOf(val);
                return (
                  <g key={val}>
                    <line
                      x1={PAD_L}
                      y1={y}
                      x2={W - PAD_R}
                      y2={y}
                      stroke="currentColor"
                      strokeOpacity="0.1"
                      strokeDasharray="3 4"
                    />
                    <text
                      x={PAD_L - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {filteredLc.length > 0 && (
                <g>
                  <line
                    x1={PAD_L}
                    y1={yOf(targetLcRating)}
                    x2={W - PAD_R}
                    y2={yOf(targetLcRating)}
                    stroke="#38bdf8"
                    strokeOpacity="0.45"
                    strokeDasharray="5 5"
                  />
                  <text
                    x={W - PAD_R - 4}
                    y={yOf(targetLcRating) - 4}
                    textAnchor="end"
                    className="fill-sky-600 dark:fill-sky-400 text-[9px] font-mono"
                  >
                    LC Goal {targetLcRating}
                  </text>
                </g>
              )}
              {filteredCf.length > 0 && (
                <g>
                  <line
                    x1={PAD_L}
                    y1={yOf(targetCfRating)}
                    x2={W - PAD_R}
                    y2={yOf(targetCfRating)}
                    stroke="#2dd4bf"
                    strokeOpacity="0.45"
                    strokeDasharray="5 5"
                  />
                  <text
                    x={W - PAD_R - 4}
                    y={yOf(targetCfRating) - 4}
                    textAnchor="end"
                    className="fill-teal-600 dark:fill-teal-400 text-[9px] font-mono"
                  >
                    CF Goal {targetCfRating}
                  </text>
                </g>
              )}

              {hoveredPoint && (
                <line
                  x1={xOf(hoveredPoint.ts)}
                  y1={PAD_T}
                  x2={xOf(hoveredPoint.ts)}
                  y2={H - PAD_B}
                  stroke="currentColor"
                  strokeOpacity="0.25"
                  strokeDasharray="3 3"
                />
              )}

              {filteredLc.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={toPolyline(filteredLc)}
                />
              )}
              {filteredLc.map((p, idx) => {
                const active = hoverIdx?.plat === "LeetCode" && hoverIdx.idx === idx;
                return (
                  <circle
                    key={`lc-${p.ts}-${idx}`}
                    cx={xOf(p.ts)}
                    cy={yOf(p.rating)}
                    r={active ? 5 : filteredLc.length > 60 ? 2 : 3}
                    fill={active ? "#38bdf8" : "#0ea5e9"}
                    stroke={active ? "#ffffff" : "none"}
                    strokeWidth={active ? 1.5 : 0}
                  />
                );
              })}

              {filteredCf.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#14b8a6"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={toPolyline(filteredCf)}
                />
              )}
              {filteredCf.map((p, idx) => {
                const active = hoverIdx?.plat === "Codeforces" && hoverIdx.idx === idx;
                return (
                  <circle
                    key={`cf-${p.ts}-${idx}`}
                    cx={xOf(p.ts)}
                    cy={yOf(p.rating)}
                    r={active ? 5.5 : 3.5}
                    fill={active ? "#5eead4" : "#14b8a6"}
                    stroke={active ? "#ffffff" : "none"}
                    strokeWidth={active ? 1.5 : 0}
                  />
                );
              })}

              {filteredAc.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={toPolyline(filteredAc)}
                />
              )}
              {filteredAc.map((p, idx) => {
                const active = hoverIdx?.plat === "AtCoder" && hoverIdx.idx === idx;
                return (
                  <circle
                    key={`ac-${p.ts}-${idx}`}
                    cx={xOf(p.ts)}
                    cy={yOf(p.rating)}
                    r={active ? 5.5 : 3.8}
                    fill={active ? "#fcd34d" : "#f59e0b"}
                    stroke={active ? "#ffffff" : "none"}
                    strokeWidth={active ? 1.5 : 0}
                  />
                );
              })}

              {[0, 0.5, 1].map((f) => {
                const ts = Math.round(minTs + f * spanTs);
                const anchor = f === 0 ? "start" : f === 1 ? "end" : "middle";
                return (
                  <text
                    key={f}
                    x={PAD_L + f * plotW}
                    y={H - 8}
                    textAnchor={anchor}
                    className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono"
                  >
                    {formatMonthYear(ts)}
                  </text>
                );
              })}
            </svg>
          </div>
        )}
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
