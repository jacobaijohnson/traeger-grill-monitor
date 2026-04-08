/**
 * Better Auth server configuration.
 *
 * Self-hosted email/password auth with admin plugin.
 * Uses MySQL database via mysql2 adapter.
 * Password reset is console-only (no SMTP) — admin shares the link manually.
 */
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import mysql from "mysql2/promise";

// Create a dedicated pool for Better Auth
function createAuthPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("[Auth] DATABASE_URL not set");
  }
  return mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 5,
    maxIdle: 3,
    idleTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
  });
}

/**
 * Build trusted origins list dynamically.
 * Always includes localhost variants for dev; adds BETTER_AUTH_URL if set.
 */
function buildTrustedOrigins(): string[] {
  const origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8420",
  ];

  const betterAuthUrl = process.env.BETTER_AUTH_URL;
  if (betterAuthUrl) {
    const clean = betterAuthUrl.replace(/\/+$/, "");
    if (!origins.includes(clean)) {
      origins.push(clean);
    }
  }

  return origins;
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || undefined,
  database: createAuthPool(),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url, token }) => {
      // Console-only password reset — no SMTP required.
      // The admin can copy this link from Docker logs and share it with the user.
      console.log("");
      console.log("╔══════════════════════════════════════════════════════════════╗");
      console.log("║                    PASSWORD RESET REQUEST                    ║");
      console.log("╠══════════════════════════════════════════════════════════════╣");
      console.log(`║  User:  ${user.email}`);
      console.log(`║  Time:  ${new Date().toISOString()}`);
      console.log("║                                                              ║");
      console.log("║  Reset URL (share with user):                                ║");
      console.log(`║  ${url}`);
      console.log("║                                                              ║");
      console.log("║  This link expires in 1 hour.                                ║");
      console.log("╚══════════════════════════════════════════════════════════════╝");
      console.log("");
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes cache
    },
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // update session age every 24 hours
  },
  trustedOrigins: buildTrustedOrigins(),
  advanced: {
    // Only use __Secure- cookie prefix when serving over HTTPS.
    // CI smoke tests run over plain HTTP, so Secure cookies won't be sent back.
    useSecureCookies: (process.env.BETTER_AUTH_URL || "").startsWith("https://"),
  },
  plugins: [
    admin(),
  ],
});

export type BetterAuthSession = typeof auth.$Infer.Session;
