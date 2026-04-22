import { useMemo } from "react";

export function useAuth() {
  return useMemo(
    () => ({
      user: { email: "demo@local" },
      session: { user: { email: "demo@local" } },
      loading: false,
      signOut: async () => {},
    }),
    []
  );
}