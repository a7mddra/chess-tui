// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

import { spawn } from "node:child_process";

type OpenCommand = {
  command: string;
  args: string[];
};

const getOpenCommand = (url: string): OpenCommand => {
  if (process.platform === "win32") {
    return {
      command: "cmd",
      args: ["/c", "start", "", url],
    };
  }

  if (process.platform === "darwin") {
    return {
      command: "open",
      args: [url],
    };
  }

  return {
    command: "xdg-open",
    args: [url],
  };
};

export const openExternalUrl = async (url: string): Promise<void> => {
  const { command, args } = getOpenCommand(url);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
};
