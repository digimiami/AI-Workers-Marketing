import Link from "next/link";

import { signUpAction } from "@/app/signup/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-[calc(100vh-0px)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <Card className="border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <CardHeader>
            <CardTitle className="text-xl">Create your AI Growth Engine</CardTitle>
            <p className="text-sm text-muted-foreground">
              Launch a campaign, generate the funnel, and start collecting leads.
            </p>
          </CardHeader>
          <CardContent>
            {error ? (
              <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <form action={signUpAction} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="orgName">
                  Workspace name
                </label>
                <Input id="orgName" name="orgName" placeholder="Acme Growth" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="email">
                  Email
                </label>
                <Input id="email" name="email" type="email" placeholder="you@company.com" autoComplete="email" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="password">
                  Password
                </label>
                <Input id="password" name="password" type="password" autoComplete="new-password" required />
                <p className="text-xs text-muted-foreground">8+ characters.</p>
              </div>
              <Button type="submit" className="w-full">
                Create workspace + campaign
              </Button>
            </form>

            <div className="mt-6 text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link className="underline underline-offset-4" href="/login">
                Sign in
              </Link>
              .
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

