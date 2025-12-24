import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID } from "../constants";

interface RecruitNPCModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RecruitNPCModal({ isOpen, onClose }: RecruitNPCModalProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [loading, setLoading] = useState(false);

  const handleRecruit = async () => {
    if (!account) return;

    setLoading(true);
    try {
      signAndExecute(
        {
          transaction: {
            kind: "moveCall",
            data: {
              package: PACKAGE_ID,
              module: "npc",
              function: "recruit_npc",
              arguments: [],
              typeArguments: [],
            },
          },
        },
        {
          onSuccess: () => {
            alert("NPC recruited!");
            onClose();
          },
          onError: (error) => {
            console.error("Recruit error:", error);
            alert("Recruit failed: " + error.message);
          },
        }
      );
    } catch (error: any) {
      console.error("Recruit error:", error);
      alert("Recruit failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Recruit NPC</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3 text-blue-200 text-sm">
            <strong>Cost:</strong> 0.1 SUI
            <br />
            <strong>Rarity:</strong> Random (70% Common → 0.1% Mythic)
            <br />
            <strong>Profession:</strong> Random (5 types)
          </div>

          <button
            onClick={handleRecruit}
            disabled={loading}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {loading ? "Recruiting..." : "Recruit NPC (0.1 SUI)"}
          </button>
        </div>
      </div>
    </div>
  );
}

