import type { Metadata } from "next";
import "./globals.css";

import { Providers } from "@/app/providers";

export const metadata: Metadata = {
  title: "AiWorkers.vip — AI workforce for marketing",
  description:
    "AI workers for research, funnels, content, lead gen, nurturing, optimization, and reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning: browser extensions often mutate <html>/<body> before React hydrates */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
