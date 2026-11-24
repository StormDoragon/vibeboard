import { redirect } from "next/navigation";
import { AccountForm } from "@/components/account-form";
import { getUser, providers } from "@/lib/server/auth";

export const metadata = { title: "Your account", robots: { index: false, follow: false } };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getUser()) redirect("/");
  return <AccountForm providers={providers()} failed={Boolean((await searchParams).error)} />;
}
