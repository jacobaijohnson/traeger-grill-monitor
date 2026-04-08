/**
 * Admin seed: creates the admin user on first boot from ADMIN_EMAIL + ADMIN_PASSWORD env vars.
 * Uses direct DB queries to avoid Better Auth admin API authorization issues during bootstrap.
 * If the admin already exists, this is a no-op.
 */
import { auth } from "./auth";

export async function seedAdmin(): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log("[Seed] ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping env-var seed.");
    console.log("[Seed] Admin can be created via the first-boot setup wizard at /setup");
    return;
  }

  if (adminPassword.length < 8) {
    console.error("[Seed] ADMIN_PASSWORD must be at least 8 characters.");
    return;
  }

  try {
    // Use Better Auth's internal context to create user without requiring auth headers.
    // signUpEmail on the server-side API doesn't require an authenticated session.
    const ctx = await auth.api.signUpEmail({
      body: {
        email: adminEmail,
        password: adminPassword,
        name: adminEmail.split("@")[0] || "Admin",
      },
      headers: new Headers({
        "x-seed-admin": "true",
      }),
    });

    if (ctx?.user) {
      // Promote to admin role via direct DB update (avoids admin API auth requirement)
      const mysql = await import("mysql2/promise");
      const pool = mysql.createPool({ uri: process.env.DATABASE_URL! });
      try {
        await pool.execute(
          `UPDATE user SET role = 'admin' WHERE id = ?`,
          [ctx.user.id]
        );
        console.log(`[Seed] Created admin user: ${adminEmail} (id: ${ctx.user.id})`);
      } finally {
        await pool.end();
      }
    }
  } catch (error: any) {
    const msg = error?.message || error?.body?.message || JSON.stringify(error);

    // If user already exists, just ensure they have admin role
    if (msg.includes("already") || msg.includes("exists") || error?.status === "UNPROCESSABLE_ENTITY" || error?.statusCode === 422) {
      try {
        const mysql = await import("mysql2/promise");
        const pool = mysql.createPool({ uri: process.env.DATABASE_URL! });
        try {
          const [rows] = await pool.execute(
            `SELECT id, role FROM user WHERE email = ? LIMIT 1`,
            [adminEmail]
          ) as any;
          if (rows.length > 0 && rows[0].role !== "admin") {
            await pool.execute(
              `UPDATE user SET role = 'admin' WHERE id = ?`,
              [rows[0].id]
            );
            console.log(`[Seed] Promoted existing user ${adminEmail} to admin.`);
          } else if (rows.length > 0) {
            console.log(`[Seed] Admin user ${adminEmail} already exists with admin role.`);
          }
        } finally {
          await pool.end();
        }
      } catch (dbErr: any) {
        console.error("[Seed] Failed to check/promote existing admin:", dbErr?.message || dbErr);
      }
      return;
    }

    console.error("[Seed] Failed to create admin user:", msg);
  }
}
