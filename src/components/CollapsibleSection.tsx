import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionProps {
  id: string;
  title: string;
  icon?: ReactNode;
  accent?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({ id, title, icon, accent = "#4fc3f7", defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section id={id} className="border-b border-white/[0.05]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
      >
        <ChevronRight
          size={14}
          className={cn("text-cloud-dim transition-transform duration-200", open && "rotate-90")}
          style={open ? { color: accent } : undefined}
        />
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ color: accent, background: `${accent}14` }}>
          {icon}
        </span>
        <span className="text-[13px] font-medium tracking-wide text-cloud">{title}</span>
      </button>
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-4 px-4 pb-4 pt-1">{children}</div>
        </div>
      </div>
    </section>
  );
}
