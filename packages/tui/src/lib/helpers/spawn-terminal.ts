import { spawn, execSync, type ChildProcess } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TerminalInfo = {
  command: string;
  buildArgs: (cmd: string[]) => string[];
};

// ---------------------------------------------------------------------------
// Linux terminal fallback chain
// ---------------------------------------------------------------------------

const LINUX_TERMINALS: TerminalInfo[] = [
  {
    command: "kitty",
    buildArgs: (cmd) => ["--", ...cmd],
  },
  {
    command: "alacritty",
    buildArgs: (cmd) => ["-e", ...cmd],
  },
  {
    command: "wezterm",
    buildArgs: (cmd) => ["start", "--", ...cmd],
  },
  {
    command: "foot",
    buildArgs: (cmd) => ["--", ...cmd],
  },
  {
    command: "gnome-terminal",
    buildArgs: (cmd) => ["--", ...cmd],
  },
  {
    command: "konsole",
    buildArgs: (cmd) => ["-e", ...cmd],
  },
  {
    command: "xfce4-terminal",
    buildArgs: (cmd) => ["-e", cmd.join(" ")],
  },
  {
    command: "xterm",
    buildArgs: (cmd) => ["-e", ...cmd],
  },
];

// ---------------------------------------------------------------------------
// Detect available terminal
// ---------------------------------------------------------------------------

const commandExists = (cmd: string): boolean => {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const detectTerminal = (): TerminalInfo | null => {
  const platform = process.platform;

  if (platform === "darwin") {
    return {
      command: "open",
      buildArgs: (cmd) => [
        "-a",
        "Terminal.app",
        cmd[0]!,
        "--args",
        ...cmd.slice(1),
      ],
    };
  }

  if (platform === "win32") {
    if (commandExists("wt")) {
      return {
        command: "wt",
        buildArgs: (cmd) => ["--", ...cmd],
      };
    }

    return {
      command: "cmd",
      buildArgs: (cmd) => ["/c", "start", "cmd", "/c", ...cmd],
    };
  }

  // Linux —— check $TERMINAL env first
  const envTerminal = process.env["TERMINAL"];
  if (envTerminal && commandExists(envTerminal)) {
    // Try to match known terminal for proper arg format
    const known = LINUX_TERMINALS.find((t) => envTerminal.includes(t.command));
    if (known) {
      return { ...known, command: envTerminal };
    }

    // Generic fallback: most terminals accept -e
    return {
      command: envTerminal,
      buildArgs: (cmd) => ["-e", ...cmd],
    };
  }

  // Try xdg-terminal-exec (newer freedesktop proposal)
  if (commandExists("xdg-terminal-exec")) {
    return {
      command: "xdg-terminal-exec",
      buildArgs: (cmd) => cmd,
    };
  }

  // Walk the fallback chain
  for (const terminal of LINUX_TERMINALS) {
    if (commandExists(terminal.command)) {
      return terminal;
    }
  }

  return null;
};

// ---------------------------------------------------------------------------
// Spawn the current application instance in a new terminal window
// ---------------------------------------------------------------------------

export const spawnBoardWindow = (sessionId: string): ChildProcess | null => {
  const terminal = detectTerminal();
  if (!terminal) {
    return null;
  }

  // Reconstruct the exact command that launched THIS process, whether it's
  // "node main.js", "tsx src/main.tsx", or the global CLI bin.
  // We append our special CLI flag.
  const innerCmd = [
    process.execPath,
    ...process.execArgv,
    ...process.argv.slice(1),
    "--detached-board",
    `--session-id=${sessionId}`
  ];

  const args = terminal.buildArgs(innerCmd);

  const child = spawn(terminal.command, args, {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(), // Preserve the same working directory
  });

  child.unref();
  return child;
};
