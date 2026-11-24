import { z } from "zod";
import { getUser, sameOrigin } from "@/lib/server/auth";
import { billingConfigured, openBilling } from "@/lib/server/billing";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const user = await getUser(request.headers);
  if (!user) return Response.json({ error: "Sign in to manage your plan." }, { status: 401 });
  if (!billingConfigured()) return Response.json({ error: "Stripe billing is unavailable." }, { status: 503 });

  const action = z.object({ action: z.enum(["portal", "monthly", "yearly"]) })
    .safeParse(await request.json().catch(() => null));
  if (!action.success) return Response.json({ error: "Choose a billing option." }, { status: 400 });

  try {
    const url = await openBilling(user, action.data.action);
    if (url) return Response.json({ url });
  } catch {
    return Response.json({ error: "Couldn’t open Stripe. Try again in a moment." }, { status: 502 });
  }
  return Response.json({ error: "A billing account hasn’t been created yet." }, { status: 404 });
}
