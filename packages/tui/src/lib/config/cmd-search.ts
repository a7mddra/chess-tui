// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

import type { Command } from "./commands";

// ---------------------------------------------------------------------------
// Fuzzy command search — scores every command against a user query and
// returns matches sorted by relevance. Tokens do not need exact or full
// coverage; commands are ranked by how many tokens match and how strong the
// matches are.
// ---------------------------------------------------------------------------

const SCORE_EXACT = 10;
const SCORE_PREFIX = 5;
const SCORE_SUBSTRING = 2;
const SCORE_FUZZY_MAX = 4;
const MIN_FUZZY_SIMILARITY = 0.55;

const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }

    for (let j = 0; j <= b.length; j++) {
      prev[j] = curr[j]!;
    }
  }

  return prev[b.length]!;
};

const longestCommonSubsequenceLength = (a: string, b: string): number => {
  if (a.length === 0 || b.length === 0) return 0;

  const prev = new Array<number>(b.length + 1).fill(0);
  const curr = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1]! + 1;
      } else {
        curr[j] = Math.max(prev[j]!, curr[j - 1]!);
      }
    }

    for (let j = 0; j <= b.length; j++) {
      prev[j] = curr[j]!;
      curr[j] = 0;
    }
  }

  return prev[b.length]!;
};

const getFuzzyScore = (token: string, candidate: string): number => {
  if (token.length < 3 || candidate.length < 3) return 0;

  const editDistance = levenshteinDistance(token, candidate);
  const editSimilarity =
    1 - editDistance / Math.max(token.length, candidate.length);

  const lcsLength = longestCommonSubsequenceLength(token, candidate);
  const lcsSimilarity = lcsLength / Math.min(token.length, candidate.length);

  const similarity = Math.max(editSimilarity, lcsSimilarity);

  if (similarity < MIN_FUZZY_SIMILARITY) return 0;

  return Math.max(1, Math.round(SCORE_FUZZY_MAX * similarity));
};

/**
 * Search commands using a multi-token fuzzy strategy.
 *
 * @param query    Raw user input (may include leading `/`)
 * @param commands Pool of commands to search
 * @returns        Matching commands sorted by score (best first)
 */
export const searchCommands = (
  query: string,
  commands: Command[],
): Command[] => {
  // Strip leading "/" and normalize
  const raw = query.replace(/^\//, "").toLowerCase().trim();

  // Empty query → return all commands (no filtering)
  if (raw === "") return commands;

  const tokens = raw.split(/\s+/).filter(Boolean);

  const scored: { command: Command; score: number }[] = [];

  for (const command of commands) {
    const labelLower = command.label.toLowerCase();
    const idLower = command.id.toLowerCase();

    // Build the full searchable text from id + label + keywords
    const words = [
      idLower,
      ...labelLower.split(/\s+/),
      ...(command.keywords ?? []).map((k) => k.toLowerCase()),
    ];
    const full = words.join(" ");

    let totalScore = 0;
    let matchedTokens = 0;

    // Full query bonuses for google-level priority
    if (labelLower === raw) {
      totalScore += 100;
    } else if (labelLower.startsWith(raw)) {
      totalScore += 50;
    } else if (idLower === raw) {
      totalScore += 40;
    } else if (idLower.startsWith(raw)) {
      totalScore += 20;
    } else if (labelLower.includes(raw) || full.includes(raw)) {
      totalScore += 10;
    }

    for (const token of tokens) {
      let best = 0;

      // Check each word for the best match type
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        if (!word) continue;

        let wordScore = 0;
        if (word === token) {
          wordScore = SCORE_EXACT;
        } else if (word.startsWith(token)) {
          wordScore = SCORE_PREFIX;
        } else {
          wordScore = getFuzzyScore(token, word);
        }

        if (wordScore > 0) {
          // Positional bonus: earlier words get higher score tiebreakers
          // index 0 is ID, index 1 is first word of label
          const posBonus = Math.max(0, 20 - i) / 10;
          wordScore += posBonus;
          best = Math.max(best, wordScore);
        }
      }

      // Fallback: substring anywhere in full text
      if (best === 0 && full.includes(token)) {
        best = SCORE_SUBSTRING;
      }

      if (best === 0) {
        continue;
      }

      matchedTokens += 1;
      totalScore += best;
    }

    if (matchedTokens > 0) {
      const coverage = matchedTokens / tokens.length;
      const weightedScore = totalScore * coverage;

      scored.push({ command, score: weightedScore });
    }
  }

  // Sort by score descending, then by label alphabetically for ties
  scored.sort(
    (a, b) =>
      b.score - a.score || a.command.label.localeCompare(b.command.label),
  );

  return scored.map((s) => s.command);
};
