import type { ReactNode } from "react";

interface ModalShellProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function ModalShell({ open, title, onClose, children, className }: ModalShellProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fadeInScale"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={
          [
            "relative w-[96vw] max-h-[92vh] overflow-y-auto overflow-x-hidden",
            "vault-card terminal-border",
            "p-6 md:p-8",
            className ?? "",
          ].join(" ")
        }
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-3 h-3 bg-primary rounded-full animate-pulse shadow-[0_0_10px_hsl(var(--primary)/0.55)]" />
            <h2 className="text-2xl md:text-3xl font-orbitron font-bold text-primary uppercase tracking-wider truncate">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-primary hover:text-foreground text-4xl font-bold transition-all duration-200 hover:rotate-90 hover:scale-110"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
