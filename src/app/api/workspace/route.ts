import { workspaceUpdateSchema } from "@/lib/workspace";
import { getUser, sameOrigin } from "@/lib/server/auth";
import { readWorkspace, saveWorkspace } from "@/lib/server/workspaces";

export async function GET(request: Request) {
  const user = await getUser(request.headers);
  if (!user) return Response.json({ error: "Sign in to open your workspace." }, { status: 401 });
  return Response.json(await readWorkspace(user.id), { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const user = await getUser(request.headers);
  if (!user) return Response.json({ error: "Sign in again to save your changes." }, { status: 401 });

  const text = await request.text();
  if (text.length > 280_000) return Response.json({ error: "This workspace is too large." }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid workspace update." }, { status: 400 });
  }
  const version = workspaceUpdateSchema.safeParse(json);
  if (!version.success) return Response.json({ error: "Check the values and try saving again." }, { status: 400 });

  const result = await saveWorkspace(user.id, version.data);
  if (result.type === "username") return Response.json({ error: "That username is already in use." }, { status: 422 });
  if (result.type === "conflict") return Response.json(result.version, { status: 409 });
  return Response.json(result.version);
}
