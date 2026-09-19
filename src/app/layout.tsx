import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import AuroraBackground from "@/components/AuroraBackground";

export const metadata: Metadata = {
  title: "Lensmaker",
  description:
    "State what you care about. The model composes the screen at runtime.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      {/* overflow-x-hidden is Dev A's and is kept: the shell reserves a column
          in reading mode, and without it a wide block can push a scrollbar. */}
      <body className="flex min-h-full flex-col overflow-x-hidden text-[var(--ink)]">
        <AuroraBackground />
        {/* .page-shell is what yields the right-hand column when a message is
            open. Overlays (ItemDrawer, SpecInspector) portal to <body> so they
            sit outside it — a transformed ancestor would otherwise capture
            their fixed positioning. */}
        <div className="page-shell flex flex-1 flex-col">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
