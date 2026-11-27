/**
 * CP Pulse — CORS proxy worker (Cloudflare Workers, free tier)
 *
 * Proxies two CORS-blocked APIs so the browser can fetch them live:
 *   GET  /lc/<username>          → LeetCode contest ranking + full history
 *   GET  /ac/<username>/history  → AtCoder rating history JSON
 *
 * Deploy:
 *   npx wrangler deploy worker/cp-proxy.js --name cp-proxy --compatibility-date 2024-01-01
 *
 * After deploy, set VITE_CP_PROXY_URL=https://cp-proxy.<your-subdomain>.workers.dev
 * in your GitHub repo vars (Actions → Variables → New repository variable).
 */

const ALLOWED_ORIGINS = new Set([
  "https://shivanshsinghx365.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
]);

function getCorsHeaders(request) {
  const origin = request?.headers?.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://shivanshsinghx365.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function corsResponse(request, body, status = 200, extra = {}) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders(request), ...extra },
  });
}

// ── LeetCode GraphQL query ───────────────────────────────────────────────────
const LC_GQL_QUERY = `
query userContestInfo($username: String!) {
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
    totalParticipants
    topPercentage
    badge { name }
  }
  userContestRankingHistory(username: $username) {
    attended
    rating
    ranking
    problemsSolved
    totalProblems
    contest { title titleSlug startTime }
  }
}`;

async function fetchLeetCode(username) {
  const payload = JSON.stringify({ query: LC_GQL_QUERY, variables: { username } });
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0",
      Referer: "https://leetcode.com/",
    },
    body: payload,
  });
  if (!res.ok) throw new Error(`LC upstream ${res.status}`);
  return res.text();
}

// ── AtCoder rating history ───────────────────────────────────────────────────
async function fetchAtCoderHistory(username) {
  const res = await fetch(`https://atcoder.jp/users/${encodeURIComponent(username)}/history/json`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`AC upstream ${res.status}`);
  return res.text();
}

// ── Router ───────────────────────────────────────────────────────────────────
export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: getCorsHeaders(request) });
    }

    if (request.method !== "GET") {
      return corsResponse(request, JSON.stringify({ error: "Method not allowed" }), 405);
    }

    // /lc/<username>
    const lcMatch = url.pathname.match(/^\/lc\/([^/]+)$/);
    if (lcMatch) {
      try {
        const body = await fetchLeetCode(lcMatch[1]);
        return corsResponse(request, body);
      } catch (e) {
        return corsResponse(request, JSON.stringify({ error: e.message }), 502);
      }
    }

    // /ac/<username>/history
    const acMatch = url.pathname.match(/^\/ac\/([^/]+)\/history$/);
    if (acMatch) {
      try {
        const body = await fetchAtCoderHistory(acMatch[1]);
        return corsResponse(request, body);
      } catch (e) {
        return corsResponse(request, JSON.stringify({ error: e.message }), 502);
      }
    }

    // health check
    if (url.pathname === "/") {
      return corsResponse(request, JSON.stringify({ status: "ok", service: "cp-proxy" }));
    }

    return corsResponse(request, JSON.stringify({ error: "Not found" }), 404);
  },
};
