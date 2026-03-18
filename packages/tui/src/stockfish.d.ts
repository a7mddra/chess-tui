declare module "stockfish" {
  const createStockfish: () => {
    onmessage: ((event: { data?: unknown } | unknown) => void) | null;
    postMessage: (command: string) => void;
    terminate?: () => void;
  };

  export default createStockfish;
}
