// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

import { spawn, execSync, type ChildProcess } from "node:child_process";

type TerminalInfo = {
  command: string;
  buildArgs: (cmd: string[]) => string[];
};

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

  const envTerminal = process.env["TERMINAL"];
  if (envTerminal && commandExists(envTerminal)) {
    const known = LINUX_TERMINALS.find((t) => envTerminal.includes(t.command));
    if (known) {
      return { ...known, command: envTerminal };
    }

    return {
      command: envTerminal,
      buildArgs: (cmd) => ["-e", ...cmd],
    };
  }

  if (commandExists("xdg-terminal-exec")) {
    return {
      command: "xdg-terminal-exec",
      buildArgs: (cmd) => cmd,
    };
  }

  for (const terminal of LINUX_TERMINALS) {
    if (commandExists(terminal.command)) {
      return terminal;
    }
  }

  return null;
};

export const spawnBoardWindow = (sessionId: string): ChildProcess | null => {
  const terminal = detectTerminal();
  if (!terminal) {
    return null;
  }

  const innerCmd = [
    process.execPath,
    ...process.execArgv,
    ...process.argv.slice(1),
    "--detached-board",
    `--session-id=${sessionId}`,
  ];

  const args = terminal.buildArgs(innerCmd);

  const child = spawn(terminal.command, args, {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
  });

  child.unref();
  return child;
};
