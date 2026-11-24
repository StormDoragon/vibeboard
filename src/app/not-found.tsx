import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { VibeMark } from "@/components/ui";

export default function NotFound() {
  return <main className="not-found">
    <VibeMark size="large" />
    <h1>Nothing here yet.</h1>
    <p>This page may be private or unavailable.</p>
    <Link href="/" className="button primary"><ArrowLeft size={16} /> Back to VibeBoard</Link>
  </main>;
}
