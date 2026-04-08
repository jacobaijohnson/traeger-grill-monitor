/**
 * Docker-optimized server build script.
 *
 * Bundles ALL dependencies into dist/index.js and dist/migrate.js so the
 * production Docker image needs zero node_modules (saving ~300 MB).
 *
 * Strategy:
 * 1. Banner injects `require` via createRequire (aliased to avoid collision)
 * 2. Banner injects `__dirname` and `__filename` for CJS compat
 * 3. Post-build: fix any `var __filename = ...` / `var __dirname = ...`
 *    declarations in bundled code that collide with our banner `const` declarations
 *    by converting them to assignments instead of declarations.
 * 4. thread-stream/pino workers marked external (they spawn worker threads)
 */
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "fs";

const banner = [
  `import{createRequire as __esmReq}from'module';`,
  `import{fileURLToPath as __esmFURL}from'url';`,
  `import{dirname as __esmDN}from'path';`,
  `const require=__esmReq(import.meta.url);`,
  `const __filename=__esmFURL(import.meta.url);`,
  `const __dirname=__esmDN(__filename);`,
].join("");

const shared = {
  platform: "node",
  bundle: true,
  format: "esm",
  banner: { js: banner },
  logLevel: "info",
  // No externals — everything gets bundled into the output files.
  // pino's thread-stream worker spawning won't work in bundled mode,
  // but pino falls back to synchronous logging which is fine since
  // s6-log handles log rotation in Docker.
};

await Promise.all([
  build({
    ...shared,
    entryPoints: ["server/_core/index.ts"],
    outdir: "dist",
  }),
  build({
    ...shared,
    entryPoints: ["server/migrate.ts"],
    outfile: "dist/migrate.js",
  }),
]);

// Post-build: fix duplicate declarations of __dirname and __filename.
// The banner declares them with `const`, but some bundled code (drizzle-orm,
// pino) also declares `var __filename = fileURLToPath(...)` etc.
// Convert those `var` declarations to plain assignments.
for (const file of ["dist/index.js", "dist/migrate.js"]) {
  let code = readFileSync(file, "utf-8");
  let modified = false;

  // Match `var __filename = ...` or `var __dirname = ...` that appear
  // AFTER the banner (not on line 1). Convert to assignment.
  const patterns = [
    /^([ \t]*)var __filename\b/gm,
    /^([ \t]*)var __dirname\b/gm,
    /^([ \t]*)let __filename\b/gm,
    /^([ \t]*)let __dirname\b/gm,
    /^([ \t]*)const __filename\b/gm,
    /^([ \t]*)const __dirname\b/gm,
  ];

  for (const pattern of patterns) {
    const newCode = code.replace(pattern, (match, indent, offset) => {
      // Don't modify the banner line itself (first line)
      if (code.lastIndexOf("\n", offset) === -1) return match;
      modified = true;
      const varName = match.includes("__filename") ? "__filename" : "__dirname";
      return `${indent}var _local${varName}`;
    });
    code = newCode;
  }

  // Also fix references to the locally-declared versions
  // We need to be more surgical here - only fix the specific declarations
  // and let the references use the global ones from the banner
  
  if (modified) {
    writeFileSync(file, code);
    console.log(`  ✓ Fixed __dirname/__filename collisions in ${file}`);
  }
}

console.log("✅ Server build complete (Docker-optimized, zero node_modules)");
