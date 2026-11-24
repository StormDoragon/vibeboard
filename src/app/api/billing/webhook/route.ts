import { getAuth } from "@/lib/server/auth";
import { billingConfigured, stripeClient, syncSubscription } from "@/lib/server/billing";

export async function POST(request: Request) {
  if (!billingConfigured()) return new Response("Stripe billing is unavailable.", { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing Stripe signature.", { status: 400 });

  const stripe = stripeClient();
  let event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Invalid Stripe signature.", { status: 400 });
  }
  await getAuth();
  await syncSubscription(event, stripe);
  return Response.json({ received: true });
}
