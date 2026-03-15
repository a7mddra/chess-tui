import type { Command } from "../config/commands";

// ---------------------------------------------------------------------------
// Fuzzy command search — scores every command against a user query and
// returns matches sorted by relevance. All tokens in the query must match
// (AND logic); a command is excluded if any single token fails.
// ---------------------------------------------------------------------------

const SCORE_EXACT = 10;
const SCORE_PREFIX = 5;
const SCORE_SUBSTRING = 2;

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
    // Build the full searchable text from id + label + keywords
    const words = [
      command.id,
      ...command.label.toLowerCase().split(/\s+/),
      ...(command.keywords ?? []).map((k) => k.toLowerCase()),
    ];
    const full = words.join(" ");

    let totalScore = 0;
    let allMatched = true;

    for (const token of tokens) {
      let best = 0;

      // Check each word for the best match type
      for (const word of words) {
        if (word === token) {
          best = Math.max(best, SCORE_EXACT);
        } else if (word.startsWith(token)) {
          best = Math.max(best, SCORE_PREFIX);
        }
      }

      // Fallback: substring anywhere in full text
      if (best === 0 && full.includes(token)) {
        best = SCORE_SUBSTRING;
      }

      if (best === 0) {
        allMatched = false;
        break;
      }

      totalScore += best;
    }

    if (allMatched) {
      scored.push({ command, score: totalScore });
    }
  }

  // Sort by score descending, then by label alphabetically for ties
  scored.sort(
    (a, b) =>
      b.score - a.score || a.command.label.localeCompare(b.command.label),
  );

  return scored.map((s) => s.command);
};
