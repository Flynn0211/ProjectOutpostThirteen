import type { ReactNode } from "react";
import type { ToolbarTab } from "./Toolbar";

const navButtons: Array<{ tab: Exclude<ToolbarTab, null>; label: string; icon: string }> = [
  { tab: "inventory", label: "Inventory", icon: "📦" },
  { tab: "raid", label: "Raid", icon: "⚔️" },
  { tab: "market", label: "Market", icon: "🏪" },
  { tab: "expedition", label: "Expedition", icon: "🗺️" },
  { tab: "recruit", label: "Recruit", icon: "👥" },
  { tab: "npc-manager", label: "Manage NPCs", icon: "⚙️" },
  { tab: "logs", label: "Logs", icon: "📜" },
  { tab: "upgrade", label: "Upgrade", icon: "⬆️" },
];

interface SwooshLayoutProps {
  children: ReactNode;
  activeTab: ToolbarTab;
  onTabChange: (tab: ToolbarTab) => void;
  headerRight?: ReactNode;
}

export function SwooshLayout({
  children,
  activeTab,
  onTabChange,
  headerRight,
}: SwooshLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b-2 border-primary bg-card/50 backdrop-blur">
        <div className="max-w-[1536px] mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-2xl font-orbitron font-bold text-primary truncate">on-chain bunker</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-primary font-mono">[SYSTEM ONLINE]</div>
            {headerRight}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-full md:w-80 border-r-2 border-primary bg-card/30 overflow-y-auto flex flex-col">
          <div className="p-3 space-y-2 flex-1">
            <div className="text-xs font-mono text-primary uppercase tracking-widest mb-3 px-2">
              [COMMAND CENTER]
            </div>
            {navButtons.map((btn) => {
              const isActive = activeTab === btn.tab;
              return (
                <button
                  key={btn.tab}
                  onClick={() => onTabChange(isActive ? null : btn.tab)}
                  className={`w-full flex items-center gap-4 px-6 py-6 ml-2 rounded-sm font-orbitron text-sm uppercase tracking-wider transition-all border-2 ${
                    isActive
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                  } active:scale-95`}
                >
                  <span aria-hidden className="text-lg">{btn.icon}</span>
                  <span className="pl-1">{btn.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-3 border-t-2 border-primary text-xs text-muted-foreground font-mono space-y-1">
            <div>[STATUS]</div>
            <div>Vault: Operational</div>
          </div>
        </nav>

        <main className="flex-1 overflow-auto relative">{children}</main>
      </div>
    </div>
  );
}
