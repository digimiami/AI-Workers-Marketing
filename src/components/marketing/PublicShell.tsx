import Link from "next/link";
import Image from "next/image";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function PublicShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border/50 glass-panel">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="AiWorkers.vip" width={22} height={22} priority />
            <span className="font-display text-lg font-bold tracking-tight text-gradient-fx">AiWorkers.vip</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
            {[
              { href: "/how-it-works", label: "How it works" },
              { href: "/ai-workers", label: "AI Workers" },
              { href: "/use-cases", label: "Use cases" },
              { href: "/pricing", label: "Pricing" },
              { href: "/resources", label: "Resources" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/demo"
              className={buttonVariants({
                variant: "outline",
                className: "hidden sm:inline-flex border-primary/25",
              })}
            >
              Run demo
            </Link>
            <Link
              href="/book"
              className={buttonVariants({ className: "btn-primary-cta shadow-sm shadow-primary/20" })}
            >
              Book workflow audit
            </Link>
          </div>
        </div>
      </header>

      <main className="relative flex-1">
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute inset-0 fx-atmosphere opacity-70" />
          <div className="absolute inset-0 fx-grid-bg fx-grid-fade opacity-[0.35]" />
          <div className="absolute inset-0 fx-vignette opacity-60" />
          <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-primary/[0.08] via-transparent to-transparent dark:from-primary/[0.10]" />
        </div>
        <div className="relative">{children}</div>
      </main>

      <footer className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 font-display font-bold tracking-tight text-gradient-fx">
                <Image src="/logo.svg" alt="AiWorkers.vip" width={18} height={18} />
                <span>AiWorkers.vip</span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                AI workforce for marketing automation.
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <Link className="rounded-md hover:text-foreground transition-colors" href="/affiliate-disclosure">
                Affiliate disclosure
              </Link>
              <Link className="rounded-md hover:text-foreground transition-colors" href="/privacy">
                Privacy
              </Link>
              <Link className="rounded-md hover:text-foreground transition-colors" href="/terms">
                Terms
              </Link>
              <Link className="rounded-md hover:text-foreground transition-colors" href="/cookie-policy">
                Cookie policy
              </Link>
            </div>
          </div>
          <Separator className="my-8 opacity-50" />
          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} AiWorkers.vip. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
