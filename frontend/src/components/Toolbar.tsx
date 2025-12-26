import { useRef, useState } from "react";
import { InventoryModal } from "./InventoryModal";
import { RaidModal } from "./RaidModal";
import { MarketplaceModal } from "./MarketplaceModal";
import { ExpeditionModal } from "./ExpeditionModal";
import { RecruitNPCModal } from "./RecruitNPCModal";
import { NPCManagerModal } from "./NPCManagerModal";
import { UpgradeModal } from "./UpgradeModal";
import { useGameStore } from "../state/gameStore";

type ToolbarTab = "inventory" | "raid" | "market" | "expedition" | "recruit" | "npc-manager" | "logs" | "upgrade" | null;

interface ToolbarProps {
  activeTab: ToolbarTab;
  onTabChange: (tab: ToolbarTab) => void;
  bunkerId?: string;
  onRefresh?: () => void;
}

export function Toolbar({ activeTab, onTabChange, bunkerId, onRefresh }: ToolbarProps) {
  const devCheatsUnlocked = useGameStore((s) => s.devCheatsUnlocked);
  const unlockDevCheats = useGameStore((s) => s.unlockDevCheats);

  const controlPanelClickCountRef = useRef(0);
  const controlPanelResetTimerRef = useRef<number | null>(null);
  
  // State to pass target NPC to inventory when switching from NPC Manager
  const [targetNpcForInventory, setTargetNpcForInventory] = useState<string | undefined>(undefined);

  const baseButton = "px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 border-2 uppercase tracking-wider relative overflow-hidden group";
  const inactive = "bg-gradient-to-br from-[#2a3447] to-[#1a1f2e] text-[#4deeac] border-[#4deeac] hover:border-[#5fffc0] hover:shadow-[0_0_20px_rgba(77,238,172,0.5)] hover:scale-105 hover:-translate-y-0.5";
  const active = "bg-gradient-to-br from-[#4deeac] to-[#3dd69a] text-[#0d1117] border-[#5fffc0] shadow-[0_0_25px_rgba(77,238,172,0.8),0_0_50px_rgba(77,238,172,0.4)] scale-105";

  const onControlPanelClick = () => {
    if (devCheatsUnlocked) return;

    controlPanelClickCountRef.current += 1;

    if (controlPanelResetTimerRef.current) {
      window.clearTimeout(controlPanelResetTimerRef.current);
    }

    // Require 10 taps within a short window to avoid accidental unlock.
    controlPanelResetTimerRef.current = window.setTimeout(() => {
      controlPanelClickCountRef.current = 0;
      controlPanelResetTimerRef.current = null;
    }, 2000);

    if (controlPanelClickCountRef.current >= 10) {
      controlPanelClickCountRef.current = 0;
      if (controlPanelResetTimerRef.current) {
        window.clearTimeout(controlPanelResetTimerRef.current);
        controlPanelResetTimerRef.current = null;
      }
      unlockDevCheats();
    }
  };

  return (
    <>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-6xl animate-slideUp">
        <div className="relative bg-gradient-to-br from-[#2a3447] via-[#1f2937] to-[#1a1f2e] border-[3px] border-[#4deeac] rounded-3xl px-6 py-4 shadow-[0_0_40px_rgba(77,238,172,0.6),0_10px_60px_rgba(0,0,0,0.5)] backdrop-blur-sm">
          {/* Animated glow effect */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-[#4deeac]/10 to-transparent animate-shimmer" />
          
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-[#4deeac] rounded-full animate-pulse shadow-[0_0_10px_rgba(77,238,172,0.8)]" />
              <div
                onClick={onControlPanelClick}
                className="text-sm uppercase tracking-[0.3em] text-[#4deeac] font-bold drop-shadow-[0_0_8px_rgba(77,238,172,0.6)] select-none cursor-pointer"
                title={devCheatsUnlocked ? "" : ""}
              >
                Control Panel
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => onTabChange(activeTab === "inventory" ? null : "inventory")}
                className={`${baseButton} ${activeTab === "inventory" ? active : inactive}`}
              >
                <span className="relative z-10">📦 Inventory</span>
              </button>
              <button
                onClick={() => onTabChange(activeTab === "raid" ? null : "raid")}
                className={`${baseButton} ${activeTab === "raid" ? active : inactive}`}
              >
                <span className="relative z-10">⚔️ Raid</span>
              </button>
              <button
                onClick={() => onTabChange(activeTab === "market" ? null : "market")}
                className={`${baseButton} ${activeTab === "market" ? active : inactive}`}
              >
                <span className="relative z-10">🏪 Market</span>
              </button>
              <button
                onClick={() => onTabChange(activeTab === "expedition" ? null : "expedition")}
                className={`${baseButton} ${activeTab === "expedition" ? active : inactive}`}
              >
                <span className="relative z-10">🗺️ Expedition</span>
              </button>
              <button
                onClick={() => onTabChange(activeTab === "recruit" ? null : "recruit")}
                className={`${baseButton} ${activeTab === "recruit" ? active : inactive}`}
              >
                <span className="relative z-10">👥 Recruit</span>
              </button>
              <button
                onClick={() => onTabChange(activeTab === "npc-manager" ? null : "npc-manager")}
                className={`${baseButton} ${activeTab === "npc-manager" ? active : inactive}`}
              >
                <span className="relative z-10">⚙️ Manage NPCs</span>
              </button>
              <button
                onClick={() => onTabChange(activeTab === "logs" ? null : "logs")}
                className={`${baseButton} ${activeTab === "logs" ? active : inactive}`}
              >
                <span className="relative z-10">📜 Logs</span>
              </button>
              <button
                onClick={() => onTabChange(activeTab === "upgrade" ? null : "upgrade")}
                className={`${baseButton} ${activeTab === "upgrade" ? active : inactive}`}
              >
                <span className="relative z-10">⬆️ Upgrade</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <InventoryModal
        isOpen={activeTab === "inventory"}
        onClose={() => {
            onTabChange(null);
            setTargetNpcForInventory(undefined);
        }}
        initialSelectedNpcId={targetNpcForInventory}
      />
      {bunkerId && (
        <>
          <RaidModal
            isOpen={activeTab === "raid"}
            onClose={() => onTabChange(null)}
            bunkerId={bunkerId}
          />
          <ExpeditionModal
            isOpen={activeTab === "expedition"}
            onClose={() => onTabChange(null)}
            bunkerId={bunkerId}
          />
        </>
      )}
      <MarketplaceModal
        isOpen={activeTab === "market"}
        onClose={() => onTabChange(null)}
      />
      <RecruitNPCModal
        isOpen={activeTab === "recruit"}
        onClose={() => onTabChange(null)}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />
      <NPCManagerModal
        isOpen={activeTab === "npc-manager"}
        onClose={() => onTabChange(null)}
        onOpenInventory={(npcId) => {
            setTargetNpcForInventory(npcId);
            onTabChange("inventory");
        }}
      />

      {bunkerId && (
        <UpgradeModal
          isOpen={activeTab === "upgrade"}
          onClose={() => onTabChange(null)}
          bunkerId={bunkerId}
          onSuccess={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </>
  );
}

