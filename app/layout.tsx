import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: { default: "SAMBIKE kampane", template: "%s · SAMBIKE" },
    description: "Správa reklamných kampaní, ich stránok a záujemcov pre SAMBIKE.",
    icons: { icon: "/brand/sambike-mark.png" },
    openGraph: {
      title: "SAMBIKE kampane",
      description: "Reklamné kampane a ponuky SAMBIKE.",
      images: ["/og.png"],
    },
    twitter: { card: "summary_large_image", images: ["/og.png"] },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sk" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
