import type { Bunker } from "../types";

interface ResourcesBarProps {
  bunker: Bunker;
  onLevelClick?: () => void;
}

export function ResourcesBar({ bunker, onLevelClick }: ResourcesBarProps) {
  return (
    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-40 mt-3">
      <div className="bg-[#2a3447] border-3 border-[#4deeac] rounded-xl px-6 py-2 flex gap-8 shadow-[0_0_20px_rgba(77,238,172,0.4)]">
        {/* Food */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#ff6b35] rounded-full flex items-center justify-center text-2xl shadow-[0_0_10px_rgba(255,107,53,0.5)]">🍖</div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#4deeac] uppercase tracking-wider">Food</span>
            <span className="text-xl font-bold text-white">{bunker.food}</span>
          </div>
        </div>

        {/* Water */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#3b9dff] rounded-full flex items-center justify-center text-2xl shadow-[0_0_10px_rgba(59,157,255,0.5)]">💧</div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#4deeac] uppercase tracking-wider">Water</span>
            <span className="text-xl font-bold text-white">{bunker.water}</span>
          </div>
        </div>

        {/* Scrap */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#ffc107] rounded-full flex items-center justify-center text-2xl shadow-[0_0_10px_rgba(255,193,7,0.5)]">⚙️</div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#4deeac] uppercase tracking-wider">Scrap</span>
            <span className="text-xl font-bold text-white">{bunker.scrap}</span>
          </div>
        </div>

        {/* Power */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#4deeac] rounded-full flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(77,238,172,0.7)]">⚡</div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#4deeac] uppercase tracking-wider">Power</span>
            <div className="text-[11px] font-bold text-white leading-tight">
              <div className="flex items-baseline gap-2">
                <span className="text-[#4deeac]">Tạo:</span>
                <span className="text-white">{Number(bunker.power_generation || 0)}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[#4deeac]">Dùng:</span>
                <span className="text-white">{Number(bunker.power_consumption || 0)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Level */}
        <button
          type="button"
          onClick={onLevelClick}
          className="flex items-center gap-3 border-l-2 border-[#4deeac] pl-6 cursor-pointer"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-[#ffc107] to-[#ff6b35] rounded-full flex items-center justify-center text-2xl shadow-[0_0_10px_rgba(255,193,7,0.5)]">👑</div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#4deeac] uppercase tracking-wider">Level</span>
            <span className="text-xl font-bold text-white">{bunker.level}</span>
          </div>
        </button>
      </div>
    </div>
  );
}
