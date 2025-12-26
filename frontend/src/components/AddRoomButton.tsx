import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { PACKAGE_ID, ROOM_TYPES, ROOM_TYPE_NAMES } from "../constants";

interface AddRoomButtonProps {
  bunkerId: string;
  onSuccess: () => void;
}

export function AddRoomButton({ bunkerId, onSuccess }: AddRoomButtonProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransactionBlock();
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(false);

  const roomOptions = [
    { type: ROOM_TYPES.LIVING, name: ROOM_TYPE_NAMES[ROOM_TYPES.LIVING], icon: "🛏️" },
    { type: ROOM_TYPES.GENERATOR, name: ROOM_TYPE_NAMES[ROOM_TYPES.GENERATOR], icon: "⚡" },
    { type: ROOM_TYPES.FARM, name: ROOM_TYPE_NAMES[ROOM_TYPES.FARM], icon: "🌾" },
    { type: ROOM_TYPES.WATER_PUMP, name: ROOM_TYPE_NAMES[ROOM_TYPES.WATER_PUMP], icon: "💧" },
    { type: ROOM_TYPES.WORKSHOP, name: ROOM_TYPE_NAMES[ROOM_TYPES.WORKSHOP], icon: "🔧" },
    { type: ROOM_TYPES.STORAGE, name: ROOM_TYPE_NAMES[ROOM_TYPES.STORAGE], icon: "📦" },
  ];

  const handleAddRoom = async (roomType: number) => {
    if (!account?.address || !bunkerId) {
      alert("Missing account or bunker. Please create a bunker first.");
      return;
    }

    setLoading(true);
    try {
      const tx = new TransactionBlock();
      tx.moveCall({
        target: `${PACKAGE_ID}::bunker::add_room`,
        arguments: [
          tx.object(bunkerId),
          tx.pure(roomType, "u8"),
        ],
      });
      signAndExecute(
        { transactionBlock: tx },
        {
          onSuccess: () => {
            console.log("Room added successfully");
            setShowMenu(false);
            setTimeout(() => {
              onSuccess();
            }, 1000);
          },
          onError: (error: any) => {
            console.error("Add room error:", error);
            alert("Failed to add room: " + error.message);
            setLoading(false);
          },
        }
      );
    } catch (error: any) {
      console.error("Add room error:", error);
      alert("Failed to add room: " + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="w-96 h-48 border-2 border-dashed border-primary rounded-sm flex items-center justify-center text-6xl text-primary hover:bg-primary/10 transition-all"
      >
        +
      </button>

      {showMenu && (
        <div className="absolute top-0 left-0 vault-card p-3 w-96 z-50">
          <div className="text-primary text-sm font-orbitron font-bold mb-2 uppercase tracking-wider">Add Room</div>
          <div className="space-y-2">
            {roomOptions.map((option) => (
              <button
                key={option.type}
                onClick={() => handleAddRoom(option.type)}
                disabled={loading}
                className="w-full px-3 py-2 bg-background/40 hover:bg-primary hover:text-primary-foreground disabled:opacity-60 disabled:cursor-not-allowed text-primary border border-primary rounded-sm text-sm font-bold transition-all flex items-center gap-2"
              >
                <span>{option.icon}</span>
                <span>{option.name}</span>
                <span className="ml-auto text-xs">150 Scrap</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
