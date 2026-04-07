# Contributing to Traeger Grill Monitor

Thank you for your interest in contributing. This guide covers how to set up a development environment, submit changes, and what to expect during review.

---

## Development Setup

### Prerequisites

- Node.js 22+
- pnpm 10+
- MySQL 8.0+ (or use the Docker Compose MySQL service)
- Docker (for building and testing the container image)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/jacobaijohnson/traeger-grill-monitor.git
cd traeger-grill-monitor

# Install dependencies
pnpm install

# Start the MySQL database (if you don't have one running)
docker compose up mysql -d

# Set environment variables
cp ENV_TEMPLATE.md .env.reference  # Review for required variables
# Create .env with your values (at minimum: JWT_SECRET, DATABASE_URL)

# Start the dev server
pnpm dev

# Run tests
pnpm test

# Type check
npx tsc --noEmit
```

The dev server starts at `http://localhost:8420` (production port) or `http://localhost:3000` (Vite dev mode) with hot module replacement.

---

## Project Structure

```
server/           ← Backend (Express + tRPC)
  _core/          ← Framework plumbing (auth, context, OAuth) — avoid editing
  routers/        ← tRPC procedure definitions
  db/             ← Database query helpers (Drizzle ORM)
client/src/       ← Frontend (React 19 + Tailwind 4)
  pages/          ← Page components
  components/     ← Reusable UI components (shadcn/ui)
  hooks/          ← Custom React hooks
drizzle/          ← Database schema and migrations
```

---

## Making Changes

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Follow the Build Loop

1. **Schema changes**: Edit `drizzle/schema.ts`, run `pnpm drizzle-kit generate`, apply the SQL migration
2. **DB helpers**: Add query functions in `server/db/*.ts`
3. **Procedures**: Add tRPC procedures in `server/routers/*.ts`
4. **UI**: Build the frontend using `trpc.*.useQuery/useMutation` hooks
5. **Tests**: Add tests in `server/*.test.ts`

### 3. Code Standards

- **TypeScript**: All code must compile with zero errors
- **Logging**: Use the structured pino logger (`import { logger } from "./logger"`), never `console.log`
- **Input validation**: All tRPC inputs must use Zod with `.max()` bounds on strings and `.min()/.max()` on numbers
- **Security**: All DB queries must be scoped by `ctx.user.id` (use `protectedProcedure`)
- **Tests**: New features must include vitest tests

### 4. Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(mqtt): add reconnection backoff strategy
fix(push): handle expired VAPID keys gracefully
perf(db): add composite index on telemetry_readings
docs: update reverse proxy configuration examples
```

---

## Submitting a Pull Request

1. Ensure all checks pass locally:
   ```bash
   npx tsc --noEmit  # TypeScript
   pnpm test           # Tests
   docker build .      # Docker build (optional but recommended)
   ```

2. Push your branch and open a PR against `main`

3. Fill out the PR template (auto-populated)

4. Wait for CI to pass (TypeScript check + test suite)

### What to Expect

- PRs are reviewed by the maintainer
- Feedback may be given on code style, security, or performance
- Squash and merge is used for clean history
- Your branch will be deleted after merge

---

## Reporting Issues

- Use the **Bug Report** template for bugs
- Use the **Feature Request** template for new ideas
- Include Docker logs (`docker logs traeger-grill-monitor`) for runtime issues
- Include browser console output for frontend issues

---

## Security

If you discover a security vulnerability, please report it privately. See [SECURITY.md](SECURITY.md) for details. Do not open a public issue for security vulnerabilities.

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
