// Copyright 2026 a7mddra
// SPDX-License-Identifier: MIT

import React, { createContext, useCallback, useContext, useState } from "react";
import { WelcomeScreen, GameScreen } from "@/index";

export type Route = "welcome" | "chesscom" | "stockfish";
export type GameMode = "chesscom" | "stockfish";

type RouterContextValue = {
  route: Route;
  navigate: (to: Route) => void;
};

const RouterContext = createContext<RouterContextValue | null>(null);

export const useRouter = (): RouterContextValue => {
  const ctx = useContext(RouterContext);
  if (!ctx) {
    throw new Error("useRouter must be used within <AppRouter />");
  }
  return ctx;
};

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
