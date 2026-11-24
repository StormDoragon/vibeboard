import { adaptiveSummary, newWorkspace, workspaceSchema, type Workspace, type WorkspaceVersion } from "@/lib/workspace";
import { getAuth } from "./auth";
import { query } from "./database";

type WorkspaceRow = { state: string; revision: number };

function decode(row: WorkspaceRow): WorkspaceVersion {
  return { state: workspaceSchema.parse(JSON.parse(row.state)), revision: row.revision };
}

export async function readWorkspace(userId: string): Promise<WorkspaceVersion> {
  const [row] = await query<WorkspaceRow>("SELECT state, revision FROM workspaces WHERE user_id = $1", [userId]);
  return row ? decode(row) : { revision: 0, state: newWorkspace() };
}

export async function saveWorkspace(userId: string, version: WorkspaceVersion) {
  const { state, revision } = version;
  if (revision === 0) {
    await query("INSERT INTO workspaces (user_id, state) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING", [
      userId, JSON.stringify(newWorkspace()),
    ]);
  }
  try {
    const [saved] = await query<{ revision: number }>(`
      UPDATE workspaces SET state = $1, username = $2, visibility = $3, revision = revision + 1
      WHERE user_id = $4 AND revision = $5 RETURNING revision
    `, [JSON.stringify(state), state.profile.username || null, state.profile.visibility, userId, revision]);
    return saved
      ? { type: "saved" as const, version: { revision: saved.revision, state } }
      : { type: "conflict" as const, version: await readWorkspace(userId) };
  } catch (error) {
    const dbError = error as { code?: string; errcode?: number };
    if (dbError.code === "23505" || dbError.errcode === 2067) return { type: "username" as const };
    throw error;
  }
}

export function publicStatus(state: Workspace) {
  const vibe = state.vibes[0];
  return {
    username: state.profile.username,
    scene: state.preferences.scene,
    visibility: state.profile.visibility,
    message: state.profile.message,
    mood: vibe?.mood ?? null,
    summary: vibe ? adaptiveSummary(vibe) : null,
    focusEndsAt: state.profile.showFocus ? state.focus?.endsAt ?? null : null,
  };
}

export async function findPublicStatus(username: string) {
  await getAuth();
  const [row] = await query<WorkspaceRow & { user_id: string }>(`
    SELECT state, revision, user_id FROM workspaces
    WHERE username = $1 AND visibility IN ('unlisted', 'public')
  `, [username]);
  if (!row) return null;
  const [subscription] = await query<{ subscription_id: string }>(`
    SELECT s.subscription_id FROM billing_subscriptions s
    JOIN billing_customers c ON c.customer_id = s.customer_id
    WHERE c.user_id = $1 AND s.status IN ('trialing', 'active') LIMIT 1
  `, [row.user_id]);
  return { ...publicStatus(decode(row).state), pro: Boolean(subscription) };
}
