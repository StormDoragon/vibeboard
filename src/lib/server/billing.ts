import Stripe from "stripe";
import { query } from "./database";

export function billingConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.STRIPE_MONTHLY_PRICE_ID && process.env.STRIPE_YEARLY_PRICE_ID && process.env.BETTER_AUTH_URL);
}

export function stripeClient() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { maxNetworkRetries: 2, timeout: 12_000 });
}

export async function billingAccount(userId: string) {
  const [row] = await query<{ customer_id: string; active: number }>(`
    SELECT c.customer_id, CASE WHEN EXISTS (
      SELECT 1 FROM billing_subscriptions s WHERE s.customer_id = c.customer_id
      AND s.status IN ('trialing', 'active')
    ) THEN 1 ELSE 0 END AS active
    FROM billing_customers c WHERE c.user_id = $1
  `, [userId]);
  return { customerId: row?.customer_id ?? null, pro: Boolean(row?.active) };
}

export async function openBilling(user: { id: string; email: string }, action: "portal" | "monthly" | "yearly") {
  const stripe = stripeClient();
  const account = await billingAccount(user.id);
  const base = new URL(process.env.BETTER_AUTH_URL!);
  const settings = new URL("/?view=settings", base).href;
  let customerId = account.customerId;

  if (action === "portal" || account.pro) {
    if (!customerId) return null;
    const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: settings });
    return session.url;
  }

  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email }, {
      idempotencyKey: `vibeboard-customer-${user.id}`,
    });
    await query(`INSERT INTO billing_customers (user_id, customer_id) VALUES ($1, $2)
      ON CONFLICT (user_id) DO NOTHING`, [user.id, customer.id]);
    customerId = (await billingAccount(user.id)).customerId!;
  }

  // Reuse an open checkout and account for webhook delivery lag.
  const [open, subscriptions] = await Promise.all([
    stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 1 }),
    stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 }),
  ]);
  if (subscriptions.data.some(({ status }) => !["canceled", "incomplete_expired"].includes(status))) {
    return (await stripe.billingPortal.sessions.create({ customer: customerId, return_url: settings })).url;
  }
  if (open.data[0]?.url) return open.data[0].url;

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: action === "monthly" ? process.env.STRIPE_MONTHLY_PRICE_ID! : process.env.STRIPE_YEARLY_PRICE_ID!, quantity: 1 }],
    success_url: `${settings}&billing=success`,
    cancel_url: settings,
  }, { idempotencyKey: `vibeboard-checkout-${user.id}-${Math.floor(Date.now() / 1_800_000)}` });
  return checkout.url;
}

export async function syncSubscription(event: Stripe.Event, stripe: Stripe) {
  if (!["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) return;
  const changed = event.data.object as Stripe.Subscription;
  const customerId = typeof changed.customer === "string" ? changed.customer : changed.customer.id;
  const [local] = await query("SELECT user_id FROM billing_customers WHERE customer_id = $1", [customerId]);
  if (!local) return;

  const subscription = event.type === "customer.subscription.deleted"
    ? changed
    : await stripe.subscriptions.retrieve(changed.id);
  const prices = [process.env.STRIPE_MONTHLY_PRICE_ID, process.env.STRIPE_YEARLY_PRICE_ID];
  const eligible = subscription.items.data.some((item) => prices.includes(item.price.id));
  await query(`
    INSERT INTO billing_subscriptions (subscription_id, customer_id, status, event_time)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (subscription_id) DO UPDATE SET status = excluded.status, event_time = excluded.event_time
    WHERE billing_subscriptions.event_time <= excluded.event_time
  `, [subscription.id, customerId, eligible ? subscription.status : "ineligible", event.created]);
}
