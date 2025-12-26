import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { PACKAGE_ID } from "../constants";
import { getBlueprintImageUrl } from "../utils/imageUtils";
import { ModalShell } from "./ModalShell";

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
    <ModalShell open={isOpen} title="Create Bunker" onClose={onClose} className="max-w-lg">
      <div className="space-y-5">
        <div className="w-full">
          <img
            src={blueprintUrl}
            alt="Blueprint"
            className="w-full h-48 object-cover rounded-sm border-2 border-primary"
          />
        </div>

        <div>
          <label className="block text-primary font-orbitron font-bold mb-3 uppercase text-sm tracking-wider">
            Bunker Name
          </label>
          <input
            type="text"
            value={bunkerName}
            onChange={(e) => setBunkerName(e.target.value)}
            placeholder="Enter bunker name"
            className="w-full px-4 py-3 bg-background/40 text-foreground border border-border rounded-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
            maxLength={50}
          />
        </div>

        <div className="bg-card border-2 border-accent rounded-sm p-4">
          <div className="text-accent font-orbitron font-bold mb-2 uppercase tracking-wider flex items-center gap-2">
            <span>⚡</span> Starting Resources
          </div>
          <div className="text-muted-foreground text-sm space-y-1">
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
          className="vault-button w-full disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Creating..." : "Create Bunker"}
        </button>
      </div>
    </ModalShell>
  );
}

