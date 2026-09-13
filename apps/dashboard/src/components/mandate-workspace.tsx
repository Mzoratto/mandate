"use client";

import {
  ArrowRight,
  Bot,
  Check,
  Clock3,
  ExternalLink,
  Pause,
  ShieldCheck,
  X,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type ViewState = "paused" | "review" | "replanning" | "rejected";

const stateCopy: Record<ViewState, { label: string; title: string; description: string; event: string; time: string }> = {
  paused: {
    label: "AgentOS is paused",
    title: "A database change is outside your mandate.",
    description: "The agent stopped before making the change.",
    event: "Database migration blocked",
    time: "10:29",
  },
  review: {
    label: "Amendment review open",
    title: "The agent is asking for more authority.",
    description: "Review the exact change before deciding.",
    event: "Amendment A-1047-001 opened",
    time: "10:30",
  },
  replanning: {
    label: "AgentOS is working in scope",
    title: "The agent is finding another solution.",
    description: "Database authority remains blocked while the plan changes.",
    event: "Compliant replan requested",
    time: "10:31",
  },
  rejected: {
    label: "Expansion rejected",
    title: "Database authority was not granted.",
    description: "The agent can continue only inside the original boundary.",
    event: "Database amendment rejected",
    time: "10:31",
  },
};

function AlexaRing({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`alexa-ring block shrink-0 rounded-full border-[5px] border-verified ${small ? "size-8" : "size-12"}`}
    >
      <span className="block size-full rounded-full bg-sidebar" />
    </span>
  );
}

export function MandateWorkspace() {
  const [view, setView] = useState<ViewState>("paused");
  const copy = stateCopy[view];
  const attention = view !== "replanning";

  return (
    <div className="min-w-0 flex-1">
      <header className="flex h-16 items-center justify-between border-b bg-card px-5 sm:px-8 lg:px-10">
        <nav aria-label="Breadcrumb" className="flex items-center gap-3 text-sm text-muted-foreground">
          <a className="rounded-sm underline-offset-4 hover:text-foreground hover:underline" href="#mandates">Mandates</a>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-foreground">Checkout regression</span>
        </nav>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="hidden border-border bg-muted px-2.5 py-1 font-normal text-muted-foreground sm:inline-flex">
            Illustrative scenario
          </Badge>

        </div>
      </header>

      <main className="mx-auto w-full max-w-[1480px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="max-w-3xl text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
              Checkout regression
            </h1>
            <p className="mt-2 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Fix the checkout service and restore passing tests.
            </p>
          </div>
          <Badge
            className={`h-11 gap-2 rounded-full border-0 px-4 text-sm font-semibold ${attention ? "bg-attention-field text-attention" : "bg-[color-mix(in_srgb,var(--success)_12%,white)] text-success"}`}
          >
            {attention ? <Pause className="size-4" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
            {attention ? "Needs you" : "In scope"}
          </Badge>
        </div>

        <nav aria-label="Mandate sections" className="mt-7 flex gap-8 overflow-x-auto border-b text-sm text-muted-foreground sm:text-base">
          {[
            ["Overview", "#overview", true],
            ["Process", "#process", false],
            ["Authority", "#authority", false],
            ["Evidence", "#evidence", false],
          ].map(([label, href, current]) => (
            <a
              key={label as string}
              aria-current={current ? "page" : undefined}
              className={`shrink-0 border-b-2 px-0.5 pb-3 font-medium transition-colors ${current ? "border-foreground text-foreground" : "border-transparent hover:text-foreground"}`}
              href={href as string}
            >
              {label}
            </a>
          ))}
        </nav>

        <div id="overview" className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
          <section className="rounded-xl border bg-card p-5 shadow-[0_10px_30px_rgba(17,24,32,0.05)] sm:p-8" aria-labelledby="decision-title">
            <div aria-live="polite">
              <div className="flex items-center gap-3 text-sm font-semibold text-attention">
                <span className={`grid size-10 place-items-center rounded-full ${attention ? "bg-attention-field" : "bg-[color-mix(in_srgb,var(--success)_12%,white)] text-success"}`}>
                  {attention ? <Pause className="size-4" aria-hidden="true" /> : <Bot className="size-4" aria-hidden="true" />}
                </span>
                {copy.label}
              </div>
              <h2 id="decision-title" className="mt-5 max-w-3xl text-balance text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
                {copy.title}
              </h2>
              <p className="mt-2 max-w-2xl text-base text-muted-foreground sm:text-lg">{copy.description}</p>
            </div>

            <div className="mt-6 flex items-center gap-4 rounded-lg bg-muted px-4 py-4 sm:px-5">
              <ShieldCheck className="size-8 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm text-muted-foreground">Your boundary</p>
                <p className="font-semibold">Checkout code and tests only</p>
              </div>
            </div>

            {view === "review" ? (
              <div className="mt-6" id="amendment-review">
                <Separator />
                <div className="flex items-start justify-between gap-4 pt-6">
                  <div>
                    <h3 className="text-lg font-semibold">Requested authority</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Amendment A-1047-001 · Version 1 → 2</p>
                  </div>
                  <Button aria-label="Close amendment review" variant="ghost" size="icon" className="size-11" onClick={() => setView("paused")}>
                    <X aria-hidden="true" />
                  </Button>
                </div>
                <dl className="mt-5 grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
                  <div className="bg-card p-4">
                    <dt className="text-sm text-muted-foreground">New effect</dt>
                    <dd className="mt-1 font-semibold">Database schema mutation</dd>
                  </div>
                  <div className="bg-card p-4">
                    <dt className="text-sm text-muted-foreground">Risk change</dt>
                    <dd className="mt-1 font-semibold text-attention">Medium → High</dd>
                  </div>
                  <div className="bg-card p-4 sm:col-span-2">
                    <dt className="text-sm text-muted-foreground">Why</dt>
                    <dd className="mt-1">Store a persistent Stripe idempotency key in a new column.</dd>
                  </div>
                </dl>
                <div className="mt-5">
                  <p className="text-sm font-semibold">Compliant alternative</p>
                  <p className="mt-1 text-sm text-muted-foreground">Use the existing checkout metadata field. No new authority required.</p>
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Button className="h-12 px-6" onClick={() => setView("rejected")}>Reject database change</Button>
                  <Button className="h-12 px-6" variant="outline" disabled title="Live Alexa+ approval is not connected">
                    Approve amendment
                  </Button>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Live approval requires authenticated Alexa+ identity.</p>
              </div>
            ) : (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button className="h-12 px-6 text-base" onClick={() => setView("replanning")}>Find another solution</Button>
                <Button className="h-12 px-6 text-base" variant="outline" onClick={() => setView("review")}>Review amendment</Button>
              </div>
            )}
            <p className="mt-3 text-sm text-muted-foreground">Your approved scope stays unchanged.</p>
          </section>

          <aside id="authority" className="px-1 py-3 xl:px-4" aria-labelledby="mandate-summary-title">
            <h2 id="mandate-summary-title" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">This mandate</h2>
            <div className="mt-5 flex items-center gap-3">
              <AlexaRing small />
              <p className="font-semibold">Approved with Alexa+</p>
            </div>
            <dl className="mt-7 grid grid-cols-[1fr_auto] gap-x-5 gap-y-4 text-sm">
              <dt className="text-muted-foreground">Runtime</dt><dd>AgentOS</dd>
              <dt className="text-muted-foreground">Authority</dt><dd className="font-mono text-xs">Version 1</dd>
              <dt className="text-muted-foreground">Created</dt><dd>Today, 10:24</dd>
              <dt className="text-muted-foreground">Budget</dt><dd>$5.00</dd>
            </dl>
            <Separator className="my-7" />
            <a href="#approved-scope" className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              View approved scope <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </aside>
        </div>

        <section id="process" className="mt-5 flex flex-col gap-5 rounded-xl bg-sidebar px-5 py-6 text-sidebar-foreground shadow-[0_14px_34px_rgba(18,26,36,0.15)] sm:flex-row sm:items-center sm:px-8">
          <AlexaRing />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="font-semibold">Alexa+</h2>
              <span className="text-xs text-[#afbdca]">Illustrative conversation</span>
            </div>
            <p className="mt-2 text-lg sm:text-xl">Should I ask the agent to find another way?</p>
          </div>
          <Button className="h-12 shrink-0 border-sidebar-border bg-transparent px-5 text-sidebar-foreground hover:bg-sidebar-accent" variant="outline" onClick={() => setView("replanning")}>
            Ask Alexa+ <ArrowRight aria-hidden="true" />
          </Button>
        </section>

        <section id="evidence" className="mt-5 grid min-h-16 items-center gap-3 border-y px-2 py-3 text-sm sm:grid-cols-[auto_100px_1fr_auto_auto] sm:px-3">
          <Clock3 className="size-5 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Latest event</span>
          <strong className="font-medium">{copy.event}</strong>
          <time className="font-mono text-xs text-muted-foreground">{copy.time}</time>
          <a className="inline-flex min-h-11 items-center gap-2 rounded-md text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href="#process">
            Open process <ArrowRight className="size-4" aria-hidden="true" />
          </a>
        </section>

        <section id="approved-scope" className="mt-12 grid gap-6 border-t pt-8 md:grid-cols-[220px_1fr]">
          <div>
            <h2 className="text-xl font-semibold">Approved scope</h2>
            <p className="mt-2 text-sm text-muted-foreground">Immutable Mandate version 1</p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2">
            <div className="bg-card p-5"><p className="text-sm text-muted-foreground">Resources</p><p className="mt-2 font-mono text-sm">services/checkout/**<br />tests/checkout/**</p></div>
            <div className="bg-card p-5"><p className="text-sm text-muted-foreground">Explicitly forbidden</p><p className="mt-2 text-sm font-medium">Database schema mutation<br />Production deployment<br />Secret write</p></div>
          </div>
        </section>
      </main>
    </div>
  );
}
