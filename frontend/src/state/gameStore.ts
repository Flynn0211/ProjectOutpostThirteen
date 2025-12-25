import { create } from "zustand";

const DEV_CHEATS_KEY = "outpost.devCheatsUnlocked";

const readDevCheatsUnlocked = () => {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(DEV_CHEATS_KEY) === "1";
  } catch {
    return false;
  }
};

const persistDevCheatsUnlocked = (value: boolean) => {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DEV_CHEATS_KEY, value ? "1" : "0");
  } catch {
    // ignore storage failures
  }
};

type GameState = {
  flashingRooms: Record<number, number>; // roomIndex -> timestamp
  flashRoom: (roomIndex: number) => void;
  clearRoomFlash: (roomIndex: number) => void;

  devCheatsUnlocked: boolean;
  unlockDevCheats: () => void;
};

const FLASH_MS = 700;

export const useGameStore = create<GameState>((set, get) => ({
  flashingRooms: {},
  devCheatsUnlocked: readDevCheatsUnlocked(),
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

  unlockDevCheats: () => {
    persistDevCheatsUnlocked(true);
    set({ devCheatsUnlocked: true });
  },
}));
