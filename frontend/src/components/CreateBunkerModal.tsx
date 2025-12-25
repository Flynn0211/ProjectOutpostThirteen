import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { PACKAGE_ID } from "../constants";
import { getBlueprintImageUrl } from "../utils/imageUtils";

interface CreateBunkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateBunkerModal({ isOpen, onClose, onSuccess }: CreateBunkerModalProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const [bunkerName, setBunkerName] = useState("");
  const [loading, setLoading] = useState(false);
  const blueprintUrl = getBlueprintImageUrl();

  const handleCreate = async () => {
    if (!account?.address || !bunkerName.trim()) return;

    setLoading(true);
    try {
      const tx = new TransactionBlock();
      tx.moveCall({
        target: `${PACKAGE_ID}::bunker::create_bunker`,
        arguments: [
          tx.pure(bunkerName),
          tx.object("0x6"), // Clock object
        ],
      });
      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: (result: any) => {
            console.log("Bunker created successfully:", result);
            // Wait a moment for transaction to settle, then reload
            setTimeout(() => {
              onSuccess();
              onClose();
            }, 1500);
          },
          onError: (error: any) => {
            console.error("Create bunker error:", error);
            alert("Failed to create bunker: " + error.message);
            setLoading(false);
          },
        }
      );
    } catch (error: any) {
      console.error("Create bunker error:", error);
      alert("Failed to create bunker: " + error.message);
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
            <h2 className="text-3xl font-bold text-[#4deeac] uppercase tracking-wider drop-shadow-[0_0_10px_rgba(77,238,172,0.6)]">Create Bunker</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#4deeac] hover:text-[#5fffc0] text-4xl font-bold transition-all duration-200 hover:rotate-90 hover:scale-110"
          >
            ×
          </button>
        </div>

        <div className="relative space-y-5">
          <div className="w-full">
            <img
              src={blueprintUrl}
              alt="Blueprint"
              className="w-full h-48 object-cover rounded-xl border-3 border-[#4deeac] shadow-[0_0_20px_rgba(77,238,172,0.4)]"
            />
          </div>
          <div>
            <label className="block text-[#4deeac] font-bold mb-3 uppercase text-sm tracking-wider">Bunker Name</label>
            <input
              type="text"
              value={bunkerName}
              onChange={(e) => setBunkerName(e.target.value)}
              placeholder="Enter bunker name"
              className="w-full px-5 py-3 bg-[#1a1f2e] text-white border-2 border-[#4deeac] rounded-xl focus:outline-none focus:border-[#5fffc0] focus:shadow-[0_0_20px_rgba(77,238,172,0.5)] transition-all duration-200"
              maxLength={50}
            />
          </div>

          <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0d1117] border-2 border-[#ffc107] rounded-xl p-4 shadow-[0_0_15px_rgba(255,193,7,0.3)]">
            <div className="text-[#ffc107] font-bold mb-2 uppercase tracking-wider flex items-center gap-2">
              <span>⚡</span> Starting Resources
            </div>
            <div className="text-white text-sm space-y-1">
              <div>• 1 Living Quarters</div>
              <div>• 1 Generator</div>
              <div>• 1 Farm</div>
              <div>• 1 Water Pump</div>
              <div>• 100 Food, 100 Water, 50 Scrap</div>
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading || !bunkerName.trim()}
            className="w-full px-6 py-4 bg-gradient-to-r from-[#4deeac] to-[#3dd69a] hover:from-[#5fffc0] hover:to-[#4deeac] disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-[#0d1117] rounded-xl font-bold uppercase tracking-wider transition-all duration-300 shadow-[0_0_25px_rgba(77,238,172,0.6)] hover:shadow-[0_0_35px_rgba(77,238,172,0.8)] hover:scale-105 disabled:shadow-none transform"
          >
            {loading ? "Creating..." : "🚀 Create Bunker"}
          </button>
        </div>
      </div>
    </div>
  );
}

