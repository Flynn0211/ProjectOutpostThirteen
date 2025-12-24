import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { getFunctionName } from "../utils/sui";
import { PACKAGE_ID } from "../constants";

interface RaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  bunkerId: string;
}

export function RaidModal({ isOpen, onClose, bunkerId }: RaidModalProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [npcCount, setNpcCount] = useState(1);
  const [targetBunkerId, setTargetBunkerId] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleRaid = async () => {
    if (!account || !targetBunkerId) return;

    setLoading(true);
    try {
      // Get target bunker object
      const targetBunker = await fetch(`https://fullnode.testnet.sui.io:443`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sui_getObject",
          params: [targetBunkerId, { showContent: true }],
        }),
      }).then((res) => res.json());

      if (!targetBunker.result?.data) {
        alert("Invalid bunker ID");
        setLoading(false);
        return;
      }

      signAndExecute(
        {
          transaction: {
            kind: "moveCall",
            data: {
              package: PACKAGE_ID,
              module: "raid",
              function: "start_raid",
              arguments: [
                bunkerId,
                npcCount,
                targetBunkerId,
                // payment will be handled by wallet
              ],
              typeArguments: [],
            },
          },
        },
        {
          onSuccess: () => {
            alert("Raid started!");
            onClose();
          },
          onError: (error) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Raid Bunker</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-white mb-2">Target Bunker ID</label>
            <input
              type="text"
              value={targetBunkerId}
              onChange={(e) => setTargetBunkerId(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"
            />
          </div>

          <div>
            <label className="block text-white mb-2">NPC Count</label>
            <input
              type="number"
              min="1"
              value={npcCount}
              onChange={(e) => setNpcCount(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"
            />
          </div>

          <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3 text-yellow-200 text-sm">
            <strong>Cost:</strong> 50 Scrap + 0.1 SUI
            <br />
            <strong>Cooldown:</strong> 24 hours per target
            <br />
            <strong>Daily Limit:</strong> 3 raids per day
          </div>

          <button
            onClick={handleRaid}
            disabled={loading || !targetBunkerId}
            className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {loading ? "Raid in progress..." : "Start Raid"}
          </button>
        </div>
      </div>
    </div>
  );
}

