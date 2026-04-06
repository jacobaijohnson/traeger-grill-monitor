/**
 * Better Auth server configuration.
 *
 * Self-hosted email/password auth with admin plugin.
 * Uses MySQL database via mysql2 adapter.
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
    // Add the configured URL and strip trailing slash
    const clean = betterAuthUrl.replace(/\/+$/, "");
    if (!origins.includes(clean)) {
      origins.push(clean);
    }
  }

  return origins;
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || undefined,
  database: createAuthPool(),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url, token }, request) => {
      // If SMTP is configured, send a real email
      const smtpHost = process.env.SMTP_HOST;
      if (smtpHost) {
        try {
          const nodemailer = await import("nodemailer");
          const transport = nodemailer.default.createTransport({
            host: smtpHost,
            port: parseInt(process.env.SMTP_PORT || "587", 10),
            secure: process.env.SMTP_SECURE === "true",
            auth: process.env.SMTP_USER ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS || "",
            } : undefined,
          });
          const appName = process.env.APP_NAME || "Traeger Smoker Insight";
          void transport.sendMail({
            from: process.env.SMTP_FROM || `"${appName}" <noreply@localhost>`,
            to: user.email,
            subject: `${appName} — Password Reset`,
            text: `You requested a password reset. Click the link below to reset your password:\n\n${url}\n\nIf you didn't request this, you can safely ignore this email.`,
            html: `<p>You requested a password reset. Click the link below to reset your password:</p><p><a href="${url}">Reset Password</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
          });
          console.log(`[Auth] Password reset email sent to ${user.email}`);
        } catch (err) {
          console.error("[Auth] Failed to send reset email:", err);
        }
      } else {
        // No SMTP configured — log the reset URL for admin to share manually
        console.log(`[Auth] Password reset requested for ${user.email}`);
        console.log(`[Auth] Reset URL (no SMTP configured): ${url}`);
        console.log(`[Auth] Token: ${token}`);
      }
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
  plugins: [
    admin(),
  ],
});

export type BetterAuthSession = typeof auth.$Infer.Session;
