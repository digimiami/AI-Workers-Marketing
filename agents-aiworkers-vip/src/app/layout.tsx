import type { Metadata } from "next";

import { Providers } from "@/app/providers";
import { AGENTS_SITE_NAME, AGENTS_SITE_URL } from "@/lib/constants";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(AGENTS_SITE_URL),
  title: {
    default: `${AGENTS_SITE_NAME} — AI Workforce for Business`,
    template: `%s · ${AGENTS_SITE_NAME}`,
  },
  description:
    "Hire specialized AI workers for social, YouTube, email, SEO, ads, ecommerce, support, research, content, and sales. Mission Control + Skills Marketplace included.",
  openGraph: {
    type: "website",
    siteName: AGENTS_SITE_NAME,
    url: AGENTS_SITE_URL,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
