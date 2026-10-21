import { existsSync } from "node:fs";

/**
 * Loads env files with the same precedence `next dev` uses: values from
 * .env.development.local (local Docker stack) win over .env.local (hosted
 * project). Pass --hosted to target the hosted project from .env.local only.
 * process.loadEnvFile never overrides a variable that is already set.
 */
export function loadEnv(argv = process.argv.slice(2)) {
  const hosted = argv.includes("--hosted");
  const files = hosted ? [".env.local"] : [".env.development.local", ".env.local"];
  for (const file of files) {
    if (existsSync(file)) process.loadEnvFile(file);
  }

  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"].filter(
    (name) => !process.env[name],
  );
  if (missing.length) {
    console.error(`Missing environment variables: ${missing.join(", ")}. See .env.example.`);
    process.exit(1);
  }

  return {
    hosted,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}
