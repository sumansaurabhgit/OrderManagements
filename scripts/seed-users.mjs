#!/usr/bin/env node
/**
 * Creates (or repairs) the test accounts and grants the admin role.
 * Works against any Supabase project via the Auth Admin API, so it is the way
 * to seed users on a hosted project (seed.sql covers the local stack).
 *
 *   npm run seed:users                         # local stack: both test accounts
 *   npm run seed:users -- --hosted             # hosted project from .env.local
 *   npm run seed:users -- --promote a@b.com    # make an existing user an admin
 *
 * Optional overrides: SEED_ADMIN_EMAIL, SEED_CUSTOMER_EMAIL, SEED_PASSWORD.
 */
import { createClient } from "@supabase/supabase-js";

import { loadEnv } from "./load-env.mjs";

const args = process.argv.slice(2);
const { url, serviceRoleKey, hosted } = loadEnv(args);
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserByEmail(email) {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 1000) return null;
  }
}

async function setRole(userId, role) {
  // Role changes are a privileged, out-of-band operation (service role only).
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw error;
}

async function ensureUser({ email, password, displayName, role }) {
  let user = await findUserByEmail(email);
  if (user) {
    const { error } = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    if (error) throw error;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (error) throw error;
    user = data.user;
  }
  await setRole(user.id, role);
  console.log(`✔ ${email} (${role})`);
}

const promoteIndex = args.indexOf("--promote");
if (promoteIndex !== -1) {
  const email = args[promoteIndex + 1];
  if (!email) {
    console.error("Usage: npm run seed:users -- --promote someone@example.com");
    process.exit(1);
  }
  const user = await findUserByEmail(email);
  if (!user) {
    console.error(`No user with email ${email}. Sign up first, then promote.`);
    process.exit(1);
  }
  await setRole(user.id, "admin");
  console.log(`✔ ${email} is now an admin`);
} else {
  const password = process.env.SEED_PASSWORD ?? "Password123!";
  console.log(`Seeding test users on ${hosted ? "the hosted project" : url}`);
  await ensureUser({
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
    password,
    displayName: "Store Admin",
    role: "admin",
  });
  await ensureUser({
    email: process.env.SEED_CUSTOMER_EMAIL ?? "customer@example.com",
    password,
    displayName: "Casey Customer",
    role: "customer",
  });
}
