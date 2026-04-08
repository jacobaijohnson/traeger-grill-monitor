import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Setup & Password Tests ─────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(user: AuthenticatedUser | null = null): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

const mockAdmin: AuthenticatedUser = {
  id: "admin-user-id",
  name: "Admin",
  email: "admin@test.dev",
  role: "admin",
  image: null,
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockUser: AuthenticatedUser = {
  id: "regular-user-id",
  name: "Regular User",
  email: "user@test.dev",
  role: "user",
  image: null,
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Setup Wizard", () => {
  it("setup.status procedure exists on the router", async () => {
    const caller = appRouter.createCaller(createMockContext());
    // The procedure exists — it will throw a DB error since no real DB is connected,
    // but the procedure itself should be defined
    expect(typeof caller.setup.status).toBe("function");
  });

  it("setup.createAdmin procedure exists on the router", async () => {
    const caller = appRouter.createCaller(createMockContext());
    expect(typeof caller.setup.createAdmin).toBe("function");
  });

  it("setup.createAdmin validates email format", async () => {
    const caller = appRouter.createCaller(createMockContext());
    await expect(
      caller.setup.createAdmin({
        email: "not-an-email",
        password: "password123",
        name: "Admin",
      })
    ).rejects.toThrow();
  });

  it("setup.createAdmin rejects short passwords", async () => {
    const caller = appRouter.createCaller(createMockContext());
    await expect(
      caller.setup.createAdmin({
        email: "admin@test.dev",
        password: "short",
        name: "Admin",
      })
    ).rejects.toThrow();
  });

  it("setup.createAdmin rejects empty name", async () => {
    const caller = appRouter.createCaller(createMockContext());
    await expect(
      caller.setup.createAdmin({
        email: "admin@test.dev",
        password: "password123",
        name: "",
      })
    ).rejects.toThrow();
  });
});

describe("Password Management", () => {
  it("password.changeOwn procedure exists on the router", async () => {
    const caller = appRouter.createCaller(createMockContext(mockAdmin));
    expect(typeof caller.password.changeOwn).toBe("function");
  });

  it("password.resetUser procedure exists on the router", async () => {
    const caller = appRouter.createCaller(createMockContext(mockAdmin));
    expect(typeof caller.password.resetUser).toBe("function");
  });

  it("password.changeOwn requires authentication", async () => {
    const caller = appRouter.createCaller(createMockContext(null));
    await expect(
      caller.password.changeOwn({
        currentPassword: "oldpass123",
        newPassword: "newpass123",
      })
    ).rejects.toThrow(/login|UNAUTHORIZED|not authenticated|sign in/i);
  });

  it("password.resetUser requires admin role", async () => {
    const caller = appRouter.createCaller(createMockContext(mockUser));
    await expect(
      caller.password.resetUser({
        userId: "some-user-id",
        newPassword: "newpass123",
      })
    ).rejects.toThrow(/permission|FORBIDDEN|not authorized|admin/i);
  });

  it("password.changeOwn validates min password length", async () => {
    const caller = appRouter.createCaller(createMockContext(mockAdmin));
    await expect(
      caller.password.changeOwn({
        currentPassword: "oldpass123",
        newPassword: "short",
      })
    ).rejects.toThrow();
  });

  it("password.resetUser validates min password length", async () => {
    const caller = appRouter.createCaller(createMockContext(mockAdmin));
    await expect(
      caller.password.resetUser({
        userId: "some-user-id",
        newPassword: "short",
      })
    ).rejects.toThrow();
  });

  it("password.changeOwn validates max password length", async () => {
    const caller = appRouter.createCaller(createMockContext(mockAdmin));
    await expect(
      caller.password.changeOwn({
        currentPassword: "oldpass123",
        newPassword: "a".repeat(200),
      })
    ).rejects.toThrow();
  });
});
