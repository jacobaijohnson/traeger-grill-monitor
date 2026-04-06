import { getLoginUrl } from "@/const";
import { authClient, useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = getLoginUrl() } =
    options ?? {};

  const { data: session, isPending, error, refetch } = useSession();
  const utils = trpc.useUtils();

  const logout = useCallback(async () => {
    try {
      // Sign out via Better Auth client (clears session cookie)
      await authClient.signOut();
    } catch (error: unknown) {
      console.warn("[Auth] Sign-out error:", error);
    } finally {
      // Also invalidate tRPC auth cache
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
      // Redirect to login
      window.location.href = getLoginUrl();
    }
  }, [utils]);

  const user = useMemo(() => {
    if (!session?.user) return null;
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
      role: (session.user as any).role ?? "user",
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    };
  }, [session]);

  const state = useMemo(() => {
    return {
      user,
      loading: isPending,
      error: error ?? null,
      isAuthenticated: Boolean(user),
    };
  }, [user, isPending, error]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (isPending) return;
    if (user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === "/login") return;
    if (window.location.pathname === "/register") return;

    window.location.href = redirectPath;
  }, [redirectOnUnauthenticated, redirectPath, isPending, user]);

  return {
    ...state,
    refresh: () => refetch(),
    logout,
  };
}
