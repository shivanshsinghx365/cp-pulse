"""Daily rolling 12-month sync script for CP Pulse.

Outputs:
  public/data/contests_1yr.json   - Compact 365-day sliding window across LC, CF, AtCoder ABC
  public/data/potd.json           - Today's LeetCode POTD + recent 30-day POTDs
  public/data/owner_snapshot.json - Owner's LC/CF/AC snapshot (ratings, tag counts, unsolved queue)

Optional environment variables:
  OWNER_LC_HANDLE (default: shivanshx365)
  OWNER_CF_HANDLE (default: shivanshx365)
  OWNER_AC_HANDLE (default: shivanshx365)
  GEMINI_API_KEY  (optional: auto-tags brand-new LC/AtCoder questions without official/community tags)
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DATA = ROOT / "public" / "data"
PUBLIC_DATA.mkdir(parents=True, exist_ok=True)

NOW = time.time()
ONE_YR = NOW - 365 * 86400

OWNER_LC = os.environ.get("OWNER_LC_HANDLE", "").strip()
OWNER_CF = os.environ.get("OWNER_CF_HANDLE", "").strip()
OWNER_AC = os.environ.get("OWNER_AC_HANDLE", "").strip()
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "").strip()


def get_text(url: str, headers: dict[str, str] | None = None, timeout: int = 25) -> str:
    hdrs = {"User-Agent": "Mozilla/5.0"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs)
    return urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", "ignore")


def get_json(url: str, headers: dict[str, str] | None = None):
    return json.loads(get_text(url, headers=headers))


def lc_gql(query: str, variables: dict | None = None):
    payload: dict = {"query": query}
    if variables:
        payload["variables"] = variables
    req = urllib.request.Request(
        "https://leetcode.com/graphql",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://leetcode.com/",
        },
    )
    return json.loads(urllib.request.urlopen(req, timeout=25).read().decode("utf-8"))


CANONICAL_MAP = {
    "dp": "Dynamic Programming",
    "dynamic programming": "Dynamic Programming",
    "bitmask dp": "Dynamic Programming",
    "memoization": "Dynamic Programming",
    "dp on trees": "Dynamic Programming",
    "digit dp": "Dynamic Programming",
    "knapsack": "Dynamic Programming",
    "lis": "Dynamic Programming",
    "subsequence": "Dynamic Programming",
    "traveling salesman": "Dynamic Programming",
    "greedy": "Greedy",
    "optimization": "Greedy",
    "math": "Math",
    "parity": "Math",
    "formula": "Math",
    "linear programming": "Math",
    "modular arithmetic": "Number Theory & Mod",
    "number theory": "Number Theory & Mod",
    "chinese remainder theorem": "Number Theory & Mod",
    "divisibility": "Number Theory & Mod",
    "prime factorization": "Number Theory & Mod",
    "prime sieve": "Number Theory & Mod",
    "floor sum": "Number Theory & Mod",
    "modular exponentiation": "Number Theory & Mod",
    "combinatorics": "Combinatorics & Counting",
    "counting": "Combinatorics & Counting",
    "inclusion-exclusion": "Combinatorics & Counting",
    "inclusion exclusion": "Combinatorics & Counting",
    "generating function": "Combinatorics & Counting",
    "permutation": "Combinatorics & Counting",
    "binomial coefficient": "Combinatorics & Counting",
    "probabilities": "Probability & Expected Value",
    "probability": "Probability & Expected Value",
    "expectation": "Probability & Expected Value",
    "fft": "FFT / Polynomials",
    "convolution": "FFT / Polynomials",
    "formal power series": "FFT / Polynomials",
    "matrices": "Matrices & Linear Algebra",
    "matrix exponentiation": "Matrices & Linear Algebra",
    "graphs": "Graphs",
    "graph": "Graphs",
    "graph theory": "Graphs",
    "topological sort": "Graphs",
    "spanning tree": "Graphs",
    "reachability": "Graphs",
    "2-sat": "Graphs",
    "bipartite graph": "Graphs",
    "bipartite": "Graphs",
    "cycle": "Graphs",
    "degree": "Graphs",
    "directed graph": "Graphs",
    "implicit graph": "Graphs",
    "unweighted graph": "Graphs",
    "path": "Graphs",
    "hamiltonian path": "Graphs",
    "independent set": "Graphs",
    "shortest paths": "Shortest Path",
    "shortest path": "Shortest Path",
    "graph matchings": "Flows & Matchings",
    "flows": "Flows & Matchings",
    "max flow": "Flows & Matchings",
    "bipartite matching": "Flows & Matchings",
    "min cut": "Flows & Matchings",
    "trees": "Trees",
    "tree": "Trees",
    "binary tree": "Trees",
    "centroid decomposition": "Trees",
    "cartesian tree": "Trees",
    "lca": "Trees",
    "diameter": "Trees",
    "rooted tree": "Trees",
    "subtree": "Trees",
    "euler tour": "Trees",
    "dfs and similar": "DFS / BFS / Traversal",
    "dfs": "DFS / BFS / Traversal",
    "bfs": "DFS / BFS / Traversal",
    "depth-first search": "DFS / BFS / Traversal",
    "breadth-first search": "DFS / BFS / Traversal",
    "backtracking": "DFS / BFS / Traversal",
    "recursion": "DFS / BFS / Traversal",
    "flood fill": "DFS / BFS / Traversal",
    "search": "DFS / BFS / Traversal",
    "dsu": "Union-Find (DSU)",
    "union-find": "Union-Find (DSU)",
    "connectivity": "Union-Find (DSU)",
    "connected components": "Union-Find (DSU)",
    "data structures": "Data Structures (General)",
    "data structure": "Data Structures (General)",
    "linked list": "Data Structures (General)",
    "query": "Data Structures (General)",
    "segment tree": "SegTree / BIT (Fenwick)",
    "binary indexed tree": "SegTree / BIT (Fenwick)",
    "fenwick tree": "SegTree / BIT (Fenwick)",
    "inversion": "SegTree / BIT (Fenwick)",
    "inversion counting": "SegTree / BIT (Fenwick)",
    "lazy segment tree": "SegTree / BIT (Fenwick)",
    "range update": "SegTree / BIT (Fenwick)",
    "lazy propagation": "SegTree / BIT (Fenwick)",
    "range minimum query": "SegTree / BIT (Fenwick)",
    "range sum query": "SegTree / BIT (Fenwick)",
    "point update": "SegTree / BIT (Fenwick)",
    "range query": "SegTree / BIT (Fenwick)",
    "heap (priority queue)": "Heap / Priority Queue",
    "priority queue": "Heap / Priority Queue",
    "heap": "Heap / Priority Queue",
    "hash table": "Hash Table / Set",
    "frequency array": "Hash Table / Set",
    "set": "Hash Table / Set",
    "hash set": "Hash Table / Set",
    "hash map": "Hash Table / Set",
    "map": "Hash Table / Set",
    "hashing": "Hashing / Rolling Hash",
    "rolling hash": "Hashing / Rolling Hash",
    "hash function": "Hashing / Rolling Hash",
    "ordered set": "Ordered Set / Balanced BST",
    "multiset": "Ordered Set / Balanced BST",
    "order statistic tree": "Ordered Set / Balanced BST",
    "stack": "Stack / Monotonic Stack",
    "monotonic stack": "Stack / Monotonic Stack",
    "queue": "Queue / Monotonic Queue",
    "monotonic queue": "Queue / Monotonic Queue",
    "deque": "Queue / Monotonic Queue",
    "trie": "Trie & String Suffix",
    "suffix array": "Trie & String Suffix",
    "string suffix structures": "Trie & String Suffix",
    "sqrt decomposition": "Sqrt / Mo's / Offline",
    "mo's algorithm": "Sqrt / Mo's / Offline",
    "offline queries": "Sqrt / Mo's / Offline",
    "offline processing": "Sqrt / Mo's / Offline",
    "data stream": "Design & Streams",
    "design": "Design & Streams",
    "binary search": "Binary / Ternary Search",
    "ternary search": "Binary / Ternary Search",
    "binary search on answer": "Binary / Ternary Search",
    "median": "Binary / Ternary Search",
    "sorting": "Sorting",
    "sortings": "Sorting",
    "merge sort": "Sorting",
    "quickselect": "Sorting",
    "bucket sort": "Sorting",
    "coordinate compression": "Sorting",
    "compression": "Sorting",
    "two pointers": "Two Pointers & Sliding Window",
    "two pointer": "Two Pointers & Sliding Window",
    "sliding window": "Two Pointers & Sliding Window",
    "prefix sum": "Prefix Sum & Diff Array",
    "2d prefix sum": "Prefix Sum & Diff Array",
    "2d difference array": "Prefix Sum & Diff Array",
    "difference array": "Prefix Sum & Diff Array",
    "prefix": "Prefix Sum & Diff Array",
    "suffix sum": "Prefix Sum & Diff Array",
    "prefix suffix": "Prefix Sum & Diff Array",
    "precomputation": "Prefix Sum & Diff Array",
    "divide and conquer": "Divide & Conquer",
    "meet in the middle": "Divide & Conquer",
    "bitmasks": "Bit Manipulation",
    "bit manipulation": "Bit Manipulation",
    "bitmask": "Bit Manipulation",
    "strings": "Strings",
    "string": "Strings",
    "string matching": "Strings",
    "expression parsing": "Strings",
    "z algorithm": "Strings",
    "lcp": "Strings",
    "run-length encoding": "Strings",
    "automaton": "Strings",
    "implementation": "Implementation & Simulation",
    "simulation": "Implementation & Simulation",
    "data types": "Implementation & Simulation",
    "language features": "Implementation & Simulation",
    "introductory": "Implementation & Simulation",
    "iteration": "Implementation & Simulation",
    "validation": "Implementation & Simulation",
    "direction": "Implementation & Simulation",
    "constructive algorithms": "Constructive & Ad-hoc",
    "constructive": "Constructive & Ad-hoc",
    "brainteaser": "Constructive & Ad-hoc",
    "observation": "Constructive & Ad-hoc",
    "casework": "Constructive & Ad-hoc",
    "tiling": "Constructive & Ad-hoc",
    "pattern": "Constructive & Ad-hoc",
    "periodicity": "Constructive & Ad-hoc",
    "symmetry": "Constructive & Ad-hoc",
    "brute force": "Brute Force & Enumeration",
    "enumeration": "Brute Force & Enumeration",
    "array": "Arrays & Matrix / Grid",
    "matrix": "Arrays & Matrix / Grid",
    "grid": "Arrays & Matrix / Grid",
    "subarray": "Arrays & Matrix / Grid",
    "interval": "Intervals & Sweep Line",
    "sweep line": "Intervals & Sweep Line",
    "schedules": "Intervals & Sweep Line",
    "plane sweep": "Intervals & Sweep Line",
    "scheduling": "Intervals & Sweep Line",
    "games": "Game Theory",
    "game theory": "Game Theory",
    "minimax": "Game Theory",
    "geometry": "Geometry",
    "manhattan distance": "Geometry",
    "coordinate geometry": "Geometry",
    "computational geometry": "Geometry",
    "vector": "Geometry",
    "rectangle": "Geometry",
    "distance": "Geometry",
    "interactive": "Interactive & Comm",
    "communication": "Interactive & Comm",
}

ZH_TO_EN = {
    "贪心": "greedy", "二分": "binary search", "排序": "sorting",
    "双指针 two-pointer": "two pointers", "模拟": "simulation", "数学": "math",
    "计算几何": "geometry", "广度优先搜索 BFS": "bfs", "线段树": "segment tree",
    "点分治": "centroid decomposition", "树的直径": "trees", "动态树分治": "trees",
    "动态 DP": "dp", "线段树分治": "segment tree", "树链剖分": "trees",
    "数论": "number theory", "最大公约数 gcd": "number theory", "莫队": "mo's algorithm",
    "树状数组": "binary indexed tree", "动态规划 DP": "dp", "组合数学": "combinatorics",
    "网络流": "flows", "枚举": "brute force", "前缀和": "prefix sum",
    "哈希表": "hash table", "凸完全单调性（wqs 二分）": "binary search",
    "字符串": "strings", "差分": "prefix sum", "分类讨论": "casework",
    "容斥原理": "inclusion-exclusion", "生成函数": "generating function",
    "快速数论变换 NTT": "fft", "排列组合": "combinatorics", "单调栈": "monotonic stack",
    "离线处理": "offline queries", "图论": "graphs", "最短路": "shortest paths",
    "期望": "probabilities", "堆": "heap", "分治": "divide and conquer",
    "链表": "linked list", "反悔贪心": "greedy", "并查集": "dsu",
    "队列": "queue", "STL": "data structures", "最近公共祖先 LCA": "trees",
    "数位 DP": "dp", "状压 DP": "bitmask dp", "单调队列": "monotonic queue",
    "记忆化搜索": "dp", "差分约束": "shortest paths", "向量": "geometry",
    "叉积": "geometry", "平衡树": "ordered set", "树套树": "data structures",
    "可持久化线段树": "segment tree", "分块": "sqrt decomposition",
    "逆元": "modular arithmetic", "深度优先搜索 DFS": "dfs", "康托展开": "combinatorics",
    "分数规划": "binary search", "决策单调性": "dp", "生成树": "spanning tree",
    "群论": "math", "置换": "combinatorics", "矩阵乘法": "matrices",
    "线性递推": "dp", "Ad-hoc": "constructive", "扫描线": "sweep line",
    "线性数据结构": "data structures", "均摊分析": "greedy", "优先队列": "heap",
    "O2优化": "implementation", "bitset": "bitmasks", "二分图": "graphs",
    "图论建模": "graphs", "最小割": "flows", "Stirling 数": "combinatorics",
    "搜索": "dfs", "剪枝": "backtracking", "线性 DP": "dp", "构造": "constructive",
    "线性筛法": "number theory", "字典树 Trie": "trie", "素数判断": "number theory",
    "拓扑排序": "topological sort", "Tarjan": "graphs", "cdq 分治": "divide and conquer",
    "凸包": "geometry", "树形 DP": "dp", "动态规划优化": "dp",
    "循环结构": "implementation", "多项式": "fft", "极角排序": "geometry",
    "字符串（入门）": "strings", "根号分治": "sqrt decomposition",
    "离散化": "sorting", "分支结构": "implementation", "莫比乌斯反演": "number theory",
}


def to_canonical(raw_tags: list[str]) -> list[str]:
    out = []
    for t in raw_tags:
        c = CANONICAL_MAP.get(t.strip().lower(), t.strip().title())
        if c and c not in out:
            out.append(c)
    return out


def gemini_tag(title: str, snippet: str) -> list[str]:
    """Optional owner-only Gemini Flash tagger used only inside GitHub Actions when GEMINI_API_KEY secret is set."""
    if not GEMINI_KEY or not snippet:
        return []
    prompt = (
        f"Classify this competitive programming problem into 2-4 standard tags from: "
        f"Array, Math, String, Hash Table, Dynamic Programming, Greedy, Sorting, Binary Search, "
        f"Prefix Sum, Bit Manipulation, Two Pointers, Sliding Window, Segment Tree, Tree, Graph Theory, "
        f"Shortest Path, DFS, BFS, Union-Find, Combinatorics, Number Theory, Stack, Heap, Trie, Simulation, Design.\n"
        f"Title: {title}\nStatement: {snippet[:900]}\nReturn ONLY a comma-separated list of tags."
    )
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}"
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
    try:
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        res = json.loads(urllib.request.urlopen(req, timeout=20).read().decode("utf-8"))
        text = res["candidates"][0]["content"]["parts"][0]["text"]
        return [x.strip() for x in text.split(",") if x.strip()][:4]
    except Exception:
        return []


def heuristic_tag(title: str, text: str) -> list[str]:
    blob = (title + " " + re.sub(r"<[^>]+>", " ", text or "")).lower()
    tags = []
    rules = [
        ("tree", "Tree"), ("binary tree", "Tree"), ("subtree", "Tree"),
        ("graph", "Graph Theory"), ("edges", "Graph Theory"), ("shortest", "Shortest Path"),
        ("subarray", "Array"), ("array", "Array"), ("nums", "Array"),
        ("substring", "String"), ("string", "String"), ("palindrome", "String"),
        ("modulo 10", "Dynamic Programming"), ("minimum cost", "Dynamic Programming"), ("maximum score", "Dynamic Programming"),
        ("bitwise", "Bit Manipulation"), ("xor", "Bit Manipulation"),
        ("prime", "Number Theory"), ("gcd", "Number Theory"), ("divisible", "Number Theory"),
        ("grid", "Matrix"), ("matrix", "Matrix"),
        ("binary search", "Binary Search"), ("interval", "Sorting"),
    ]
    for kw, tg in rules:
        if kw in blob and tg not in tags:
            tags.append(tg)
    return tags[:3] or ["Implementation"]


def normalize_cf_slot(idx: str) -> str:
    m = re.match(r"^([A-Z])", idx)
    return m.group(1) if m else idx


def sync_all(public_only: bool = False, owner_out: Path | None = None):
    print("Syncing 1-year Codeforces...")
    cf_contests = get_json("https://codeforces.com/api/contest.list?gym=false")["result"]
    cf_ps = get_json("https://codeforces.com/api/problemset.problems")["result"]["problems"]
    by_cid = defaultdict(list)
    for p in cf_ps:
        by_cid[p["contestId"]].append(p)

    cf_out = []
    for c in cf_contests:
        if c.get("phase") != "FINISHED" or not (ONE_YR <= c.get("startTimeSeconds", 0) <= NOW):
            continue
        name = c["name"]
        div = None
        if "Div. 4" in name: div = "Div. 4"
        elif "Div. 3" in name: div = "Div. 3"
        elif "Div. 1 + Div. 2" in name: div = "Div. 1 + Div. 2"
        elif "Div. 2" in name: div = "Div. 2"
        if not div:
            continue
        qs = []
        for p in sorted(by_cid.get(c["id"], []), key=lambda x: x["index"]):
            raw = p.get("tags") or ["implementation"]
            qs.append({
                "slot": normalize_cf_slot(p["index"]),
                "raw_index": p["index"],
                "id": f"{c['id']}{p['index']}",
                "title": p["name"],
                "difficulty": f"CF {p['rating']}" if p.get("rating") else "Unrated",
                "rating": p.get("rating"),
                "tags": to_canonical(raw),
                "raw_tags": raw,
                "src": 1,
            })
        cf_out.append({
            "platform": "Codeforces",
            "tier": div,
            "id": str(c["id"]),
            "title": name,
            "startTime": c["startTimeSeconds"],
            "questions": qs,
        })

    print("Syncing 1-year LeetCode...")
    all_lc = []
    for page in range(1, 20):
        res = lc_gql(f"query {{ pastContests(pageNo: {page}, numPerPage: 10) {{ data {{ title titleSlug startTime questions {{ title titleSlug }} }} }} }}")
        batch = res["data"]["pastContests"]["data"]
        if not batch:
            break
        all_lc.extend(batch)
        if batch[-1]["startTime"] < ONE_YR:
            break
    lc_1yr = [c for c in all_lc if ONE_YR <= c["startTime"] <= NOW]
    slugs = [q["titleSlug"] for c in lc_1yr for q in c["questions"]]
    q_map = {}
    for i in range(0, len(slugs), 30):
        chunk = slugs[i:i+30]
        parts = [f'q{j}: question(titleSlug: "{s}") {{ questionFrontendId title difficulty topicTags {{ name }} }}' for j, s in enumerate(chunk)]
        res = lc_gql("query { " + " ".join(parts) + " }")["data"]
        for j, s in enumerate(chunk):
            q_map[s] = res[f"q{j}"]

    missing_slugs = [s for s, info in q_map.items() if not info.get("topicTags")]
    for i in range(0, len(missing_slugs), 15):
        chunk = missing_slugs[i:i+15]
        parts = [f'q{j}: question(titleSlug: "{s}") {{ content }}' for j, s in enumerate(chunk)]
        res = lc_gql("query { " + " ".join(parts) + " }")["data"]
        for j, s in enumerate(chunk):
            q_map[s]["content"] = res[f"q{j}"].get("content", "")

    try:
        zt = get_json("https://zerotrac.github.io/leetcode_problem_rating/data.json")
        zt_map = {x["TitleSlug"]: round(x["Rating"]) for x in zt}
    except Exception:
        zt_map = {}

    lc_out = []
    for c in sorted(lc_1yr, key=lambda x: x["startTime"]):
        ctype = "Biweekly" if c["titleSlug"].startswith("biweekly") else "Weekly"
        qs = []
        for idx, q in enumerate(c["questions"], 1):
            info = q_map[q["titleSlug"]]
            raw = [t["name"] for t in info.get("topicTags", [])]
            src = 1
            if not raw:
                raw = gemini_tag(info["title"], info.get("content", "")) or heuristic_tag(info["title"], info.get("content", ""))
                src = 0
            qs.append({
                "slot": f"Q{idx}",
                "raw_index": f"Q{idx}",
                "id": q["titleSlug"],
                "title": info["title"],
                "difficulty": info["difficulty"],
                "rating": zt_map.get(q["titleSlug"]),
                "tags": to_canonical(raw),
                "raw_tags": raw,
                "src": src,
            })
        lc_out.append({
            "platform": "LeetCode",
            "tier": ctype,
            "id": c["titleSlug"],
            "title": c["title"],
            "startTime": c["startTime"],
            "questions": qs,
        })

    print("Syncing 1-year AtCoder ABC...")
    ac_contests = get_json("https://kenkoooo.com/atcoder/resources/contests.json")
    ac_cp = get_json("https://kenkoooo.com/atcoder/resources/contest-problem.json")
    ac_probs = {p["id"]: p for p in get_json("https://kenkoooo.com/atcoder/resources/problems.json")}
    ac_models = get_json("https://kenkoooo.com/atcoder/resources/problem-models.json")
    abcs = sorted([c for c in ac_contests if c["id"].startswith("abc") and ONE_YR <= c["start_epoch_second"] <= NOW], key=lambda x: x["start_epoch_second"])
    abc_ids = {c["id"] for c in abcs}

    ac_ai_tags = {}
    try:
        items = get_json("https://atcoder-tagged-backend.onrender.com/problems/all")["message"]["items"]
        for r in items:
            if r.get("tags"):
                ac_ai_tags[r["id"]] = [t.strip() for t in r["tags"].split(",") if t.strip()]
    except Exception:
        pass

    # Luogu tags for newest ABCs
    lg_tags = {}
    try:
        tjson = get_json("https://www.luogu.com.cn/_lfe/tags")
        tdict = {t["id"]: t["name"] for t in tjson["tags"]}
        for c in abcs:
            cid = c["id"]
            if all(f"{cid}_{idx.lower()}" in ac_ai_tags for idx in "abcdefg"):
                continue
            html = get_text(f"https://www.luogu.com.cn/problem/list?type=AT&keyword={cid}")
            m = re.search(r'<script id="lentille-context" type="application/json">(.*?)</script>', html, re.S)
            if m:
                d = json.loads(m.group(1))
                for p in d.get("data", {}).get("problems", {}).get("result", []):
                    pid = p.get("pid", "")
                    if pid.startswith(f"AT_{cid}_") and p.get("tags"):
                        lg_tags[pid[3:]] = [ZH_TO_EN.get(tdict.get(tid, ""), tdict.get(tid, "")) for tid in p["tags"]]
            time.sleep(0.1)
    except Exception:
        pass

    def ac_tier(d):
        if d is None: return "Unknown"
        if d < 400: return "Gray (<400)"
        if d < 800: return "Brown (400-799)"
        if d < 1200: return "Green (800-1199)"
        if d < 1600: return "Cyan (1200-1599)"
        if d < 2000: return "Blue (1600-1999)"
        if d < 2400: return "Yellow (2000-2399)"
        return "Orange+ (2400+)"

    cp_by_cid = defaultdict(list)
    for x in ac_cp:
        if x["contest_id"] in abc_ids:
            cp_by_cid[x["contest_id"]].append(x)

    ac_out = []
    for c in abcs:
        cid = c["id"]
        qs = []
        for x in sorted(cp_by_cid.get(cid, []), key=lambda r: r["problem_index"]):
            pid = x["problem_id"]
            pinfo = ac_probs.get(pid, {})
            diff = ac_models.get(pid, {}).get("difficulty")
            raw = ac_ai_tags.get(pid) or lg_tags.get(pid) or heuristic_tag(pinfo.get("name", pid), "")
            src = 2 if (pid in ac_ai_tags or pid in lg_tags) else 0
            qs.append({
                "slot": x["problem_index"],
                "raw_index": x["problem_index"],
                "id": pid,
                "title": pinfo.get("name", pid),
                "difficulty": ac_tier(diff),
                "rating": diff,
                "tags": to_canonical(raw),
                "raw_tags": raw,
                "src": src,
            })
        ac_out.append({
            "platform": "AtCoder",
            "tier": "ABC",
            "id": cid,
            "title": c.get("title", cid.upper()),
            "startTime": c["start_epoch_second"],
            "questions": qs,
        })

    all_contests = lc_out + sorted(cf_out, key=lambda x: x["startTime"]) + ac_out
    all_tags = [t for t, _ in Counter(tg for c in all_contests for q in c["questions"] for tg in q["tags"]).most_common()]
    tidx = {t: i for i, t in enumerate(all_tags)}

    compact_contests = [
        [
            c["platform"], c["tier"], c["id"], c["title"], c["startTime"],
            [
                [q["slot"], q["raw_index"], q["title"], q["difficulty"], q["rating"], [tidx[t] for t in q["tags"]], q["id"], q["src"]]
                for q in c["questions"]
            ],
        ]
        for c in all_contests
    ]
    with open(PUBLIC_DATA / "contests_1yr.json", "w", encoding="utf-8") as f:
        json.dump({"updatedAt": int(NOW), "tags": all_tags, "contests": compact_contests}, f, separators=(",", ":"), ensure_ascii=False)
    print(f"Saved contests_1yr.json: {len(all_contests)} contests")

    # Sync LeetCode POTD (today + current month)
    print("Syncing LeetCode POTD...")
    today_res = lc_gql("""
    query {
      activeDailyCodingChallengeQuestion {
        date
        link
        question {
          questionFrontendId
          title
          titleSlug
          difficulty
          topicTags { name }
        }
      }
    }
    """)
    today_q = today_res["data"]["activeDailyCodingChallengeQuestion"]
    import datetime
    dt_now = datetime.datetime.now(datetime.timezone.utc)
    month_res = lc_gql("""
    query($year: Int!, $month: Int!) {
      dailyCodingChallengeV2(year: $year, month: $month) {
        challenges {
          date
          link
          question {
            questionFrontendId
            title
            titleSlug
            difficulty
            topicTags { name }
          }
        }
      }
    }
    """, {"year": dt_now.year, "month": dt_now.month})
    recent_potds = (month_res.get("data", {}).get("dailyCodingChallengeV2") or {}).get("challenges") or [today_q]

    def fmt_potd(item):
        q = item["question"]
        raw = [t["name"] for t in q.get("topicTags", [])]
        return {
            "date": item["date"],
            "id": q["questionFrontendId"],
            "title": q["title"],
            "slug": q["titleSlug"],
            "url": f"https://leetcode.com/problems/{q['titleSlug']}/",
            "difficulty": q["difficulty"],
            "rawTags": raw,
            "tags": to_canonical(raw),
        }

    with open(PUBLIC_DATA / "potd.json", "w", encoding="utf-8") as f:
        json.dump({
            "updatedAt": int(NOW),
            "today": fmt_potd(today_q),
            "recent": [fmt_potd(x) for x in reversed(recent_potds)],
        }, f, indent=2, ensure_ascii=False)

    if public_only or not (OWNER_LC and OWNER_CF and OWNER_AC):
        print("Public dataset + POTD sync complete (owner snapshot skipped).")
        return

    # Sync Owner Snapshot (LC + CF + AC) strictly to a private/local output path
    print(f"Syncing private owner snapshot...")
    lc_user = lc_gql("""
    query($username: String!) {
      matchedUser(username: $username) {
        username
        submitStats: submitStatsGlobal { acSubmissionNum { difficulty count submissions } }
        tagProblemCounts {
          advanced { tagName problemsSolved }
          intermediate { tagName problemsSolved }
          fundamental { tagName problemsSolved }
        }
        userCalendar { submissionCalendar }
      }
      userContestRanking(username: $username) { attendedContestsCount rating globalRanking topPercentage }
      userContestRankingHistory(username: $username) {
        attended problemsSolved totalProblems rating ranking contest { title titleSlug startTime }
      }
      recentAcSubmissionList(username: $username, limit: 25) { title titleSlug timestamp }
    }
    """, {"username": OWNER_LC})["data"]

    cf_user_info = get_json(f"https://codeforces.com/api/user.info?handles={OWNER_CF}")["result"][0]
    cf_user_rating = get_json(f"https://codeforces.com/api/user.rating?handle={OWNER_CF}")["result"]
    cf_user_status = get_json(f"https://codeforces.com/api/user.status?handle={OWNER_CF}")["result"]

    # Build owner LC recent attended contests with missed Q3/Q4
    lc_1yr_map = {c["id"]: c for c in lc_out}
    attended = [h for h in (lc_user.get("userContestRankingHistory") or []) if h.get("attended")]
    lc_missed = []
    for h in attended:
        slug = h["contest"]["titleSlug"]
        if slug in lc_1yr_map:
            c = lc_1yr_map[slug]
            solved_n = h["problemsSolved"]
            for idx, q in enumerate(c["questions"], 1):
                if idx > solved_n:
                    lc_missed.append({
                        "platform": "LeetCode",
                        "contestTitle": c["title"],
                        "slot": q["slot"],
                        "id": q["id"],
                        "title": q["title"],
                        "url": f"https://leetcode.com/problems/{q['id']}/",
                        "difficulty": q["difficulty"],
                        "rating": q["rating"],
                        "tags": q["tags"],
                        "reason": f"Missed in {c['title']} ({solved_n}/4 solved)",
                        "ts": c["startTime"],
                    })

    lc_tag_counts = {}
    tpc = (lc_user.get("matchedUser") or {}).get("tagProblemCounts") or {}
    for grp in ("fundamental", "intermediate", "advanced"):
        for item in tpc.get(grp) or []:
            lc_tag_counts[item["tagName"]] = item["problemsSolved"]

    ac_rating_history = []
    try:
        ac_raw_hist = get_json(f"https://atcoder.jp/users/{OWNER_AC}/history/json")
        for r in ac_raw_hist:
            end_str = r.get("EndTime") or r.get("StartTime") or ""
            ts_val = 0
            if end_str:
                ts_val = int(datetime.datetime.fromisoformat(end_str).timestamp())
            ac_rating_history.append({
                "isRated": bool(r.get("IsRated")),
                "place": r.get("Place", 0),
                "oldRating": r.get("OldRating", 0),
                "newRating": r.get("NewRating", 0),
                "performance": r.get("Performance", 0),
                "contestName": r.get("ContestNameEn") or r.get("ContestName") or "",
                "contestScreenName": r.get("ContestScreenName") or "",
                "ts": ts_val,
            })
    except Exception:
        ac_rating_history = []

    owner_snapshot = {
        "updatedAt": int(NOW),
        "handles": {"leetcode": OWNER_LC, "codeforces": OWNER_CF, "atcoder": OWNER_AC},
        "leetcode": {
            "ranking": lc_user.get("userContestRanking"),
            "acStats": ((lc_user.get("matchedUser") or {}).get("submitStats") or {}).get("acSubmissionNum", []),
            "tagCounts": lc_tag_counts,
            "contestHistory": [
                {
                    "title": h["contest"]["title"],
                    "slug": h["contest"]["titleSlug"],
                    "startTime": h["contest"]["startTime"],
                    "rating": round(h["rating"], 1),
                    "ranking": h["ranking"],
                    "solved": h["problemsSolved"],
                    "total": h["totalProblems"],
                }
                for h in attended
            ],
            "missedContestQuestions": lc_missed,
            "recentAc": lc_user.get("recentAcSubmissionList") or [],
        },
        "codeforces": {
            "info": {
                "handle": cf_user_info.get("handle"),
                "rating": cf_user_info.get("rating"),
                "maxRating": cf_user_info.get("maxRating"),
                "rank": cf_user_info.get("rank"),
                "maxRank": cf_user_info.get("maxRank"),
            },
            "ratingHistory": cf_user_rating,
            "submissions": cf_user_status,
        },
        "atcoder": {
            "ratingHistory": ac_rating_history,
        },
    }
    target_owner_path = owner_out or (ROOT / ".local" / "owner_snapshot.json")
    target_owner_path.parent.mkdir(parents=True, exist_ok=True)
    with open(target_owner_path, "w", encoding="utf-8") as f:
        json.dump(owner_snapshot, f, separators=(",", ":"), ensure_ascii=False)
    print(f"Sync complete! Private owner snapshot saved to {target_owner_path}")

    # ── Push compact snapshot to Firestore (GitHub Actions path) ──────────────
    # Requires FIREBASE_SERVICE_ACCOUNT (JSON text) and OWNER_UID in environment.
    # CF submissions are stripped to keep the Firestore doc well under 1 MB.
    _push_snapshot_to_firestore(owner_snapshot)


def _push_snapshot_to_firestore(owner_snapshot: dict) -> None:
    """Write a compact version of *owner_snapshot* to Firestore via Admin SDK.

    Activated only when both FIREBASE_SERVICE_ACCOUNT and OWNER_UID are set.
    Safe to call in any environment – silently skips when credentials are absent.
    """
    svc_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "").strip()
    owner_uid = os.environ.get("OWNER_UID", "").strip()
    if not svc_json or not owner_uid:
        return  # local run or public-only CI — skip silently

    try:
        import firebase_admin  # type: ignore
        from firebase_admin import credentials, firestore as admin_fs  # type: ignore
    except ImportError:
        print("WARNING: firebase-admin not installed – skipping Firestore push. "
              "Add firebase-admin to requirements.txt or run: pip install firebase-admin")
        return

    # Build the compact snapshot: strip raw CF submissions (huge), keep LC + AC
    compact: dict = {
        "updatedAt": owner_snapshot["updatedAt"],
        "handles": owner_snapshot.get("handles", {}),
        "leetcode": owner_snapshot.get("leetcode", {}),
        "codeforces": {
            "info": (owner_snapshot.get("codeforces") or {}).get("info", {}),
            "ratingHistory": (owner_snapshot.get("codeforces") or {}).get("ratingHistory", []),
            "submissions": [],  # omitted — fetched live from CF API in the browser
        },
        "atcoder": owner_snapshot.get("atcoder", {}),
    }

    # Initialise the Admin SDK (guard: may already be initialised in tests)
    try:
        app = firebase_admin.get_app()
    except ValueError:
        cred = credentials.Certificate(json.loads(svc_json))
        app = firebase_admin.initialize_app(cred)

    db = admin_fs.client(app)
    snap_ref = db.collection("cp_pulse_users").document(owner_uid) \
                  .collection("private").document("snapshot")
    snap_ref.set(compact)
    print(f"✓ Owner snapshot pushed to Firestore (uid={owner_uid[:8]}…)")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--public-only", action="store_true", help="Refresh only public contests and POTD JSONs.")
    parser.add_argument("--owner-out", type=Path, default=None, help="Private output path for owner_snapshot.json (defaults to .local/owner_snapshot.json).")
    args = parser.parse_args()
    sync_all(public_only=args.public_only, owner_out=args.owner_out)
