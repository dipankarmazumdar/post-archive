import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import "@fontsource/open-sauce-sans/400.css";
import "@fontsource/open-sauce-sans/400-italic.css";
import "@fontsource/open-sauce-sans/500.css";
import "@fontsource/open-sauce-sans/600.css";
import "@fontsource/open-sauce-sans/700.css";
import "./globals.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/", types: { "application/rss+xml": "/feed.xml" } },
  openGraph: { title: SITE_NAME, description: SITE_DESCRIPTION, type: "website", url: "/" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main id="content" className="wrap">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
