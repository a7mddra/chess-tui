// =============================================================================
// GitHub
// =============================================================================

const GITHUB_BASE = (sub: string = "github") =>
  `https://${sub}.com/a7mddra/chess-tui`;

export const github = {
  repo: GITHUB_BASE(),
  latestRelease: `${GITHUB_BASE()}/releases/latest`,
  rawChangelog: `${GITHUB_BASE("raw.githubusercontent")}/main/CHANGELOG.md`,
  issues: {
    base: `${GITHUB_BASE()}/issues`,
    new: (template: string = "bug_report.md") =>
      `${GITHUB_BASE()}/issues/new?template=${template}`,
  },
  license: `${GITHUB_BASE()}/blob/main/LICENSE`,
  docs: (path: string = "") => `${GITHUB_BASE()}/blob/main/docs/${path}`,
  blob: (branch: string, path: string) =>
    `${GITHUB_BASE()}/blob/${branch}/${path}`,
};

// =============================================================================
// Chess.com
// =============================================================================

const CHESSCOM_BASE = (sub: string) => `https://chess.com/${sub}`;

export const chesscom = {
  base: CHESSCOM_BASE("home"),
  play: CHESSCOM_BASE("play/online/new"),
  game: (id: string) => CHESSCOM_BASE(`game/live/${id}`),
  analyze: (id: string) => CHESSCOM_BASE(`game/live/${id}/review`),
  member: (username: string) => CHESSCOM_BASE(`member/${username}`),
};
