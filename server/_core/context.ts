import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { auth } from "./auth";
import { fromNodeHeaders } from "better-auth/node";

/**
 * App user shape exposed to tRPC procedures.
 * Mapped from Better Auth session user + admin plugin fields.
 */
export type AppUser = {
  id: string;          // Better Auth user ID (UUID)
  name: string;
  email: string;
  image: string | null;
  role: string;        // "user" | "admin" from admin plugin
  createdAt: Date;
  updatedAt: Date;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AppUser | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: AppUser | null = null;

  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(opts.req.headers),
    });

    if (session?.user) {
      user = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
        role: (session.user as any).role ?? "user",
        createdAt: session.user.createdAt,
        updatedAt: session.user.updatedAt,
      };
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
