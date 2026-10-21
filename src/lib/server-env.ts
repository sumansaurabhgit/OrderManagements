import "server-only";

// Secrets. `server-only` makes the build fail if this module is ever imported
// from a Client Component, so these values cannot reach the browser bundle.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  }
  return value;
}

export function getServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY");
}

export function getStripeSecretKey(): string {
  return required("STRIPE_SECRET_KEY");
}

export function getStripeWebhookSecret(): string {
  return required("STRIPE_WEBHOOK_SECRET");
}
