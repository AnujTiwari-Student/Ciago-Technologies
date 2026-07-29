import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const rows = [
  { label: "Website & API", value: "99.99% uptime", ok: true },
  { label: "Cloud Infrastructure", value: "Operational", ok: true },
  { label: "Authentication", value: "Operational", ok: true },
  { label: "Storage & Uploads", value: "Operational", ok: true },
];

export function StatusWidget({ className = "" }: { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`}
          aria-label="System status"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          All Systems Operational
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="text-sm font-semibold">System status</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Live status across our platform.</p>
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {r.label}
              </span>
              <span className="text-muted-foreground">{r.value}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          Updated in real time
        </p>
      </PopoverContent>
    </Popover>
  );
}
