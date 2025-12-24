import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { PACKAGE_ID } from "../constants";

interface CreateBunkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateBunkerModal({ isOpen, onClose, onSuccess }: CreateBunkerModalProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [bunkerName, setBunkerName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!account || !bunkerName.trim()) return;

    setLoading(true);
    try {
      const nameBytes = new TextEncoder().encode(bunkerName);
      
      signAndExecute(
        {
          transaction: {
            kind: "moveCall",
            data: {
              package: PACKAGE_ID,
              module: "bunker",
              function: "create_bunker",
              arguments: [nameBytes],
              typeArguments: [],
            },
          },
        },
        {
          onSuccess: () => {
            alert("Bunker created!");
            onSuccess();
            onClose();
          },
          onError: (error) => {
            console.error("Create bunker error:", error);
            alert("Failed to create bunker: " + error.message);
          },
        }
      );
    } catch (error: any) {
      console.error("Create bunker error:", error);
      alert("Failed to create bunker: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Create Bunker</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-white mb-2">Bunker Name</label>
            <input
              type="text"
              value={bunkerName}
              onChange={(e) => setBunkerName(e.target.value)}
              placeholder="Enter bunker name"
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg"
              maxLength={50}
            />
          </div>

          <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3 text-blue-200 text-sm">
            Your bunker will start with:
            <br />• 1 Living Quarters
            <br />• 1 Generator
            <br />• 1 Farm
            <br />• 1 Water Pump
            <br />• 100 Food, 100 Water, 50 Scrap
          </div>

          <button
            onClick={handleCreate}
            disabled={loading || !bunkerName.trim()}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
          >
            {loading ? "Creating..." : "Create Bunker"}
          </button>
        </div>
      </div>
    </div>
  );
}

