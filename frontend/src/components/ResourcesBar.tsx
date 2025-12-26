import type { Bunker } from "../types";

interface ResourcesBarProps {
  bunker: Bunker;
  onLevelClick?: () => void;
}

export function ResourcesBar({ bunker, onLevelClick }: ResourcesBarProps) {
  return (
    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-40 mt-3">
      <div className="vault-card px-4 py-2 flex gap-4 md:gap-6">
        {/* Food */}
        <div className="resource-bar-container">
          <div className="w-9 h-9 bg-resource-food rounded-sm flex items-center justify-center text-xl">🍖</div>
          <div className="flex flex-col">
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">Food</span>
            <span className="text-lg font-orbitron font-bold text-foreground">{bunker.food}</span>
          </div>
        </div>

        {/* Water */}
        <div className="resource-bar-container">
          <div className="w-9 h-9 bg-resource-water rounded-sm flex items-center justify-center text-xl">💧</div>
          <div className="flex flex-col">
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">Water</span>
            <span className="text-lg font-orbitron font-bold text-foreground">{bunker.water}</span>
          </div>
        </div>

        {/* Scrap */}
        <div className="resource-bar-container">
          <div className="w-9 h-9 bg-resource-scrap rounded-sm flex items-center justify-center text-xl">⚙️</div>
          <div className="flex flex-col">
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">Scrap</span>
            <span className="text-lg font-orbitron font-bold text-foreground">{bunker.scrap}</span>
          </div>
        </div>

        {/* Power */}
        <div className="resource-bar-container">
          <div className="w-9 h-9 bg-resource-power rounded-sm flex items-center justify-center text-xl">⚡</div>
          <div className="flex flex-col">
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">Power</span>
            <div className="text-[11px] font-mono text-muted-foreground leading-tight">
              <div className="flex items-baseline gap-2">
                <span className="text-foreground">Gen:</span>
                <span className="text-foreground font-bold">{Number(bunker.power_generation || 0)}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-foreground">Use:</span>
                <span className="text-foreground font-bold">{Number(bunker.power_consumption || 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Level */}
        <button
          type="button"
          onClick={onLevelClick}
          className="resource-bar-container border-l-2 border-l-primary pl-4 cursor-pointer"
        >
          <div className="w-9 h-9 bg-accent rounded-sm flex items-center justify-center text-xl">👑</div>
          <div className="flex flex-col">
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">Level</span>
            <span className="text-lg font-orbitron font-bold text-foreground">{bunker.level}</span>
          </div>
        </button>
      </div>
    </div>
  );
}
