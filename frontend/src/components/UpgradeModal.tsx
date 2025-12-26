import { useEffect, useMemo, useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { useQueryClient } from "@tanstack/react-query";
import type { Bunker } from "../types";
import { getObject } from "../utils/sui";
import { getBunkerUpgradeCost, PACKAGE_ID } from "../constants";
import { queryKeys } from "../query/queryKeys";
import { ModalShell } from "./ModalShell";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  bunkerId: string;
  onSuccess?: () => void;
}

export function UpgradeModal({
  isOpen,
  onClose,
  bunkerId,
  onSuccess,
}: UpgradeModalProps) {
  const account = useCurrentAccount();
  const ownerAddress = account?.address ?? "";
  const queryClient = useQueryClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();

  const [loading, setLoading] = useState(false);
  const [bunker, setBunker] = useState<Bunker | null>(null);

  useEffect(() => {
    if (!isOpen || !bunkerId) return;
    let cancelled = false;

    (async () => {
      try {
        const obj = await getObject(bunkerId);
        if (cancelled) return;
        setBunker(obj as Bunker);
      } catch {
        if (cancelled) return;
        setBunker(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, bunkerId]);

  const bunkerUpgradeCost = useMemo(() => {
    const level = Number((bunker as any)?.level ?? 1);
    return getBunkerUpgradeCost(level);
  }, [bunker]);

  const handleUpgradeBunker = async () => {
    if (!account?.address || !bunkerId) return;

    setLoading(true);
    try {
      const tx = new TransactionBlock();
      tx.moveCall({
        target: `${PACKAGE_ID}::bunker::upgrade_bunker`,
        arguments: [tx.object(bunkerId), tx.object("0x6")],
      });

      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.ownedRoot(ownerAddress) });
            setLoading(false);
            onSuccess?.();
            onClose();
          },
          onError: (error: any) => {
            alert("Upgrade bunker failed: " + (error?.message ?? String(error)));
            setLoading(false);
          },
        }
      );
    } catch (e: any) {
      alert("Upgrade bunker failed: " + (e?.message ?? String(e)));
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalShell open={isOpen} title="Upgrade" onClose={onClose} className="max-w-3xl">
      <div className="space-y-4">
        <div className="vault-card p-4">
          <div className="terminal-glow font-orbitron font-bold text-sm tracking-wider">Bunker Upgrade</div>
          <div className="text-muted-foreground text-sm mt-2">
            Current level: <span className="text-foreground font-bold">{Number((bunker as any)?.level ?? 0)}</span>
          </div>
          <div className="text-muted-foreground text-sm mt-1">
            Cost: <span className="text-foreground font-bold">{bunkerUpgradeCost} Scrap</span>
          </div>
        </div>

        <button
          onClick={handleUpgradeBunker}
          disabled={loading || !bunkerId}
          className="vault-button w-full disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Upgrading..." : "Upgrade Bunker"}
        </button>
      </div>
    </ModalShell>
  );
}
