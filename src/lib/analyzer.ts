import type {
  AcSubmission,
  ContestQuestion,
  ContestRecord,
  OwnerSnapshot,
  Platform,
  PotdPayload,
  TagAuditRow,
  UpsolveItem,
} from "../types";
import { GENERIC_TAGS, makeProblemKey, mapCfTag } from "./tags";
import type { LiveCfResult } from "./liveApi";

export interface RawCompactContests {
  updatedAt: number;
  tags: string[];
  contests: [
    Platform,
    string,
    string,
    string,
    number,
    [string, string, string, string, number | null, number[], string, number][]
  ][];
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}

function formatAtCoderTitle(pid: string, knownTitle?: string): string {
  if (knownTitle) return knownTitle;
  const m = pid.match(/^([a-z]+)(\d+)_([a-z0-9]+)$/i);
  if (m) return `${m[1].toUpperCase()} ${m[2]} · Problem ${m[3].toUpperCase()}`;
  return pid;
}

export function unpackContests(raw: RawCompactContests): ContestRecord[] {
  return raw.contests.map(([platform, tier, id, title, startTime, qs]) => {
    const dateStr = new Date(startTime * 1000).toISOString().slice(0, 10);
    return {
      platform,
      tier,
      id,
      title,
      startTime,
      dateStr,
      questions: qs.map(([slot, rawIndex, qTitle, difficulty, rating, tagIds, slugOrId, src]) => {
        let url = "#";
        if (platform === "LeetCode") url = `https://leetcode.com/problems/${slugOrId}/`;
        else if (platform === "Codeforces") url = `https://codeforces.com/contest/${id}/problem/${rawIndex}`;
        else url = `https://atcoder.jp/contests/${id}/tasks/${slugOrId}`;
        return {
          platform,
          tier,
          contestId: id,
          contestTitle: title,
          startTime,
          dateStr,
          slot,
          rawIndex,
          id: slugOrId,
          title: qTitle,
          difficulty,
          rating,
          tags: uniq(tagIds.map((i) => raw.tags[i])),
          url,
          src,
        };
      }),
    };
  });
}

export interface SlotConsistencyRow {
  slot: string;
  solved: number;
  total: number;
}

export interface SolvedHighlight {
  key: string;
  slot: string;
  title: string;
  url: string;
  rating: number | null;
  ratingLabel: string;
  tags: string[];
  cleanAc: boolean;
  failCount: number;
  ts: number;
}

export interface ProfileDiagnosis {
  cfAudit: TagAuditRow[];
  weakTags: string[];
  cfUnsolved: UpsolveItem[];
  cfGoodSolves: SolvedHighlight[];
  acUnsolved: UpsolveItem[];
  acSolvedCount: number;
  acMaxDiff: number | null;
  cfSolvedCount: number;
  cfRatingBuckets: { label: string; count: number }[];
  cfAttendedCount: number;
  cfSlotStats: SlotConsistencyRow[];
  upsolveQueue: UpsolveItem[];
  potdFollowUps: ContestQuestion[];
}

export function analyzeProfile(
  contests: ContestRecord[],
  potd: PotdPayload | null,
  cf: LiveCfResult | null,
  acSubs: AcSubmission[],
  lcMissed: OwnerSnapshot["leetcode"]["missedContestQuestions"] | null,
  targetCfMin = 1500,
  lcRecentAcSlugs: string[] = []
): ProfileDiagnosis {
  const hasUserProfile = Boolean(cf || acSubs.length > 0 || (lcMissed && lcMissed.length > 0));
  const allQuestions = contests.flatMap((c) => c.questions);
  const qById = new Map<string, ContestQuestion>();
  for (const q of allQuestions) {
    if (q.platform === "AtCoder") qById.set(q.id, q);
  }

  // 1. Codeforces submission analysis (both contest & practice)
  const cfProbMap = new Map<
    string,
    {
      cid: number;
      idx: string;
      name: string;
      rating: number | null;
      tags: string[];
      ok: boolean;
      wasContest: boolean;
      verdicts: Record<string, number>;
      ts: number;
    }
  >();

  if (cf) {
    for (const s of cf.submissions) {
      const p = s.problem;
      const cid = p.contestId || s.contestId || 0;
      const key = `${cid}${p.index}`;
      const pType = s.author?.participantType || "";
      const isContestTry = pType === "CONTESTANT" || pType === "OUT_OF_COMPETITION";
      const cur = cfProbMap.get(key) || {
        cid,
        idx: p.index,
        name: p.name,
        rating: p.rating ?? null,
        tags: uniq((p.tags || []).map(mapCfTag)),
        ok: false,
        wasContest: isContestTry,
        verdicts: {},
        ts: s.creationTimeSeconds,
      };
      if (isContestTry) cur.wasContest = true;
      if (s.verdict === "OK") cur.ok = true;
      else if (s.verdict) cur.verdicts[s.verdict] = (cur.verdicts[s.verdict] || 0) + 1;
      cur.ts = Math.max(cur.ts, s.creationTimeSeconds);
      cfProbMap.set(key, cur);
    }
  }

  const okByTag = new Map<string, number[]>();
  const failByTag = new Map<string, number>();
  const cfUnsolved: UpsolveItem[] = [];
  const cfGoodSolves: SolvedHighlight[] = [];
  const cfRatingCount = new Map<number, number>();
  let cfSolvedCount = 0;

  for (const [id, item] of cfProbMap.entries()) {
    const vEntries = Object.entries(item.verdicts);
    const totalFails = vEntries.reduce((acc, [, v]) => acc + v, 0);
    if (item.ok) {
      cfSolvedCount++;
      if (item.rating) cfRatingCount.set(item.rating, (cfRatingCount.get(item.rating) || 0) + 1);
      for (const t of item.tags) {
        const arr = okByTag.get(t) || [];
        if (item.rating) arr.push(item.rating);
        okByTag.set(t, arr);
      }
      cfGoodSolves.push({
        key: makeProblemKey("Codeforces", id),
        slot: `CF · ${item.cid}${item.idx}`,
        title: item.name,
        url: `https://codeforces.com/contest/${item.cid}/problem/${item.idx}`,
        rating: item.rating,
        ratingLabel: item.rating ? `CF ${item.rating}` : "Unrated",
        tags: item.tags,
        cleanAc: totalFails === 0,
        failCount: totalFails,
        ts: item.ts,
      });
    } else {
      for (const t of item.tags) {
        failByTag.set(t, (failByTag.get(t) || 0) + 1);
      }
      const vStr = vEntries.map(([k, v]) => `${k.replace(/_/g, " ")} ×${v}`).join(", ");
      const basePrio = item.wasContest ? 95 : 91;
      cfUnsolved.push({
        key: makeProblemKey("Codeforces", id),
        platform: "Codeforces",
        slot: `${item.cid}${item.idx}`,
        title: item.name,
        url: `https://codeforces.com/contest/${item.cid}/problem/${item.idx}`,
        ratingLabel: item.rating ? `CF ${item.rating}` : "Unrated",
        numericRating: item.rating,
        tags: item.tags,
        reason: `${item.wasContest ? "Contest attempt" : "Practice attempt"} & unsolved (${vStr || "WA"})`,
        priorityScore: basePrio + Math.min(3, totalFails - 1) - (item.rating ? Math.min(4, Math.abs(item.rating - targetCfMin) / 250) : 1),
        bucket: "attempted_unsolved",
        ts: item.ts,
      });
    }
  }

  const coreTags = [
    "Greedy",
    "Math",
    "Dynamic Programming",
    "Constructive & Ad-hoc",
    "Binary / Ternary Search",
    "Data Structures (General)",
    "SegTree / BIT (Fenwick)",
    "Trees",
    "Graphs",
    "DFS / BFS / Traversal",
    "Shortest Path",
    "Combinatorics & Counting",
    "Number Theory & Mod",
    "Two Pointers & Sliding Window",
    "Bit Manipulation",
    "Strings",
    "Sorting",
    "Implementation & Simulation",
    "Brute Force & Enumeration",
    "Union-Find (DSU)",
    "Game Theory",
    "Interactive & Comm",
  ];

  const allAuditTags = Array.from(
    new Set([...coreTags, ...okByTag.keys(), ...failByTag.keys()])
  );

  const cfAudit: TagAuditRow[] = cf
    ? allAuditTags
        .map((tag) => {
          const ratings = (okByTag.get(tag) || []).slice().sort((a, b) => a - b);
          let okTotal = 0;
          for (const item of cfProbMap.values()) {
            if (item.ok && item.tags.includes(tag)) okTotal++;
          }
          const fail = failByTag.get(tag) || 0;
          const tot = okTotal + fail;
          const acRate = tot ? Math.round((100 * okTotal) / tot) : 0;
          const medRating = ratings.length ? ratings[Math.floor(ratings.length / 2)] : null;
          const maxRating = ratings.length ? ratings[ratings.length - 1] : null;

          let verdict: TagAuditRow["verdict"] = "Strong";
          if (okTotal === 0) verdict = "Untouched";
          else if (acRate < 65 || (fail >= 2 && (maxRating ?? 0) < targetCfMin)) verdict = "Gap";
          else if (maxRating !== null && maxRating < targetCfMin) verdict = "Capped";

          return { tag, ok: okTotal, fail, acRate, medRating, maxRating, verdict };
        })
        .filter((r) => coreTags.includes(r.tag) || r.ok + r.fail > 0)
        .sort((a, b) => b.ok + b.fail - (a.ok + a.fail))
    : [];

  const highDemandSet = new Set([
    "Dynamic Programming",
    "Greedy",
    "Trees",
    "Graphs",
    "Combinatorics & Counting",
    "Data Structures (General)",
    "SegTree / BIT (Fenwick)",
    "Binary / Ternary Search",
    "Number Theory & Mod",
    "Constructive & Ad-hoc",
    "Two Pointers & Sliding Window",
    "Shortest Path",
  ]);

  const weakTags = cfAudit
    .filter(
      (r) =>
        !GENERIC_TAGS.has(r.tag) &&
        (r.verdict === "Gap" ||
          r.verdict === "Capped" ||
          (r.verdict === "Untouched" && highDemandSet.has(r.tag)))
    )
    .map((r) => r.tag);

  // 2. AtCoder analysis
  const acMap = new Map<string, { ok: boolean; failCount: number; cid: string; ts: number; lastRes: string }>();
  for (const s of acSubs) {
    const cur = acMap.get(s.problem_id) || {
      ok: false,
      failCount: 0,
      cid: s.contest_id,
      ts: s.epoch_second,
      lastRes: s.result,
    };
    if (s.result === "AC") cur.ok = true;
    else cur.failCount += 1;
    cur.ts = Math.max(cur.ts, s.epoch_second);
    cur.lastRes = s.result;
    acMap.set(s.problem_id, cur);
  }
  let acSolvedCount = 0;
  let acMaxDiff: number | null = null;
  const acUnsolved: UpsolveItem[] = [];
  for (const [pid, info] of acMap.entries()) {
    const q = qById.get(pid);
    const slotIdx = (q?.slot || pid.split("_").pop() || "?").toUpperCase();
    const slotLbl = `${info.cid.toUpperCase()} ${slotIdx}`;
    if (info.ok) {
      acSolvedCount++;
      if (q?.rating !== null && q?.rating !== undefined) {
        acMaxDiff = acMaxDiff === null ? q.rating : Math.max(acMaxDiff, q.rating);
      }
      cfGoodSolves.push({
        key: makeProblemKey("AtCoder", pid),
        slot: `AC · ${slotLbl}`,
        title: formatAtCoderTitle(pid, q?.title),
        url: `https://atcoder.jp/contests/${info.cid}/tasks/${pid}`,
        rating: q?.rating ?? null,
        ratingLabel: q?.rating !== null && q?.rating !== undefined ? `AC ${q.rating}` : "AtCoder",
        tags: uniq(q?.tags || []),
        cleanAc: info.failCount === 0,
        failCount: info.failCount,
        ts: info.ts,
      });
    } else {
      acUnsolved.push({
        key: makeProblemKey("AtCoder", pid),
        platform: "AtCoder",
        slot: slotLbl,
        title: formatAtCoderTitle(pid, q?.title),
        url: `https://atcoder.jp/contests/${info.cid}/tasks/${pid}`,
        ratingLabel: q?.rating !== null && q?.rating !== undefined ? `AC ${q.rating}` : "AtCoder",
        numericRating: q?.rating ?? null,
        tags: uniq(q?.tags || ["Combinatorics & Counting"]),
        reason: `Attempted on AtCoder (${info.lastRes})`,
        priorityScore: 95,
        bucket: "attempted_unsolved",
        ts: info.ts,
      });
    }
  }

  // 3. Attended CF contest slot consistency (excluding pure Div. 1) & histogram
  const cfRatingBuckets = Array.from(cfRatingCount.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([r, c]) => ({ label: String(r), count: c }));

  const attendedCf = (cf?.ratingHistory || []).filter(
    (r) => !(/\bDiv\.\s*1\b/i.test(r.contestName) && !/Div\.\s*2/i.test(r.contestName))
  );
  const solvedByCid = new Map<number, Set<string>>();
  for (const item of cfProbMap.values()) {
    if (item.ok) {
      const set = solvedByCid.get(item.cid) || new Set<string>();
      set.add(item.idx.charAt(0).toUpperCase());
      solvedByCid.set(item.cid, set);
    }
  }
  const cfSlotStats: SlotConsistencyRow[] = ["A", "B", "C", "D"].map((slot) => ({
    slot,
    solved: attendedCf.filter((r) => solvedByCid.get(r.contestId)?.has(slot)).length,
    total: attendedCf.length,
  }));

  // Capture unattempted early/mid slots (A-D) in attended CF rounds from the 1-yr dataset
  const attendedCfIds = new Set(attendedCf.map((r) => String(r.contestId)));
  const cfAttendedMissed: UpsolveItem[] = [];
  const cfSlotPrio: Record<string, number> = { A: 98, B: 96, C: 92, D: 86 };
  for (const c of contests) {
    if (c.platform !== "Codeforces" || !attendedCfIds.has(c.id)) continue;
    const solvedSet = solvedByCid.get(Number(c.id)) || new Set<string>();
    const maxSolvedOrd = Math.max(0, ...Array.from(solvedSet).map((ch) => ch.charCodeAt(0) - 64));
    const cutoffOrd = Math.min(4, Math.max(2, maxSolvedOrd + 2)); // Always cover A & B, plus next 2 steps up to D
    for (const q of c.questions) {
      const ord = q.slot.charCodeAt(0) - 64;
      if (ord < 1 || ord > cutoffOrd) continue;
      if (cfProbMap.get(q.id)?.ok || solvedSet.has(q.slot)) continue;
      cfAttendedMissed.push({
        key: makeProblemKey("Codeforces", q.id),
        platform: "Codeforces",
        slot: `${c.id}${q.rawIndex}`,
        title: q.title,
        url: q.url,
        ratingLabel: q.rating ? `CF ${q.rating}` : "Unrated",
        numericRating: q.rating,
        tags: uniq(q.tags),
        reason: `Missed ${q.slot} in attended contest (${c.title})`,
        priorityScore: cfSlotPrio[q.slot] ?? 86,
        bucket: "missed_contest",
        ts: c.startTime,
      });
    }
  }

  // Capture missed early/mid slots in attended AtCoder ABCs
  const attendedAcCids = new Set(acSubs.map((s) => s.contest_id));
  const acSolvedByCid = new Map<string, Set<string>>();
  for (const [pid, info] of acMap.entries()) {
    if (info.ok) {
      const idx = (qById.get(pid)?.slot || pid.split("_").pop() || "").toUpperCase();
      const set = acSolvedByCid.get(info.cid) || new Set<string>();
      if (idx) set.add(idx);
      acSolvedByCid.set(info.cid, set);
    }
  }
  const acAttendedMissed: UpsolveItem[] = [];
  for (const c of contests) {
    if (c.platform !== "AtCoder" || !attendedAcCids.has(c.id)) continue;
    const solvedSet = acSolvedByCid.get(c.id) || new Set<string>();
    const maxSolvedOrd = Math.max(0, ...Array.from(solvedSet).map((ch) => ch.charCodeAt(0) - 64));
    const cutoffOrd = Math.min(4, Math.max(2, maxSolvedOrd + 2));
    for (const q of c.questions) {
      const ord = q.slot.charCodeAt(0) - 64;
      if (ord < 1 || ord > cutoffOrd) continue;
      if (acMap.get(q.id)?.ok || solvedSet.has(q.slot)) continue;
      acAttendedMissed.push({
        key: makeProblemKey("AtCoder", q.id),
        platform: "AtCoder",
        slot: `${c.id.toUpperCase()} ${q.slot}`,
        title: formatAtCoderTitle(q.id, q.title),
        url: q.url,
        ratingLabel: q.rating !== null ? `AC ${q.rating}` : "AtCoder",
        numericRating: q.rating,
        tags: uniq(q.tags),
        reason: `Missed ${q.slot} in attended AtCoder contest (${c.id.toUpperCase()})`,
        priorityScore: cfSlotPrio[q.slot] ?? 85,
        bucket: "missed_contest",
        ts: c.startTime,
      });
    }
  }

  // 4. Build dynamic upsolve queue (including Q1/Q2 and CF A/B/C gaps!)
  const weakSet = new Set(weakTags);
  const potdTags = new Set(potd?.today.tags.filter((t) => !GENERIC_TAGS.has(t)) || []);

  const lcSlotPrio: Record<string, number> = { Q1: 99, Q2: 97, Q3: 93, Q4: 88 };
  const lcMissedItems: UpsolveItem[] = (lcMissed || []).map((m) => ({
    key: makeProblemKey("LeetCode", m.id),
    platform: "LeetCode",
    slot: m.slot,
    title: m.title,
    url: m.url,
    ratingLabel: m.rating ? `LC ${m.rating}` : m.difficulty,
    numericRating: m.rating,
    tags: uniq(m.tags),
    reason: m.reason,
    priorityScore: lcSlotPrio[m.slot] ?? 88,
    bucket: "missed_contest",
    ts: m.ts,
  }));

  const cfMinDrill = Math.max(800, Math.min(1000, targetCfMin - 600));
  const cfMaxDrill = Math.max(1800, targetCfMin + 400);

  const potdFollowUps = potd
    ? allQuestions
        .filter(
          (q) =>
            q.id !== potd.today.slug &&
            q.tier !== "Div. 1 + Div. 2" &&
            q.tags.some((t) => potdTags.has(t)) &&
            ((q.platform === "LeetCode" && (q.slot === "Q2" || q.slot === "Q3" || q.slot === "Q4")) ||
              (q.platform === "Codeforces" && q.rating !== null && q.rating >= cfMinDrill && q.rating <= cfMaxDrill) ||
              (q.platform === "AtCoder" && q.rating !== null && q.rating >= 200 && q.rating <= 1800))
        )
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, 6)
    : [];

  const potdMatchItems: UpsolveItem[] = potdFollowUps.map((q) => ({
    key: makeProblemKey(q.platform, q.id),
    platform: q.platform,
    slot: q.platform === "Codeforces" ? `${q.contestId}${q.rawIndex}` : q.platform === "AtCoder" ? `${q.contestId.toUpperCase()} ${q.slot}` : q.slot,
    title: q.title,
    url: q.url,
    ratingLabel: q.rating !== null ? `${q.platform === "LeetCode" ? "LC" : q.platform === "Codeforces" ? "CF" : "AC"} ${q.rating}` : q.difficulty,
    numericRating: q.rating,
    tags: uniq(q.tags),
    reason: `Matches today's POTD (${potd?.today.title})`,
    priorityScore: 84,
    bucket: "potd_match",
    ts: q.startTime,
  }));

  const recentAcSet = new Set(lcRecentAcSlugs);
  const potdRecentItems: UpsolveItem[] = potd
    ? (potd.recent || [])
        .filter((p) => p.slug !== potd.today.slug && !recentAcSet.has(p.slug))
        .map((p) => ({
          key: makeProblemKey("LeetCode", p.slug),
          platform: "LeetCode",
          slot: `POTD ${p.date.slice(5)}`,
          title: `${p.id}. ${p.title}`,
          url: p.url,
          ratingLabel: p.difficulty,
          numericRating: null,
          tags: uniq(p.tags),
          reason: `Daily POTD (${p.date}) · Steady daily growth`,
          priorityScore: 86,
          bucket: "potd_recent",
          ts: Math.floor(new Date(p.date).getTime() / 1000) || 0,
        }))
    : [];

  const weakPillarItems: UpsolveItem[] = [];
  if (hasUserProfile && weakSet.size > 0) {
    for (const q of allQuestions.slice().sort((a, b) => b.startTime - a.startTime)) {
      if (q.platform === "Codeforces" && cfProbMap.get(q.id)?.ok) continue;
      if (q.platform === "AtCoder" && acMap.get(q.id)?.ok) continue;
      if (q.platform === "Codeforces" && q.tier === "Div. 1 + Div. 2") continue;

      const inTargetBand =
        (q.platform === "LeetCode" && (q.slot === "Q2" || q.slot === "Q3" || q.slot === "Q4")) ||
        (q.platform === "Codeforces" && q.rating !== null && q.rating >= cfMinDrill && q.rating <= cfMaxDrill) ||
        (q.platform === "AtCoder" && q.rating !== null && q.rating >= 200 && q.rating <= 1900);
      if (!inTargetBand) continue;

      const hits = q.tags.filter((t) => weakSet.has(t));
      if (!hits.length) continue;

      weakPillarItems.push({
        key: makeProblemKey(q.platform, q.id),
        platform: q.platform,
        slot: q.platform === "Codeforces" ? `${q.contestId}${q.rawIndex}` : q.platform === "AtCoder" ? `${q.contestId.toUpperCase()} ${q.slot}` : q.slot,
        title: q.title,
        url: q.url,
        ratingLabel: q.rating !== null ? `${q.platform === "LeetCode" ? "LC" : q.platform === "Codeforces" ? "CF" : "AC"} ${q.rating}` : q.difficulty,
        numericRating: q.rating,
        tags: uniq(q.tags),
        reason: `Targets growth topic: ${hits.slice(0, 2).join(", ")}`,
        priorityScore: 70 + hits.length * 6,
        bucket: "weak_pillar",
        ts: q.startTime,
      });
      if (weakPillarItems.length >= 90) break;
    }
  }

  const dedup = new Map<string, UpsolveItem>();
  for (const item of [
    ...cfUnsolved,
    ...acUnsolved,
    ...lcMissedItems,
    ...cfAttendedMissed,
    ...acAttendedMissed,
    ...potdRecentItems,
    ...potdMatchItems,
    ...weakPillarItems,
  ]) {
    const prev = dedup.get(item.key);
    if (!prev || item.priorityScore > prev.priorityScore) {
      dedup.set(item.key, item);
    }
  }

  const upsolveQueue = Array.from(dedup.values()).sort(
    (a, b) => b.priorityScore - a.priorityScore || b.ts - a.ts
  );

  return {
    cfAudit,
    weakTags,
    cfUnsolved: cfUnsolved.sort((a, b) => (a.numericRating || 9999) - (b.numericRating || 9999)),
    cfGoodSolves: cfGoodSolves.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (a.cleanAc === b.cleanAc ? b.ts - a.ts : a.cleanAc ? -1 : 1)),
    acUnsolved,
    acSolvedCount,
    acMaxDiff,
    cfSolvedCount,
    cfRatingBuckets,
    cfAttendedCount: attendedCf.length,
    cfSlotStats,
    upsolveQueue,
    potdFollowUps,
  };
}

/** Consistent difficulty/rating badge class: Red (Hard), Yellow (Medium), Green (Easy). */
export function difficultyBadgeClass(label?: string | null, rating?: number | null): string {
  const s = (label || "").toLowerCase();
  if (s.includes("hard")) return "badge-gap";
  if (s.includes("medium")) return "badge-warn";
  if (s.includes("easy")) return "badge-ok";
  const num = rating ?? (() => {
    const m = s.match(/(\d{3,4})/);
    return m ? Number(m[1]) : null;
  })();
  if (num !== null && Number.isFinite(num)) {
    if (num >= 1900) return "badge-gap";
    if (num >= 1400) return "badge-warn";
    return "badge-ok";
  }
  return "pill-inactive";
}
