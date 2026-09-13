import {
  Activity,
  ChevronDown,
  House,
  ScrollText,
} from "lucide-react";
import { MandateWorkspace } from "@/components/mandate-workspace";
import { Separator } from "@/components/ui/separator";

function Mark() {
  return (
    <svg aria-hidden="true" className="size-8" viewBox="0 0 32 32" fill="none">
      <path d="M4 25V7l12 10L28 7v18" stroke="currentColor" strokeWidth="4.5" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

const navigation = [
  { label: "Overview", href: "#overview", icon: House },
  { label: "Mandates", href: "#mandates", icon: ScrollText, current: true },
  { label: "Activity", href: "#process", icon: Activity },
];

export default function DashboardPage() {
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden min-h-dvh w-[272px] shrink-0 flex-col bg-sidebar px-3 py-6 text-sidebar-foreground lg:flex">
        <a href="#mandates" className="mx-3 flex items-center gap-3 rounded-md text-xl font-semibold tracking-[-0.025em]">
          <Mark /> Mandate
        </a>

        <div className="mt-7 flex h-12 items-center justify-between px-4 text-sm text-[#c5d0db]">
          Personal workspace <ChevronDown className="size-4" aria-hidden="true" />
        </div>

        <nav aria-label="Primary" className="mt-4 space-y-1">
          {navigation.map(({ label, href, icon: Icon, current }) => (
            <a
              key={label}
              aria-current={current ? "page" : undefined}
              className={`flex min-h-12 items-center gap-4 rounded-lg px-4 text-sm transition-colors ${current ? "bg-sidebar-accent text-white" : "text-[#c5d0db] hover:bg-sidebar-accent/65 hover:text-white"}`}
              href={href}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </a>
          ))}
        </nav>

        <Separator className="mx-3 my-6 w-auto bg-sidebar-border" />
        <div className="px-3">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#98a7b6]">Active mandate</p>
          <a className="mt-3 flex min-h-11 items-center gap-3 rounded-md text-sm text-[#e6edf3]" href="#overview">
            <span className="size-3 rounded-full bg-[#f6c567]" aria-hidden="true" />
            Checkout regression
          </a>
        </div>

        <div className="mt-auto">
          <div className="mx-3 mb-5 flex items-center gap-3">
            <span className="alexa-ring block size-8 shrink-0 rounded-full border-[4px] border-verified" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">Alexa+</p>
              <p className="text-xs text-[#aebbc8]">Your control, by voice</p>
            </div>
          </div>
          <Separator className="mx-3 mb-4 w-auto bg-sidebar-border" />
          <div className="flex h-12 w-full items-center gap-3 px-4 text-sidebar-foreground">
            <span className="grid size-9 place-items-center rounded-full bg-[#4c5968] text-xs font-semibold">JD</span>
            <span className="flex-1 text-left text-sm">Jamie</span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 items-center justify-between bg-sidebar px-5 text-sidebar-foreground lg:hidden">
          <a href="#overview" className="flex items-center gap-2 text-lg font-semibold"><Mark /> Mandate</a>
          <span className="inline-flex items-center gap-2 text-xs text-[#bdc9d4]">
            <ScrollText className="size-4" aria-hidden="true" /> Illustrative
          </span>
        </div>
        <MandateWorkspace />
      </div>
    </div>
  );
}
