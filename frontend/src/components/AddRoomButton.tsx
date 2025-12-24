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
        className="w-96 h-48 border-4 border-dashed border-[#4deeac] rounded-xl flex items-center justify-center text-6xl text-[#4deeac] hover:border-[#5fffc0] hover:text-[#5fffc0] transition-all hover:bg-[#4deeac]/10 hover:shadow-[0_0_20px_rgba(77,238,172,0.3)]"
      >
        +
      </button>

      {showMenu && (
        <div className="absolute top-0 left-0 bg-[#2a3447] border-3 border-[#4deeac] rounded-xl p-3 w-96 z-50 shadow-[0_0_25px_rgba(77,238,172,0.5)]">
          <div className="text-[#4deeac] text-sm font-bold mb-2 uppercase tracking-wider">Add Room</div>
          <div className="space-y-2">
            {roomOptions.map((option) => (
              <button
                key={option.type}
                onClick={() => handleAddRoom(option.type)}
                disabled={loading}
                className="w-full px-3 py-2 bg-[#1a1f2e] hover:bg-[#4deeac] hover:text-[#1a1f2e] disabled:bg-gray-500 disabled:cursor-not-allowed text-[#4deeac] border-2 border-[#4deeac] rounded text-sm font-bold transition-all flex items-center gap-2"
              >
                <span>{option.icon}</span>
                <span>{option.name}</span>
                <span className="ml-auto text-xs">{option.type === ROOM_TYPES.WORKSHOP ? "150 Scrap" : "150 Scrap"}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
