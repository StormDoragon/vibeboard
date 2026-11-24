import { Dashboard } from "@/components/dashboard";
import { newWorkspace } from "@/lib/workspace";
import { getUser } from "@/lib/server/auth";
import { billingAccount, billingConfigured } from "@/lib/server/billing";
import { readWorkspace } from "@/lib/server/workspaces";

export default async function Home() {
  const user = await getUser();
  const now = Date.now();
  if (!user) return <Dashboard initial={{ state: newWorkspace(true), revision: 0 }} account={null}
    now={now} aiEnabled={false} canTranscribe={false} />;

  const [initial, billing] = await Promise.all([readWorkspace(user.id), billingAccount(user.id)]);
  return <Dashboard initial={initial} now={now} account={{
    name: user.name, email: user.email, pro: billing.pro, billing: billingConfigured(),
  }} aiEnabled={Boolean(process.env.AI_API_URL && process.env.AI_API_KEY && process.env.AI_MODEL)}
    canTranscribe={Boolean(process.env.TRANSCRIPTION_API_URL && process.env.TRANSCRIPTION_API_KEY)} />;
}
