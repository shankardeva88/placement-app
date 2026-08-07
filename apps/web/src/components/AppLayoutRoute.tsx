import type { ReactNode } from "react";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppShell } from "./AppShell";

export function AppLayoutRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}
