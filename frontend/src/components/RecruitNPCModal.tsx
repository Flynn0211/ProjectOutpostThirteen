import { useState, useEffect } from "react";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { useQueryClient } from "@tanstack/react-query";
import { BUNKER_NPC_LEDGER_ID, PACKAGE_ID, IMAGES } from "../constants";
import { SpriteSheet } from "./SpriteSheet";
import { generateRandomName } from "../utils/nameGenerator";
import { getOwnedObjects, getObjectType } from "../utils/sui";
import { postTxRefresh } from "../utils/postTxRefresh";

interface RecruitNPCModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RecruitNPCModal({ isOpen, onClose, onSuccess }: RecruitNPCModalProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [recruitCount, setRecruitCount] = useState(1);
  const [bunkerId, setBunkerId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line
      setLoading(false);
      setRecruitCount(1);
    }
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen || !account?.address) return;

    let cancelled = false;
    (async () => {
      try {
        const bunkers = await getOwnedObjects(account.address, getObjectType("bunker", "Bunker"));
        const first = (bunkers as any[]).find((b) => !!b && !!(b as any).id);
        if (!cancelled) setBunkerId(first?.id ?? null);
      } catch (e) {
        console.error("Error loading bunker for recruit:", e);
        if (!cancelled) setBunkerId(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, account?.address]);

  const sampleNPCs = IMAGES.npc.slice(0, 6);

  const handleRecruit = async () => {
    if (!account?.address) return;

    if (!bunkerId) {
      alert("You need a Bunker before recruiting NPCs.");
      return;
    }

    if (!BUNKER_NPC_LEDGER_ID) {
      alert("Missing config: VITE_BUNKER_NPC_LEDGER_ID");
      return;
    }

    setLoading(true);
    try {
      const tx = new TransactionBlock();
      // Create an array of recruit costs [100000000, 100000000, ...] based on count
      const amounts = Array(recruitCount).fill(tx.pure(100_000_000));
      
      const coins = tx.splitCoins(tx.gas, amounts);

      console.log(`Recruiting ${recruitCount} NPCs...`);

      for (let i = 0; i < recruitCount; i++) {
          const randomName = generateRandomName();
          tx.moveCall({
            target: `${PACKAGE_ID}::npc::recruit_npc`,
            arguments: [
              tx.object(bunkerId),
              tx.object(BUNKER_NPC_LEDGER_ID),
              coins[i],
              tx.pure(randomName, "string"),
              tx.object("0x6"), // Clock object
            ],
          });
      }

      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: (result: any) => {
            console.log("Batch recruit successful:", result);
            // Wait a moment for transaction to settle, then reload
            setTimeout(() => {
              if (account?.address) {
                postTxRefresh(queryClient, account.address);
                window.setTimeout(() => postTxRefresh(queryClient, account.address!), 1200);
              }
              setLoading(false);
              onClose();
              if (onSuccess) onSuccess();
            }, 1500 + (recruitCount * 100)); // Slightly longer delay for batch
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
            Ãƒâ€”
          </button>
        </div>

        <div className="relative space-y-5">
          <div className="grid grid-cols-6 gap-3">
            {sampleNPCs.map((src, idx) => (
              <div key={idx} className="flex flex-col items-center text-white transform transition-all duration-200 hover:scale-110">
                <div className="w-20 h-20 bg-[#1a1f2e] rounded-lg border-2 border-[#4deeac] overflow-hidden shadow-[0_0_10px_rgba(77,238,172,0.3)] hover:shadow-[0_0_15px_rgba(77,238,172,0.6)] hover:border-[#5fffc0]">
                  <div style={{ transform: "scale(0.625)", transformOrigin: "top left" }}>
                    <SpriteSheet src={src} frameWidth={128} frameHeight={128} fps={12} playing={true} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0d1117] border-2 border-[#ffc107] rounded-xl p-4 shadow-[0_0_15px_rgba(255,193,7,0.3)]">
            <div className="text-[#ffc107] font-bold mb-2 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-2">Ã°Å¸â€™Â° Recruitment Info</span>
              <span className="text-white text-xs bg-white/10 px-2 py-0.5 rounded">Batch Mode</span>
            </div>
            <div className="text-white text-sm space-y-1">
              <div><strong className="text-[#4deeac]">Cost:</strong> 0.1 SUI / NPC</div>
              <div><strong className="text-[#4deeac]">Rarity:</strong> Random (70% Common Ã¢â€ â€™ 0.1% Mythic)</div>
              
              <div className="pt-3 border-t border-white/10 mt-2">
                 <label className="flex items-center justify-between mb-2">
                     <span className="font-bold text-[#4deeac]">Quantity: {recruitCount}</span>
                     <span className="text-white font-bold">Total: {(recruitCount * 0.1).toFixed(1)} SUI</span>
                 </label>
                 <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={recruitCount}
                    onChange={(e) => setRecruitCount(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#4deeac]"
                 />
                 <div className="flex justify-between text-[10px] text-gray-500 mt-1 px-1">
                     <span>1</span>
                     <span>5</span>
                     <span>10</span>
                 </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleRecruit}
            disabled={loading}
            className="w-full px-6 py-4 bg-gradient-to-r from-[#4deeac] to-[#3dd69a] hover:from-[#5fffc0] hover:to-[#4deeac] disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-[#0d1117] rounded-xl font-bold uppercase tracking-wider transition-all duration-300 shadow-[0_0_25px_rgba(77,238,172,0.6)] hover:shadow-[0_0_35px_rgba(77,238,172,0.8)] hover:scale-105 disabled:shadow-none transform"
          >
            {loading ? `Recruiting ${recruitCount} NPCs...` : `Ã°Å¸â€˜Â¥ Recruit ${recruitCount} NPC${recruitCount > 1 ? 's' : ''} (${(recruitCount * 0.1).toFixed(1)} SUI)`}
          </button>
        </div>
      </div>
    </div>
  );
}

