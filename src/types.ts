export type Platform = "LeetCode" | "Codeforces" | "AtCoder";

export interface ContestQuestion {
  platform: Platform;
  tier: string;
  contestId: string;
  contestTitle: string;
  startTime: number;
  dateStr: string;
  slot: string;
  rawIndex: string;
  id: string;
  title: string;
  difficulty: string;
  rating: number | null;
  tags: string[];
  url: string;
  src: number; // 1=official, 2=community/AI, 0=inferred
}

export interface ContestRecord {
  platform: Platform;
  tier: string;
  id: string;
  title: string;
  startTime: number;
  dateStr: string;
  questions: ContestQuestion[];
}

export interface PotdQuestion {
  date: string;
  id: string;
  title: string;
  slug: string;
  url: string;
  difficulty: string;
  rawTags: string[];
  tags: string[];
}

export interface PotdPayload {
  updatedAt: number;
  today: PotdQuestion;
  recent: PotdQuestion[];
}

export interface CfSubmission {
  id: number;
  contestId?: number;
  creationTimeSeconds: number;
  verdict?: string;
  author: { participantType?: string };
  problem: {
    contestId?: number;
    index: string;
    name: string;
    rating?: number;
    tags: string[];
  };
}

export interface CfRatingPoint {
  contestId: number;
  contestName: string;
  rank: number;
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
}

export interface AcSubmission {
  id: number;
  epoch_second: number;
  problem_id: string;
  contest_id: string;
  result: string;
}

export interface AcRatingPoint {
  isRated: boolean;
  place: number;
  oldRating: number;
  newRating: number;
  performance: number;
  contestName: string;
  contestScreenName?: string;
  ts: number;
}

export interface OwnerSnapshot {
  updatedAt: number;
  handles: { leetcode: string; codeforces: string; atcoder: string };
  leetcode: {
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
    missedContestQuestions: {
      platform: "LeetCode";
      contestTitle: string;
      slot: string;
      id: string;
      title: string;
      url: string;
      difficulty: string;
      rating: number | null;
      tags: string[];
      reason: string;
      ts: number;
    }[];
    recentAc: { title: string; titleSlug: string; timestamp: string }[];
  };
  codeforces: {
    info: {
      handle: string;
      rating?: number;
      maxRating?: number;
      rank?: string;
      maxRank?: string;
    };
    ratingHistory: CfRatingPoint[];
    submissions: CfSubmission[];
  };
  atcoder?: {
    ratingHistory: AcRatingPoint[];
  };
}

export type ProblemStatus = "todo" | "done" | "revisit";

export interface ProblemProgress {
  key: string; // e.g. "cf:2051D" or "lc:count-good-strings" or "ac:abc406_c"
  status: ProblemStatus;
  note: string;
  updatedAt: number;
  title?: string;
  platform?: Platform;
  url?: string;
}

export interface TagAuditRow {
  tag: string;
  ok: number;
  fail: number;
  acRate: number;
  medRating: number | null;
  maxRating: number | null;
  verdict: "Strong" | "Capped" | "Gap" | "Untouched";
}

export interface UpsolveItem {
  key: string;
  platform: Platform;
  slot: string;
  title: string;
  url: string;
  ratingLabel: string;
  numericRating: number | null;
  tags: string[];
  reason: string;
  priorityScore: number;
  bucket: "attempted_unsolved" | "missed_contest" | "potd_match" | "potd_recent" | "weak_pillar";
  ts: number;
}
