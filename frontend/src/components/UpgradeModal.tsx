import { useEffect, useMemo, useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { useQueryClient } from "@tanstack/react-query";
import type { Bunker } from "../types";
import { getObject } from "../utils/sui";
import { PACKAGE_ID } from "../constants";
import { queryKeys } from "../query/queryKeys";

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
    return 100 * Math.max(1, level);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fadeInScale">
      <div className="relative bg-gradient-to-br from-[#2a3447] via-[#1f2937] to-[#1a1f2e] border-[3px] border-[#4deeac] rounded-2xl p-8 max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-[0_0_50px_rgba(77,238,172,0.7),0_20px_80px_rgba(0,0,0,0.8)] transform transition-all duration-300">
        <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-[#5fffc0] rounded-tl-2xl" />
        <div className="absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 border-[#5fffc0] rounded-br-2xl" />
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-[#4deeac]/5 to-transparent animate-shimmer" />

        <div className="relative flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[#4deeac] rounded-full animate-pulse shadow-[0_0_10px_rgba(77,238,172,0.8)]" />
            <h2 className="text-3xl font-bold text-[#4deeac] uppercase tracking-wider drop-shadow-[0_0_10px_rgba(77,238,172,0.6)]">
              Upgrade
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[#4deeac] hover:text-[#5fffc0] text-4xl font-bold transition-all duration-200 hover:rotate-90 hover:scale-110"
          >
            ×
          </button>
        </div>

        <div className="relative space-y-4">
          <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0d1117] border-2 border-[#4deeac] rounded-xl p-4">
            <div className="text-[#4deeac] font-bold uppercase text-sm tracking-wider">Bunker Upgrade</div>
            <div className="text-white/80 text-sm mt-2">
              Current level: <span className="text-white font-bold">{Number((bunker as any)?.level ?? 0)}</span>
            </div>
            <div className="text-white/80 text-sm mt-1">
              Cost: <span className="text-white font-bold">{bunkerUpgradeCost} Scrap</span>
            </div>
          </div>

          <button
            onClick={handleUpgradeBunker}
            disabled={loading || !bunkerId}
            className="w-full px-6 py-4 bg-gradient-to-r from-[#4deeac] to-[#3dd69a] hover:from-[#5fffc0] hover:to-[#4deeac] disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-[#0d1117] rounded-xl font-bold uppercase tracking-wider transition-all duration-300 shadow-[0_0_25px_rgba(77,238,172,0.6)] hover:shadow-[0_0_35px_rgba(77,238,172,0.8)] hover:scale-105 disabled:shadow-none transform"
          >
            {loading ? "Upgrading..." : "⬆️ Upgrade Bunker"}
          </button>
        </div>
      </div>
    </div>
  );
}
