import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { PACKAGE_ID, RAID_HISTORY_OBJECT_ID } from "../constants";

interface RaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  bunkerId: string;
}

export function RaidModal({ isOpen, onClose, bunkerId }: RaidModalProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const [npcCount, setNpcCount] = useState(1);
  const [targetBunkerId, setTargetBunkerId] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setTargetBunkerId(text.trim());
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  };

  const handleRaid = async () => {
    if (!account?.address || !targetBunkerId) {
      alert("Missing target bunker ID.");
      return;
    }

    if (!RAID_HISTORY_OBJECT_ID || RAID_HISTORY_OBJECT_ID.includes("00000000")) {
       alert("Raid History Object ID is not configured (placeholder). Cannot start raid.");
       return;
    }

    setLoading(true);
    try {
      const tx = new TransactionBlock();
      const [coin] = tx.splitCoins(tx.gas, [tx.pure(100_000_000)]); // 0.1 SUI
      tx.moveCall({
        target: `${PACKAGE_ID}::raid::start_raid`,
        arguments: [
          tx.object(bunkerId),
          tx.pure(npcCount, "u64"),
          tx.object(targetBunkerId),
          coin,
          tx.object(RAID_HISTORY_OBJECT_ID),
          tx.object("0x6"), // Clock
        ],
      });
      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: () => {
            alert("Raid started! Check result in Logs.");
            onClose();
          },
          onError: (error: any) => {
            console.error("Raid error:", error);
            alert("Raid failed: " + error.message);
          },
        }
      );
    } catch (error: any) {
      console.error("Raid error:", error);
      alert("Raid failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fadeInScale">
      <div className="relative bg-gradient-to-br from-[#2a3447] via-[#1f2937] to-[#1a1f2e] border-[3px] border-[#4deeac] rounded-2xl p-8 max-w-lg w-full shadow-[0_0_50px_rgba(77,238,172,0.7),0_20px_80px_rgba(0,0,0,0.8)] transform transition-all duration-300">
        {/* Accents */}


        {/* Glow */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-[#4deeac]/5 to-transparent animate-shimmer" />

        <div className="relative flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[#4deeac] rounded-full animate-pulse shadow-[0_0_10px_rgba(77,238,172,0.8)]" />
            <h2 className="text-3xl font-bold text-[#4deeac] uppercase tracking-wider drop-shadow-[0_0_10px_rgba(77,238,172,0.6)]">Raid Bunker</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#4deeac] hover:text-[#5fffc0] text-4xl font-bold transition-all duration-200 hover:rotate-90 hover:scale-110"
          >
            ×
          </button>
        </div>

        <div className="relative space-y-5">
          <div>
            <label className="block text-[#4deeac] font-bold mb-2 uppercase text-sm tracking-wider">Target Bunker ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={targetBunkerId}
                onChange={(e) => setTargetBunkerId(e.target.value)}
                placeholder="0x..."
                className="flex-1 px-5 py-3 bg-[#1a1f2e] text-white border-2 border-[#4deeac] rounded-xl focus:outline-none focus:border-[#5fffc0] focus:shadow-[0_0_20px_rgba(77,238,172,0.5)] transition-all duration-200"
              />
              <button
                onClick={handlePaste}
                className="px-4 py-3 bg-[#1a1f2e] text-[#4deeac] border-2 border-[#4deeac] rounded-xl hover:bg-[#4deeac] hover:text-[#1a1f2e] font-bold transition-all"
                title="Paste from clipboard"
              >
                📋
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[#4deeac] font-bold mb-2 uppercase text-sm tracking-wider">NPC Count (Attack Force)</label>
            <input
              type="number"
              min={1}
              value={npcCount}
              onChange={(e) => setNpcCount(parseInt(e.target.value) || 1)}
              className="w-full px-5 py-3 bg-[#1a1f2e] text-white border-2 border-[#4deeac] rounded-xl focus:outline-none focus:border-[#5fffc0] focus:shadow-[0_0_20px_rgba(77,238,172,0.5)] transition-all duration-200"
            />
          </div>

          <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0d1117] border-2 border-[#ffc107] rounded-xl p-4 shadow-[0_0_15px_rgba(255,193,7,0.3)]">
            <div className="text-[#ffc107] font-bold mb-2 uppercase tracking-wider flex items-center gap-2">
              <span>⚠️</span> Raid Rules
            </div>
            <div className="text-white text-sm space-y-1">
              <div><strong className="text-[#4deeac]">Cost:</strong> 50 Scrap + 0.1 SUI</div>
              <div><strong className="text-[#4deeac]">Cooldown:</strong> 24 hours per target</div>
              <div><strong className="text-[#4deeac]">Daily Limit:</strong> 3 raids per day</div>
            </div>
          </div>

          <button
            onClick={handleRaid}
            disabled={loading || !targetBunkerId}
            className="w-full px-6 py-4 bg-gradient-to-r from-[#ff6b35] to-[#ffc107] hover:from-[#ffc107] hover:to-[#ff6b35] disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-[#0d1117] rounded-xl font-bold uppercase tracking-wider transition-all duration-300 shadow-[0_0_25px_rgba(255,107,53,0.5)] hover:shadow-[0_0_35px_rgba(255,193,7,0.6)] hover:scale-105 disabled:shadow-none transform"
          >
            {loading ? "Raid in progress..." : "🚨 Start Raid"}
          </button>
        </div>
      </div>
    </div>
  );
}
