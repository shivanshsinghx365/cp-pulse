import type { AcRatingPoint, AcSubmission, CfRatingPoint, CfSubmission } from "../types";

// ── Proxy URL ────────────────────────────────────────────────────────────────
// Set VITE_CP_PROXY_URL in GitHub repo vars after deploying worker/cp-proxy.js.
// Falls back to empty string → fetch attempts will throw and callers handle gracefully.
const PROXY = (import.meta.env.VITE_CP_PROXY_URL || "").replace(/\/$/, "");

export interface LiveCfResult {
  info: {
    handle: string;
    rating?: number;
    maxRating?: number;
    rank?: string;
    maxRank?: string;
  };
  ratingHistory: CfRatingPoint[];
  submissions: CfSubmission[];
}

// ── Codeforces (native CORS — no proxy needed) ───────────────────────────────

export async function fetchLiveCodeforces(handle: string): Promise<LiveCfResult> {
  const clean = encodeURIComponent(handle.trim());
  const [infoRes, ratingRes, statusRes] = await Promise.all([
    fetch(`https://codeforces.com/api/user.info?handles=${clean}`),
    fetch(`https://codeforces.com/api/user.rating?handle=${clean}`),
    fetch(`https://codeforces.com/api/user.status?handle=${clean}&from=1&count=3000`),
  ]);

  const [infoJ, ratingJ, statusJ] = await Promise.all([
    infoRes.json(),
    ratingRes.json(),
    statusRes.json(),
  ]);

  if (infoJ.status !== "OK") {
    throw new Error(infoJ.comment || `Codeforces handle "${handle}" not found`);
  }

  return {
    info: infoJ.result[0],
    ratingHistory: ratingJ.status === "OK" ? ratingJ.result : [],
    submissions: statusJ.status === "OK" ? statusJ.result : [],
  };
}

export async function fetchLiveAtCoder(handle: string): Promise<AcSubmission[]> {
  const clean = encodeURIComponent(handle.trim());
  const all: AcSubmission[] = [];
  let fromSec = 0;
  for (let i = 0; i < 15; i++) {
    const res = await fetch(
      `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${clean}&from_second=${fromSec}`
    );
    if (!res.ok) break;
    const batch: AcSubmission[] = await res.json();
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < 500) break;
    fromSec = batch[batch.length - 1].epoch_second + 1;
  }
  return all;
}

// ── LeetCode (via CORS proxy) ────────────────────────────────────────────────
// The returned shape exactly matches OwnerSnapshot["leetcode"] so it can be passed
// to PerformanceTab / DiagnosisTab without any type casting.

export interface LiveLcResult {
  ranking: {
    attendedContestsCount: number;
    rating: number;
    globalRanking: number;
    topPercentage: number;
  } | null;
  acStats: { difficulty: string; count: number; submissions: number }[];
  tagCounts: Record<string, number>;
  contestHistory: {
    title: string;
    slug: string;
    startTime: number;
    rating: number;
    ranking: number;
    solved: number;
    total: number;
  }[];
  missedContestQuestions: never[];
  recentAc: { title: string; titleSlug: string; timestamp: string }[];
}

/** Fetch LeetCode contest ranking + history via the cp-proxy Cloudflare Worker.
 *  Returns null if VITE_CP_PROXY_URL is not set or the worker returns an error. */
export async function fetchLiveLeetCode(handle: string): Promise<LiveLcResult | null> {
  if (!PROXY) return null;
  try {
    const res = await fetch(`${PROXY}/lc/${encodeURIComponent(handle.trim())}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error) return null;
    const data = json.data ?? {};
    const rawRanking = data.userContestRanking ?? null;
    const rawHistory: Array<{
      attended: boolean;
      rating: number;
      ranking: number;
      problemsSolved: number;
      totalProblems: number;
      contest: { title: string; titleSlug: string; startTime: number };
    }> = data.userContestRankingHistory ?? [];
    return {
      ranking: rawRanking
        ? {
            attendedContestsCount: rawRanking.attendedContestsCount ?? 0,
            rating: rawRanking.rating ?? 0,
            globalRanking: rawRanking.globalRanking ?? 0,
            topPercentage: rawRanking.topPercentage ?? 100,
          }
        : null,
      acStats: [],       // not fetched via proxy — use snapshot value if available
      tagCounts: {},     // not fetched via proxy — use snapshot value if available
      contestHistory: rawHistory
        .filter((h) => h.attended)
        .map((h) => ({
          title: h.contest.title,
          slug: h.contest.titleSlug,
          startTime: h.contest.startTime,
          rating: h.rating,
          ranking: h.ranking,
          solved: h.problemsSolved,
          total: h.totalProblems,
        })),
      missedContestQuestions: [],   // computed server-side only; use snapshot
      recentAc: [],                 // not fetched via proxy; use snapshot
    };
  } catch {
    return null;
  }
}

// ── AtCoder rating history (native CORS via kenkoooo proxy) ──────────────────

/** Fetch AtCoder rating history directly from kenkoooo's CORS-enabled proxy.
 *  Returns an empty array (never throws) on error or if the handle has no history. */
export async function fetchLiveAcRatingHistory(handle: string): Promise<AcRatingPoint[]> {
  const clean = encodeURIComponent(handle.trim());
  if (!clean) return [];
  try {
    const res = await fetch(`https://kenkoooo.com/atcoder/proxy/users/${clean}/history/json`);
    if (!res.ok) return [];
    const raw: Array<Record<string, unknown>> = await res.json();
    if (!Array.isArray(raw)) return [];
    return raw.map((r) => {
      const endStr = (r["EndTime"] as string) || (r["StartTime"] as string) || "";
      let ts = 0;
      try { ts = endStr ? Math.floor(new Date(endStr).getTime() / 1000) : 0; } catch { ts = 0; }
      return {
        isRated: Boolean(r["IsRated"]),
        place: (r["Place"] as number) || 0,
        oldRating: (r["OldRating"] as number) || 0,
        newRating: (r["NewRating"] as number) || 0,
        performance: (r["Performance"] as number) || 0,
        contestName: (r["ContestNameEn"] as string) || (r["ContestName"] as string) || "",
        contestScreenName: (r["ContestScreenName"] as string) || "",
        ts,
      };
    });
  } catch {
    return [];
  }
}

const cachedGeminiModels = new Map<string, string[]>();

function scoreGeminiModel(id: string): number {
  const lower = id.toLowerCase();
  if (/embedding|imagen|veo|tts|audio|live|robotics|computer-use|aqa|bison|gecko|image/.test(lower)) {
    return -1;
  }
  const isFlash = lower.includes("flash") ? 1000 : lower.includes("pro") ? 500 : 100;
  const verMatch = lower.match(/gemini-(\d+)(?:\.(\d+))?/);
  const major = verMatch ? Number(verMatch[1]) : 0;
  const minor = verMatch && verMatch[2] ? Number(verMatch[2]) : 0;
  const versionScore = major * 100 + minor * 10;
  const isLatestAlias = lower.includes("flash-latest") ? 50 : 0;
  const stableBonus = /exp|preview/.test(lower) ? 0 : 5;
  return isFlash + versionScore + isLatestAlias + stableBonus;
}

async function getGeminiCandidateModels(apiKey: string): Promise<string[]> {
  const cached = cachedGeminiModels.get(apiKey);
  if (cached?.length) return cached;

  const fallback = ["gemini-flash-latest", "gemini-3.5-flash-lite", "gemini-3.8-flash"];
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    const list: Array<{ name?: string; supportedGenerationMethods?: string[] }> = data?.models || [];
    const ranked = list
      .filter((m) => m.name && m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name!.replace(/^models\//, ""))
      .map((id) => ({ id, score: scoreGeminiModel(id) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.id);

    const candidates = ranked.length ? [...new Set([...ranked.slice(0, 4), ...fallback])] : fallback;
    cachedGeminiModels.set(apiKey, candidates);
    return candidates;
  } catch {
    return fallback;
  }
}

export async function fetchGeminiHint(
  geminiKey: string,
  problem: { platform: string; title: string; ratingLabel: string; tags: string[]; reason?: string }
): Promise<string> {
  const cleanKey = geminiKey.trim();
  if (!cleanKey) {
    throw new Error("Add your Gemini API key in Owner Settings first.");
  }
  const prompt = `You are an ICPC/Guardian-level competitive programming coach.
Give a concise, structured coaching note for this problem WITHOUT giving away full code:
- Problem: ${problem.title} (${problem.platform}, ${problem.ratingLabel})
- Topics: ${problem.tags.join(", ")}
${problem.reason ? `- Context: ${problem.reason}` : ""}

Format in 3 short bullet points:
1. Key Observation / Invariant (1-2 sentences)
2. Algorithm & State / Complexity (1-2 sentences)
3. Common Trap / Edge Case to avoid (1 sentence)`;

  const models = await getGeminiCandidateModels(cleanKey);
  let lastErr = "No Gemini model succeeded.";
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent?key=${encodeURIComponent(cleanKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No hint returned.";
    }
    const errText = await res.text();
    lastErr = `Gemini API error (${res.status}): ${errText.slice(0, 160)}`;
    if (res.status !== 404 && res.status !== 400) {
      throw new Error(lastErr);
    }
  }
  throw new Error(lastErr);
}
