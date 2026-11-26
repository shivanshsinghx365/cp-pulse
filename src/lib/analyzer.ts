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
          tags: tagIds.map((i) => raw.tags[i]).filter(Boolean),
          url,
          src,
        };
      }),
    };
  });
}

export interface ProfileDiagnosis {
  cfAudit: TagAuditRow[];
  weakTags: string[];
  cfUnsolved: UpsolveItem[];
  acUnsolved: UpsolveItem[];
  acSolvedCount: number;
  acMaxDiff: number | null;
  cfSolvedCount: number;
  cfRatingBuckets: { label: string; count: number }[];
  upsolveQueue: UpsolveItem[];
  potdFollowUps: ContestQuestion[];
}

export function analyzeProfile(
  contests: ContestRecord[],
  potd: PotdPayload | null,
  cf: LiveCfResult | null,
  acSubs: AcSubmission[],
  lcMissed: OwnerSnapshot["leetcode"]["missedContestQuestions"] | null,
  targetCfMin = 1500
): ProfileDiagnosis {
  const allQuestions = contests.flatMap((c) => c.questions);
  const qById = new Map<string, ContestQuestion>();
  for (const q of allQuestions) {
    if (q.platform === "AtCoder") qById.set(q.id, q);
  }

  // 1. Codeforces submission analysis
  const cfProbMap = new Map<
    string,
    {
      cid: number;
      idx: string;
      name: string;
      rating: number | null;
      tags: string[];
      ok: boolean;
      verdicts: Record<string, number>;
      ts: number;
    }
  >();

  if (cf) {
    for (const s of cf.submissions) {
      const p = s.problem;
      const cid = p.contestId || s.contestId || 0;
      const key = `${cid}${p.index}`;
      const cur = cfProbMap.get(key) || {
        cid,
        idx: p.index,
        name: p.name,
        rating: p.rating ?? null,
        tags: (p.tags || []).map(mapCfTag),
        ok: false,
        verdicts: {},
        ts: s.creationTimeSeconds,
      };
      if (s.verdict === "OK") cur.ok = true;
      else if (s.verdict) cur.verdicts[s.verdict] = (cur.verdicts[s.verdict] || 0) + 1;
      cur.ts = Math.max(cur.ts, s.creationTimeSeconds);
      cfProbMap.set(key, cur);
    }
  }

  const okByTag = new Map<string, number[]>();
  const failByTag = new Map<string, number>();
  const cfUnsolved: UpsolveItem[] = [];
  const cfRatingCount = new Map<number, number>();
  let cfSolvedCount = 0;

  for (const [id, item] of cfProbMap.entries()) {
    if (item.ok) {
      cfSolvedCount++;
      if (item.rating) cfRatingCount.set(item.rating, (cfRatingCount.get(item.rating) || 0) + 1);
      for (const t of new Set(item.tags)) {
        const arr = okByTag.get(t) || [];
        if (item.rating) arr.push(item.rating);
        okByTag.set(t, arr);
      }
    } else {
      for (const t of new Set(item.tags)) {
        failByTag.set(t, (failByTag.get(t) || 0) + 1);
      }
      const vStr = Object.entries(item.verdicts)
        .map(([k, v]) => `${k.replace(/_/g, " ")} ×${v}`)
        .join(", ");
      cfUnsolved.push({
        key: makeProblemKey("Codeforces", id),
        platform: "Codeforces",
        slot: item.idx,
        title: `${id} · ${item.name}`,
        url: `https://codeforces.com/contest/${item.cid}/problem/${item.idx}`,
        ratingLabel: item.rating ? `CF ${item.rating}` : "Unrated",
        numericRating: item.rating,
        tags: item.tags,
        reason: `Attempted & unsolved (${vStr || "WA"})`,
        priorityScore: 100 - (item.rating ? Math.abs(item.rating - targetCfMin) / 40 : 10),
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

  const cfAudit: TagAuditRow[] = allAuditTags
    .map((tag) => {
      const ratings = (okByTag.get(tag) || []).slice().sort((a, b) => a - b);
      // Note: ok count includes unrated solves too, track via ratings + count
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
    .sort((a, b) => b.ok + b.fail - (a.ok + a.fail));

  // Weak tags prioritize Gaps, Capped below target, and Untouched high-demand topics
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
  const acMap = new Map<string, { ok: boolean; cid: string; ts: number; lastRes: string }>();
  for (const s of acSubs) {
    const cur = acMap.get(s.problem_id) || {
      ok: false,
      cid: s.contest_id,
      ts: s.epoch_second,
      lastRes: s.result,
    };
    if (s.result === "AC") cur.ok = true;
    cur.ts = Math.max(cur.ts, s.epoch_second);
    cur.lastRes = s.result;
    acMap.set(s.problem_id, cur);
  }
  let acSolvedCount = 0;
  let acMaxDiff: number | null = null;
  const acUnsolved: UpsolveItem[] = [];
  for (const [pid, info] of acMap.entries()) {
    const q = qById.get(pid);
    if (info.ok) {
      acSolvedCount++;
      if (q?.rating !== null && q?.rating !== undefined) {
        acMaxDiff = acMaxDiff === null ? q.rating : Math.max(acMaxDiff, q.rating);
      }
    } else {
      acUnsolved.push({
        key: makeProblemKey("AtCoder", pid),
        platform: "AtCoder",
        slot: pid.split("_").pop()?.toUpperCase() || "?",
        title: q ? `${pid} · ${q.title}` : pid,
        url: `https://atcoder.jp/contests/${info.cid}/tasks/${pid}`,
        ratingLabel: q?.rating !== null && q?.rating !== undefined ? `AC ${q.rating}` : "AtCoder",
        numericRating: q?.rating ?? null,
        tags: q?.tags || ["Combinatorics & Counting"],
        reason: `Attempted on AtCoder (${info.lastRes})`,
        priorityScore: 95,
        bucket: "attempted_unsolved",
        ts: info.ts,
      });
    }
  }

  // 3. Rating histogram for CF
  const cfRatingBuckets = Array.from(cfRatingCount.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([r, c]) => ({ label: String(r), count: c }));

  // 4. Build dynamic upsolve queue
  const weakSet = new Set(weakTags);
  const potdTags = new Set(potd?.today.tags.filter((t) => !GENERIC_TAGS.has(t)) || []);

  const lcMissedItems: UpsolveItem[] = (lcMissed || []).map((m) => ({
    key: makeProblemKey("LeetCode", m.id),
    platform: "LeetCode",
    slot: m.slot,
    title: m.title,
    url: m.url,
    ratingLabel: m.rating ? `LC ${m.rating}` : m.difficulty,
    numericRating: m.rating,
    tags: m.tags,
    reason: m.reason,
    priorityScore: m.slot === "Q3" ? 94 : 88,
    bucket: "missed_contest",
    ts: m.ts,
  }));

  // POTD follow-up matches from rolling 1-year window
  const potdFollowUps = potd
    ? allQuestions
        .filter(
          (q) =>
            q.id !== potd.today.slug &&
            q.tags.some((t) => potdTags.has(t)) &&
            ((q.platform === "LeetCode" && (q.slot === "Q3" || q.slot === "Q4")) ||
              (q.platform === "Codeforces" && q.rating !== null && q.rating >= 1300 && q.rating <= 1900) ||
              (q.platform === "AtCoder" && q.rating !== null && q.rating >= 800 && q.rating <= 1800))
        )
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, 6)
    : [];

  const potdMatchItems: UpsolveItem[] = potdFollowUps.map((q) => ({
    key: makeProblemKey(q.platform, q.id),
    platform: q.platform,
    slot: q.slot,
    title: q.title,
    url: q.url,
    ratingLabel: q.rating !== null ? `${q.platform === "LeetCode" ? "LC" : q.platform === "Codeforces" ? "CF" : "AC"} ${q.rating}` : q.difficulty,
    numericRating: q.rating,
    tags: q.tags,
    reason: `Matches today's POTD (${potd?.today.title})`,
    priorityScore: 84,
    bucket: "potd_match",
    ts: q.startTime,
  }));

  // Rolling 1-year weak-pillar problems (excluding already solved on CF/AC)
  const weakPillarItems: UpsolveItem[] = [];
  for (const q of allQuestions.slice().sort((a, b) => b.startTime - a.startTime)) {
    if (q.platform === "Codeforces" && cfProbMap.get(q.id)?.ok) continue;
    if (q.platform === "AtCoder" && acMap.get(q.id)?.ok) continue;

    const inTargetBand =
      (q.platform === "LeetCode" && (q.slot === "Q3" || q.slot === "Q4")) ||
      (q.platform === "Codeforces" && q.rating !== null && q.rating >= 1300 && q.rating <= 2000) ||
      (q.platform === "AtCoder" && q.rating !== null && q.rating >= 800 && q.rating <= 1900);
    if (!inTargetBand) continue;

    const hits = q.tags.filter((t) => weakSet.has(t));
    if (!hits.length) continue;

    weakPillarItems.push({
      key: makeProblemKey(q.platform, q.id),
      platform: q.platform,
      slot: q.slot,
      title: q.title,
      url: q.url,
      ratingLabel: q.rating !== null ? `${q.platform === "LeetCode" ? "LC" : q.platform === "Codeforces" ? "CF" : "AC"} ${q.rating}` : q.difficulty,
      numericRating: q.rating,
      tags: q.tags,
      reason: `Targets gap: ${hits.slice(0, 2).join(", ")}`,
      priorityScore: 70 + hits.length * 6,
      bucket: "weak_pillar",
      ts: q.startTime,
    });
    if (weakPillarItems.length >= 60) break;
  }

  // Deduplicate by key preserving highest priority
  const dedup = new Map<string, UpsolveItem>();
  for (const item of [...cfUnsolved, ...acUnsolved, ...lcMissedItems, ...potdMatchItems, ...weakPillarItems]) {
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
    acUnsolved,
    acSolvedCount,
    acMaxDiff,
    cfSolvedCount,
    cfRatingBuckets,
    upsolveQueue,
    potdFollowUps,
  };
}
