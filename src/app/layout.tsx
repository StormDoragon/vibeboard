import type { Metadata, Viewport } from "next";
import "@fontsource-variable/dm-sans";
import "@fontsource/instrument-serif/latin-400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "VibeBoard — Make room for focus", template: "%s · VibeBoard" },
  description: "A mood-aware workspace for check-ins, soft tasks, and quiet focus.",
};

export const viewport: Viewport = { themeColor: "#111410" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
