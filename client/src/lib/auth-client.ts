/**
 * Better Auth React client.
 *
 * Provides signIn, signUp, signOut, useSession hooks.
 * Since the auth server runs on the same origin (/api/auth/*),
 * no baseURL is needed.
 */
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [adminClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
