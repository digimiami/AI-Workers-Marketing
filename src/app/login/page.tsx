import Link from "next/link";

import { signInWithPasswordAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return (
    <div className="min-h-[calc(100vh-0px)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <Card className="border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <CardHeader>
            <CardTitle className="text-xl">Sign in</CardTitle>
            <p className="text-sm text-muted-foreground">
              Admin access for AiWorkers.vip.
            </p>
          </CardHeader>
          <CardContent>
            <form action={signInWithPasswordAction} className="space-y-4">
              <input type="hidden" name="redirectTo" value={redirectTo || ""} />
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </form>

            <div className="mt-6 text-xs text-muted-foreground">
              <p>
                Need access?{" "}
                <Link className="underline underline-offset-4" href="/book">
                  Book an audit
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

