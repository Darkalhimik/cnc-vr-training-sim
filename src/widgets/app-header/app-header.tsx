"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment } from "react";
import { cn } from "@/shared/lib/cn";
import { authClient, useSession } from "@/shared/lib/auth-client";
import { ShelfIcon, ToolIcon } from "@/shared/ui/icons";
import { ThemeToggle } from "@/widgets/theme-toggle/theme-toggle";

export type Crumb = { label: string; href?: string };

/**
 * Who is using the trainer. Nobody signed in reads as nothing to lose yet;
 * a guest is told what signing up keeps; an account shows its name.
 */
function AccountMenu() {
  const { data, isPending } = useSession();
  const router = useRouter();
  const user = data?.user as ({ name: string; isAnonymous?: boolean | null } & Record<string, unknown>) | undefined;

  if (isPending) return <span className="h-7 w-20" />;
  if (!user || user.isAnonymous) {
    return (
      <div className="flex items-center gap-2">
        {user?.isAnonymous && (
          <span className="hidden text-xs text-muted-foreground sm:inline">Guest — sign up to keep progress</span>
        )}
        <Link
          href="/sign-in"
          className="inline-flex h-7 items-center rounded-md border px-3 text-xs font-medium transition-colors hover:bg-accent"
        >
          Sign in
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="max-w-40 truncate text-xs">{user.name}</span>
      <button
        type="button"
        onClick={async () => {
          await authClient.signOut();
          router.refresh();
        }}
        className="inline-flex h-7 items-center rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}

/**
 * The bar over every page outside the simulator: where you are, the warehouse,
 * the account and the theme. Breadcrumbs start at Machines — the dashboard.
 */
export function AppHeader({ crumbs = [] }: { crumbs?: Crumb[] }) {
  const pathname = usePathname();
  const trail: Crumb[] = [{ label: "Machines", href: "/" }, ...crumbs];

  return (
    <nav className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="font-mono text-xs font-medium tracking-tight">
          CNC·TRAINER
        </Link>
        <span className="h-4 w-px bg-border" />
        <ol className="flex min-w-0 items-center gap-1.5 text-xs">
          {trail.map((c, i) => (
            <Fragment key={c.label}>
              {i > 0 && <li className="text-muted-foreground/60">/</li>}
              <li className="min-w-0 truncate">
                {c.href && i < trail.length - 1 ? (
                  <Link href={c.href} className="text-muted-foreground transition-colors hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </li>
            </Fragment>
          ))}
        </ol>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/warehouse"
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors hover:bg-accent",
              pathname.startsWith("/warehouse") ? "bg-accent" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ShelfIcon />
            Warehouse
          </Link>
          <Link
            href="/toolbox"
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors hover:bg-accent",
              pathname.startsWith("/toolbox") ? "bg-accent" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ToolIcon />
            Toolbox
          </Link>
          <AccountMenu />
          <ThemeToggle className="hidden sm:inline-flex" />
        </div>
      </div>
    </nav>
  );
}
