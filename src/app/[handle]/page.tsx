import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { StatusCard } from "@/components/status";
import { findPublicStatus } from "@/lib/server/workspaces";
import { usernameSchema } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const getStatus = cache(async (handle: string) => {
  // Next.js can preserve a leading @ as %40 in the route parameter.
  const prefix = handle.match(/^(?:@|%40)/)?.[0];
  if (!prefix) return null;
  const username = usernameSchema.safeParse(handle.slice(prefix.length));
  return username.success ? findPublicStatus(username.data) : null;
});

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const status = await getStatus((await params).handle);
  return {
    title: status ? `@${status.username}’s vibe` : "Status unavailable",
    robots: status?.visibility === "public" ? undefined : { index: false, follow: false },
  };
}

export default async function PublicStatus({ params }: { params: Promise<{ handle: string }> }) {
  const status = await getStatus((await params).handle);
  if (!status) notFound();

  return <main className="public-page" data-mood={status.mood ?? "steady"} aria-label={`@${status.username}’s vibe`}>
    <StatusCard status={status} now={Date.now()} scene={status.scene} pro={status.pro} />
  </main>;
}
