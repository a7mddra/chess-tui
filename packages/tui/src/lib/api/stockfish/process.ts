import { cpus } from "node:os";
import { createRequire } from "node:module";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, join } from "node:path";
import { readdirSync } from "node:fs";
import { parseUciLine } from "./uci";
import type {
  EngineAnalyzeRequest,
  EngineAnalyzeResult,
  EngineConnectionState,
  ParsedUciLine,
} from "./types";

type LineWaiter = {
  predicate: (line: ParsedUciLine) => boolean;
  resolve: (line: ParsedUciLine) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

const DEFAULT_MOVE_TIME_MS = 280;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_HASH_MB = 64;
const require = createRequire(import.meta.url);

const resolveStockfishCli = (): { command: string; args: string[] } => {
  const packageJsonPath = require.resolve("stockfish/package.json");
  const packageRoot = dirname(packageJsonPath);
  const srcDir = join(packageRoot, "src");

  const files = readdirSync(srcDir);
  const pick = (pattern: RegExp): string | null => {
    const hit = files.find((file) => pattern.test(file));
    return hit ?? null;
  };

  const preferred =
    pick(/^stockfish-\d+\.\d+-lite-single-.*\.js$/) ??
    pick(/^stockfish-\d+\.\d+-single-.*\.js$/) ??
    pick(/^stockfish-\d+\.\d+-lite-.*\.js$/) ??
    pick(/^stockfish-\d+\.\d+-.*\.js$/) ??
    pick(/^stockfish-\d+\.\d+-asm-.*\.js$/);

  if (!preferred) {
    throw new Error(`No stockfish engine bundle found in ${srcDir}`);
  }

  const enginePath = join(srcDir, preferred);
  return {
    command: process.execPath,
    args: [enginePath],
  };
};

const resolveRecommendedThreads = (): number => {
  const envValue = process.env.CHESS_TUI_ENGINE_THREADS;
  if (envValue) {
    const parsed = Number.parseInt(envValue, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const cores = cpus().length;
  if (cores <= 2) {
    return 1;
  }

  return Math.max(1, Math.min(4, cores - 1));
};

export class StockfishProcess {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private readyPromise: Promise<void> | null = null;
  private lineWaiters = new Set<LineWaiter>();
  private lineSubscribers = new Set<(line: ParsedUciLine) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private state: EngineConnectionState = "starting";
  private lastError: string | null = null;
  private stdoutBuffer = "";

  get connectionState(): EngineConnectionState {
    return this.state;
  }

  get error(): string | null {
    return this.lastError;
  }

  async start(): Promise<void> {
    await this.ensureReady();
  }

  async analyze(request: EngineAnalyzeRequest): Promise<EngineAnalyzeResult> {
    return await this.enqueue(async () => {
      await this.ensureReady();

      const moveTimeMs = Math.max(50, request.moveTimeMs ?? DEFAULT_MOVE_TIME_MS);
      const threads = request.threads ?? resolveRecommendedThreads();
      const hashMb = Math.max(16, request.hashMb ?? DEFAULT_HASH_MB);
      const analysisInfo: EngineAnalyzeResult["info"] = [];

      const unsubscribe = this.subscribe((line) => {
        if (line.type === "info") {
          analysisInfo.push(line.info);
        }
      });

      try {
        this.send(`setoption name Threads value ${threads}`);
        this.send(`setoption name Hash value ${hashMb}`);

        if (typeof request.elo === "number") {
          this.send("setoption name UCI_LimitStrength value true");
          this.send(
            `setoption name UCI_Elo value ${Math.max(100, Math.min(3000, Math.floor(request.elo)))}`,
          );
        } else {
          this.send("setoption name UCI_LimitStrength value false");
        }

        this.send("isready");
        await this.waitFor((line) => line.type === "readyok", DEFAULT_TIMEOUT_MS, "readyok timeout before analysis");

        this.send(`position fen ${request.fen}`);
        this.send(`go movetime ${moveTimeMs}`);

        const best = await this.waitFor(
          (line) => line.type === "bestmove",
          Math.max(DEFAULT_TIMEOUT_MS, moveTimeMs * 8),
          "bestmove timeout",
        );

        const latestScoredInfo = [...analysisInfo]
          .reverse()
          .find((entry) => entry.score !== undefined);

        return {
          bestMove: best.type === "bestmove" ? best.bestMove : null,
          ponder: best.type === "bestmove" ? best.ponder : undefined,
          info: analysisInfo,
          score: latestScoredInfo?.score,
        };
      } finally {
        unsubscribe();
      }
    });
  }

  stop(): void {
    for (const waiter of this.lineWaiters) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("Stockfish process stopped"));
    }
    this.lineWaiters.clear();

    if (this.proc && !this.proc.killed) {
      this.proc.stdin.write("quit\n");
      this.proc.kill();
    }

    this.proc = null;
    this.stdoutBuffer = "";
    this.readyPromise = null;
    this.state = "starting";
  }

  private async ensureReady(): Promise<void> {
    if (this.readyPromise) {
      return await this.readyPromise;
    }

    this.readyPromise = (async () => {
      this.state = "starting";
      this.lastError = null;

      const { command, args } = resolveStockfishCli();
      this.proc = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.proc.stdout.setEncoding("utf8");
      this.proc.stdout.on("data", (chunk: string) => {
        this.handleStdoutChunk(chunk);
      });

      this.proc.stderr.setEncoding("utf8");
      this.proc.stderr.on("data", (chunk: string) => {
        const text = chunk.trim();
        if (!text) {
          return;
        }
        this.lastError = text;
      });

      this.proc.on("exit", (code, signal) => {
        if (this.state !== "error") {
          this.state = "error";
        }

        const reason = `Stockfish exited (code=${code ?? "null"}, signal=${signal ?? "null"})`;
        this.lastError = reason;

        for (const waiter of this.lineWaiters) {
          clearTimeout(waiter.timer);
          waiter.reject(new Error(reason));
        }
        this.lineWaiters.clear();
      });

      this.send("uci");
      await this.waitFor((line) => line.type === "uciok", DEFAULT_TIMEOUT_MS, "uciok timeout");
      this.send("isready");
      await this.waitFor((line) => line.type === "readyok", DEFAULT_TIMEOUT_MS, "readyok timeout");

      this.state = "ready";
    })().catch((error: unknown) => {
      this.state = "error";
      this.lastError = error instanceof Error ? error.message : String(error);
      this.readyPromise = null;
      throw error;
    });

    return await this.readyPromise;
  }

  private send(command: string): void {
    if (!this.proc || this.proc.stdin.destroyed || this.proc.killed) {
      throw new Error("Stockfish child process is not running.");
    }

    this.proc.stdin.write(`${command}\n`);
  }

  private handleStdoutChunk(chunk: string): void {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      const raw = line.trim();
      if (!raw) {
        continue;
      }
      this.handleLine(raw);
    }
  }

  private handleLine(rawLine: string): void {
    const parsed = parseUciLine(rawLine);

    for (const subscriber of this.lineSubscribers) {
      subscriber(parsed);
    }

    for (const waiter of [...this.lineWaiters]) {
      if (!waiter.predicate(parsed)) {
        continue;
      }

      clearTimeout(waiter.timer);
      this.lineWaiters.delete(waiter);
      waiter.resolve(parsed);
    }
  }

  private waitFor(
    predicate: (line: ParsedUciLine) => boolean,
    timeoutMs: number,
    timeoutLabel: string,
  ): Promise<ParsedUciLine> {
    return new Promise<ParsedUciLine>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.lineWaiters.delete(waiter);
        reject(new Error(timeoutLabel));
      }, timeoutMs);

      const waiter: LineWaiter = {
        predicate,
        resolve,
        reject,
        timer,
      };

      this.lineWaiters.add(waiter);
    });
  }

  private subscribe(listener: (line: ParsedUciLine) => void): () => void {
    this.lineSubscribers.add(listener);
    return () => {
      this.lineSubscribers.delete(listener);
    };
  }

  private async enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.then(() => undefined, () => undefined);
    return await run;
  }
}

export const stockfishProcess = new StockfishProcess();
