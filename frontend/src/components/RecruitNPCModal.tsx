import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { PACKAGE_ID, IMAGES } from "../constants";

interface RecruitNPCModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RecruitNPCModal({ isOpen, onClose, onSuccess }: RecruitNPCModalProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const [loading, setLoading] = useState(false);

  const sampleNPCs = IMAGES.npc.slice(0, 6);

  const handleRecruit = async () => {
    if (!account?.address) return;

    setLoading(true);
    try {
      const tx = new TransactionBlock();
      const [coin] = tx.splitCoins(tx.gas, [tx.pure(100_000_000)]); // 0.1 SUI
      tx.moveCall({
        target: `${PACKAGE_ID}::npc::recruit_npc`,
        arguments: [
          coin,
          tx.object("0x6"), // Clock object
        ],
      });
      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: (result: any) => {
            console.log("NPC recruited successfully:", result);
            // Wait a moment for transaction to settle, then reload
            setTimeout(() => {
              onClose();
              if (onSuccess) onSuccess();
            }, 1500);
          },
          onError: (error: any) => {
            console.error("Recruit error:", error);
            alert("Recruit failed: " + error.message);
            setLoading(false);
          },
        }
      );
    } catch (error: any) {
      console.error("Recruit error:", error);
      alert("Recruit failed: " + error.message);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fadeInScale">
      <div className="relative bg-gradient-to-br from-[#2a3447] via-[#1f2937] to-[#1a1f2e] border-[3px] border-[#4deeac] rounded-2xl p-8 max-w-lg w-full shadow-[0_0_50px_rgba(77,238,172,0.7),0_20px_80px_rgba(0,0,0,0.8)] transform transition-all duration-300">
        {/* Animated corner accents */}
        <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-[#5fffc0] rounded-tl-2xl" />
        <div className="absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 border-[#5fffc0] rounded-br-2xl" />
        
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-[#4deeac]/5 to-transparent animate-shimmer" />
        
        <div className="relative flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[#4deeac] rounded-full animate-pulse shadow-[0_0_10px_rgba(77,238,172,0.8)]" />
            <h2 className="text-3xl font-bold text-[#4deeac] uppercase tracking-wider drop-shadow-[0_0_10px_rgba(77,238,172,0.6)]">Recruit NPC</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#4deeac] hover:text-[#5fffc0] text-4xl font-bold transition-all duration-200 hover:rotate-90 hover:scale-110"
          >
            ×
          </button>
        </div>

        <div className="relative space-y-5">
          <div className="grid grid-cols-6 gap-3">
            {sampleNPCs.map((src, idx) => (
              <div key={idx} className="flex flex-col items-center text-white transform transition-all duration-200 hover:scale-110">
                <div className="w-20 h-20 bg-[#1a1f2e] rounded-lg border-2 border-[#4deeac] overflow-hidden shadow-[0_0_10px_rgba(77,238,172,0.3)] hover:shadow-[0_0_15px_rgba(77,238,172,0.6)] hover:border-[#5fffc0]">
                  <div
                    className="w-20 h-20 bg-contain bg-no-repeat bg-left"
                    style={{
                      backgroundImage: `url(${src})`,
                      backgroundPosition: "0px 0px",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0d1117] border-2 border-[#ffc107] rounded-xl p-4 shadow-[0_0_15px_rgba(255,193,7,0.3)]">
            <div className="text-[#ffc107] font-bold mb-2 uppercase tracking-wider flex items-center gap-2">
              <span>💰</span> Recruitment Info
            </div>
            <div className="text-white text-sm space-y-1">
              <div><strong className="text-[#4deeac]">Cost:</strong> 0.1 SUI</div>
              <div><strong className="text-[#4deeac]">Rarity:</strong> Random (70% Common → 0.1% Mythic)</div>
              <div><strong className="text-[#4deeac]">Profession:</strong> Random (5 types)</div>
            </div>
          </div>

          <button
            onClick={handleRecruit}
            disabled={loading}
            className="w-full px-6 py-4 bg-gradient-to-r from-[#4deeac] to-[#3dd69a] hover:from-[#5fffc0] hover:to-[#4deeac] disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-[#0d1117] rounded-xl font-bold uppercase tracking-wider transition-all duration-300 shadow-[0_0_25px_rgba(77,238,172,0.6)] hover:shadow-[0_0_35px_rgba(77,238,172,0.8)] hover:scale-105 disabled:shadow-none transform"
          >
            {loading ? "Recruiting..." : "👥 Recruit NPC (0.1 SUI)"}
          </button>
        </div>
      </div>
    </div>
  );
}

