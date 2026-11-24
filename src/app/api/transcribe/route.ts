import { getUser, sameOrigin } from "@/lib/server/auth";
import { consumeServiceQuota } from "@/lib/server/database";

const maxBytes = 4 * 1024 * 1024;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const user = await getUser(request.headers);
  if (!user) return Response.json({ error: "Sign in to transcribe a recording." }, { status: 401 });
  const url = process.env.TRANSCRIPTION_API_URL;
  const key = process.env.TRANSCRIPTION_API_KEY;
  if (!url || !key) return Response.json({ error: "Voice transcription is unavailable." }, { status: 503 });

  if (Number(request.headers.get("content-length")) > maxBytes + 4096) {
    return Response.json({ error: "That recording is too long." }, { status: 413 });
  }
  const file = (await request.formData().catch(() => null))?.get("audio");
  if (!(file instanceof File) || !file.type.startsWith("audio/") || file.size === 0 || file.size > maxBytes) {
    return Response.json({ error: "Choose a short audio recording." }, { status: 400 });
  }
  if (!await consumeServiceQuota(user.id, "transcription", 12)) {
    return Response.json({ error: "Voice transcription has reached its hourly limit." }, { status: 429 });
  }
  const body = new FormData();
  body.set("model", process.env.TRANSCRIPTION_MODEL || "whisper-1");
  body.set("file", file);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body,
      signal: AbortSignal.timeout(20_000),
    });
    if (response.ok) {
      const data = await response.json();
      if (typeof data.text === "string") return Response.json({ text: data.text.trim().slice(0, 800) });
    }
  } catch {
    // Keep the note editable if the transcription provider is unavailable.
  }
  return Response.json({ error: "Couldn’t transcribe that recording. You can still type your note." }, { status: 502 });
}
