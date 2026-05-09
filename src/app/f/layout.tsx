import type { ReactNode } from "react";
import { Cormorant_Garamond, Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-funnel-body",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-funnel-display",
  display: "swap",
});

export default function FunnelLayout({ children }: { children: ReactNode }) {
  return <div className={`${inter.variable} ${cormorant.variable}`}>{children}</div>;
}
