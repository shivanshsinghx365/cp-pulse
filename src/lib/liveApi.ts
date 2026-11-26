import type { AcSubmission, CfRatingPoint, CfSubmission } from "../types";

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

export async function fetchLiveCodeforces(handle: string): Promise<LiveCfResult> {
  const clean = encodeURIComponent(handle.trim());
  const [infoRes, ratingRes, statusRes] = await Promise.all([
    fetch(`https://codeforces.com/api/user.info?handles=${clean}`),
    fetch(`https://codeforces.com/api/user.rating?handle=${clean}`),
    fetch(`https://codeforces.com/api/user.status?handle=${clean}&from=1&count=1500`),
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
  for (let i = 0; i < 6; i++) {
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

export async function fetchGeminiHint(
  geminiKey: string,
  problem: { platform: string; title: string; ratingLabel: string; tags: string[]; reason?: string }
): Promise<string> {
  if (!geminiKey.trim()) {
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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
      geminiKey.trim()
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText.slice(0, 160)}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No hint returned.";
}
