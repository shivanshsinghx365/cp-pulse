export const GENERIC_TAGS = new Set([
  "Arrays & Matrix / Grid",
  "Implementation & Simulation",
]);

const CF_TO_CANONICAL: Record<string, string> = {
  dp: "Dynamic Programming",
  greedy: "Greedy",
  math: "Math",
  "number theory": "Number Theory & Mod",
  "chinese remainder theorem": "Number Theory & Mod",
  combinatorics: "Combinatorics & Counting",
  probabilities: "Probability & Expected Value",
  fft: "FFT / Polynomials",
  matrices: "Matrices & Linear Algebra",
  graphs: "Graphs",
  "shortest paths": "Shortest Path",
  "graph matchings": "Flows & Matchings",
  flows: "Flows & Matchings",
  "2-sat": "Graphs",
  trees: "Trees",
  "dfs and similar": "DFS / BFS / Traversal",
  dsu: "Union-Find (DSU)",
  "data structures": "Data Structures (General)",
  "binary search": "Binary / Ternary Search",
  "ternary search": "Binary / Ternary Search",
  sortings: "Sorting",
  "two pointers": "Two Pointers & Sliding Window",
  "divide and conquer": "Divide & Conquer",
  "meet-in-the-middle": "Divide & Conquer",
  bitmasks: "Bit Manipulation",
  strings: "Strings",
  hashing: "Hashing / Rolling Hash",
  "string suffix structures": "Trie & String Suffix",
  "expression parsing": "Strings",
  implementation: "Implementation & Simulation",
  "constructive algorithms": "Constructive & Ad-hoc",
  "brute force": "Brute Force & Enumeration",
  games: "Game Theory",
  geometry: "Geometry",
  interactive: "Interactive & Comm",
  schedules: "Intervals & Sweep Line",
};

export function mapCfTag(raw: string): string {
  const k = raw.trim().toLowerCase();
  return CF_TO_CANONICAL[k] || raw.trim();
}

export function makeProblemKey(platform: string, id: string): string {
  const p = platform === "LeetCode" ? "lc" : platform === "Codeforces" ? "cf" : "ac";
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${p}_${safe}`;
}
