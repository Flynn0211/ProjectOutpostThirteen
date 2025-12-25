import { create } from "zustand";

type GameState = {
  flashingRooms: Record<number, number>; // roomIndex -> timestamp
  flashRoom: (roomIndex: number) => void;
  clearRoomFlash: (roomIndex: number) => void;
};

const FLASH_MS = 700;

export const useGameStore = create<GameState>((set, get) => ({
  flashingRooms: {},
  flashRoom: (roomIndex) => {
    const now = Date.now();
    set((s) => ({
      flashingRooms: { ...s.flashingRooms, [roomIndex]: now },
    }));

    window.setTimeout(() => {
      // Only clear if this flash is still the latest
      const ts = get().flashingRooms[roomIndex];
      if (ts === now) {
        set((s) => {
          const next = { ...s.flashingRooms };
          delete next[roomIndex];
          return { flashingRooms: next };
        });
      }
    }, FLASH_MS);
  },
  clearRoomFlash: (roomIndex) => {
    set((s) => {
      const next = { ...s.flashingRooms };
      delete next[roomIndex];
      return { flashingRooms: next };
    });
  },
}));
