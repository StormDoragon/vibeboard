import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { getSessionCookie } from "better-auth/cookies";
import { magicLink } from "better-auth/plugins/magic-link";
import { headers } from "next/headers";
import nodemailer from "nodemailer";
import { dataDirectory, getDatabase, prepareDatabase } from "./database";

export function providers() {
  return {
    magicLink: Boolean(process.env.SMTP_URL && process.env.EMAIL_FROM),
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  };
}

function secret() {
  if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;
  if (process.env.DATABASE_URL || process.env.VERCEL) {
    throw new Error("Set BETTER_AUTH_SECRET before running with a hosted database or on Vercel.");
  }
  mkdirSync(dataDirectory(), { recursive: true, mode: 0o700 });
  const path = resolve(dataDirectory(), "auth-secret");
  try {
    writeFileSync(path, randomBytes(40).toString("hex"), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return readFileSync(path, "utf8");
}

async function sendLink(email: string, url: string, purpose: "signin" | "verify") {
  const transport = nodemailer.createTransport(process.env.SMTP_URL!);
  await transport.sendMail({
    from: process.env.EMAIL_FROM!,
    to: { name: "", address: email },
    disableFileAccess: true,
    disableUrlAccess: true,
    subject: purpose === "signin" ? "Your VibeBoard sign-in link" : "Verify your VibeBoard email",
    text: `Open this link to ${purpose === "signin" ? "sign in to" : "verify your email for"} VibeBoard:\n\n${url}\n\nIf you didn’t request this email, you can ignore it.`,
  });
}

function createAuth() {
  const enabled = providers();
  return betterAuth({
    appName: "VibeBoard",
    baseURL: process.env.BETTER_AUTH_URL || {
      allowedHosts: ["localhost:*", "127.0.0.1:*", "[::1]:*"],
      fallback: "http://localhost:3000",
      protocol: "http",
    },
    secret: secret(),
    database: getDatabase(),
    emailAndPassword: { enabled: true, minPasswordLength: 8, requireEmailVerification: enabled.magicLink },
    emailVerification: enabled.magicLink ? {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: ({ user, url }) => sendLink(user.email, url, "verify"),
    } : undefined,
    socialProviders: {
      ...(enabled.google ? { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } } : {}),
      ...(enabled.github ? { github: { clientId: process.env.GITHUB_CLIENT_ID!, clientSecret: process.env.GITHUB_CLIENT_SECRET! } } : {}),
    },
    plugins: enabled.magicLink ? [magicLink({
      storeToken: "hashed",
      sendMagicLink: ({ email, url }) => sendLink(email, url, "signin"),
    })] : [],
    telemetry: { enabled: false },
    rateLimit: { enabled: true, storage: "database" },
    onAPIError: { errorURL: "/account?error=signin" },
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export async function getAuth() {
  const instance = (auth ??= createAuth());
  await prepareDatabase(async () => {
    const migration = await getMigrations(instance.options);
    await migration.runMigrations();
  });
  return instance;
}

export async function getUser(requestHeaders?: Headers) {
  const incoming = requestHeaders ?? await headers();
  if (!getSessionCookie(incoming)) return null;
  const instance = await getAuth();
  return (await instance.api.getSession({ headers: incoming }))?.user ?? null;
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  if (!origin) return true;
  return new URL(process.env.BETTER_AUTH_URL || request.url).origin === origin ||
    (!process.env.BETTER_AUTH_URL && URL.parse(origin)?.host === request.headers.get("host"));
}
