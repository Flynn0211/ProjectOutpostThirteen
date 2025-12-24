import { useState } from "react";
import { InventoryModal } from "./InventoryModal";
import { RaidModal } from "./RaidModal";
import { MarketplaceModal } from "./MarketplaceModal";
import { ExpeditionModal } from "./ExpeditionModal";
import { RecruitNPCModal } from "./RecruitNPCModal";

type ToolbarTab = "inventory" | "raid" | "market" | "expedition" | "recruit" | null;

interface ToolbarProps {
  activeTab: ToolbarTab;
  onTabChange: (tab: ToolbarTab) => void;
  bunkerId?: string;
}

export function Toolbar({ activeTab, onTabChange, bunkerId }: ToolbarProps) {
  return (
    <>
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
        <button
          onClick={() => onTabChange(activeTab === "inventory" ? null : "inventory")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "inventory"
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          Inventory
        </button>
        <button
          onClick={() => onTabChange(activeTab === "raid" ? null : "raid")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "raid"
              ? "bg-red-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          Raid
        </button>
        <button
          onClick={() => onTabChange(activeTab === "market" ? null : "market")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "market"
              ? "bg-green-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          Market
        </button>
        <button
          onClick={() => onTabChange(activeTab === "expedition" ? null : "expedition")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "expedition"
              ? "bg-purple-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          Expedition
        </button>
        <button
          onClick={() => onTabChange(activeTab === "recruit" ? null : "recruit")}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "recruit"
              ? "bg-yellow-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          Recruit NPC
        </button>
      </div>

      <InventoryModal
        isOpen={activeTab === "inventory"}
        onClose={() => onTabChange(null)}
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
      />
    </>
  );
}

