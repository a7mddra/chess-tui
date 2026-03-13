import React, { createContext, useCallback, useContext, useState } from "react";
import { WelcomeScreen, GameScreen } from "@/index";

// ---------------------------------------------------------------------------
// Route types
// ---------------------------------------------------------------------------

export type Route = "welcome" | "chesscom" | "stockfish";
export type GameMode = "chesscom" | "stockfish";

type RouterContextValue = {
  route: Route;
  navigate: (to: Route) => void;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const RouterContext = createContext<RouterContextValue | null>(null);

export const useRouter = (): RouterContextValue => {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error("useRouter must be used within <AppRouter />");
  }
  return ctx;
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const AppRouter = (): React.JSX.Element => {
  const [route, setRoute] = useState<Route>("welcome");

  const navigate = useCallback((to: Route) => {
    setRoute(to);
  }, []);

  const screen = (() => {
    switch (route) {
      case "chesscom":
        return <GameScreen mode="chesscom" />;
      case "stockfish":
        return <GameScreen mode="stockfish" />;
      case "welcome":
      default:
        return <WelcomeScreen />;
    }
  })();

  return <RouterContext value={{ route, navigate }}>{screen}</RouterContext>;
};
