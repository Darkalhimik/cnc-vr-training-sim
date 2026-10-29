"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient, useSession } from "@/shared/lib/auth-client";
import { Button } from "@/shared/ui/button";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { AppHeader } from "@/widgets/app-header/app-header";

type Tab = "sign-in" | "sign-up";

const inputClass =
  "h-8 w-full rounded-md border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

function SignInForm() {
  const router = useRouter();
  const search = useSearchParams();
  const back = search.get("next") ?? "/";
  const { data } = useSession();
  const isGuest = !!(data?.user as { isAnonymous?: boolean } | undefined)?.isAnonymous;
  const [tab, setTab] = useState<Tab>(isGuest ? "sign-up" : "sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result =
      tab === "sign-up"
        ? await authClient.signUp.email({ email, password, name: name.trim() || email.split("@")[0] })
        : await authClient.signIn.email({ email, password });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "That did not work. Check the details and try again.");
      return;
    }
    router.push(back);
    router.refresh();
  };

  return (
    <main className="mx-auto w-full max-w-sm space-y-5 px-4 py-12">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{tab === "sign-up" ? "Create an account" : "Sign in"}</h1>
        <p className="text-xs/relaxed text-muted-foreground">
          {isGuest
            ? "You are playing as a guest. An account keeps your progress and warehouse — everything you did as a guest moves to it."
            : "Keeps your progress and your warehouse, on any device."}
        </p>
      </header>

      <SegmentedControl
        options={[
          { value: "sign-in", label: "Sign in" },
          { value: "sign-up", label: "Create account" },
        ]}
        value={tab}
        onChange={(t) => {
          setTab(t);
          setError(null);
        }}
        fill
      />

      <form onSubmit={submit} className="space-y-3">
        {tab === "sign-up" && (
          <label className="grid gap-1">
            <span className="text-xs text-muted-foreground">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={inputClass} />
          </label>
        )}
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className={inputClass}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs text-muted-foreground">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={tab === "sign-up" ? "new-password" : "current-password"}
            className={inputClass}
          />
          {tab === "sign-up" && <span className="text-[11px] text-muted-foreground">At least 8 characters.</span>}
        </label>
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? "One moment…" : tab === "sign-up" ? "Create account" : "Sign in"}
        </Button>
      </form>
    </main>
  );
}

export default function SignInPage() {
  return (
    <div className="min-h-dvh">
      <AppHeader crumbs={[{ label: "Account" }]} />
      <Suspense>
        <SignInForm />
      </Suspense>
    </div>
  );
}
