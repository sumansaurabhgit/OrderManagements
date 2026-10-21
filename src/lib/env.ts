// Public configuration. NEXT_PUBLIC_* variables must be referenced literally so
// Next.js can inline them into the client bundle.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  }
  return value;
}

export function getAppUrl(): string {
  return required("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL).replace(/\/+$/, "");
}

export function getSupabasePublicConfig(): { url: string; anonKey: string } {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}
