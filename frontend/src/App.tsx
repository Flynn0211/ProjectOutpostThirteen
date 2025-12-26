import { useState, useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { ConnectWallet } from "./components/ConnectWallet";
import { WalletButton } from "./components/WalletButton";
import { BunkerView } from "./components/BunkerView";
import { Toolbar } from "./components/Toolbar";
import { ToastHost } from "./components/ToastHost";
import { NotificationLogModal } from "./components/NotificationLogModal";
import { RoomDetailModal } from "./components/RoomDetailModal";

type ToolbarTab =
  | "inventory"
  | "raid"
  | "market"
  | "expedition"
  | "recruit"
  | "npc-manager"
  | "logs" // New tab
  | "upgrade"
  | null;

function App() {
  const account = useCurrentAccount();
  const [activeTab, setActiveTab] = useState<ToolbarTab>(null);
  const [bunkerId, setBunkerId] = useState<string | undefined>();
  const [refreshTick, setRefreshTick] = useState(0);
  const [roomDetailIndex, setRoomDetailIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    console.log("App mounted");
    // eslint-disable-next-line
    setMounted(true);
  }, []);

  useEffect(() => {
    console.log("App rendering, account:", account);
  }, [account]);

  if (!mounted) {
    return (
      <div className="w-full h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">Initializing...</div>
      </div>
    );
  }

  if (!account?.address) {
    console.log("No account, showing ConnectWallet");
    return <ConnectWallet />;
  }

  console.log("Account found, showing BunkerView");
  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0d1117]">
      {/* Decorative background layers - Fallout style */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -left-24 -top-24 w-96 h-96 rounded-full bg-[radial-gradient(circle,rgba(77,238,172,0.15),transparent_60%)] blur-3xl" />
        <div className="absolute right-0 top-1/3 w-80 h-80 rounded-full bg-[radial-gradient(circle,rgba(255,193,7,0.12),transparent_60%)] blur-3xl" />
        <div className="absolute left-1/3 bottom-0 w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(77,238,172,0.08),transparent_65%)] blur-3xl" />
      </div>

      <BunkerView
        onBunkerLoaded={setBunkerId}
        refreshTick={refreshTick}
        onOpenUpgradeBunker={() => {
          setActiveTab("upgrade");
        }}
        onOpenRoomDetail={(roomIndex) => {
          setRoomDetailIndex(roomIndex);
        }}
      />
      <Toolbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        bunkerId={bunkerId}
        onRefresh={() => {
          setActiveTab(null);
          setRefreshTick((t) => t + 1);
        }}
      />
      {activeTab === "logs" && (
        <NotificationLogModal onClose={() => setActiveTab(null)} />
      )}
      
      {bunkerId && roomDetailIndex !== null && (
        <RoomDetailModal
          isOpen={true}
          onClose={() => setRoomDetailIndex(null)}
          bunkerId={bunkerId}
          roomIndex={roomDetailIndex}
        />
      )}
      <ToastHost />
      <div className="absolute top-4 right-4 z-50">
        <WalletButton />
      </div>
    </div>
  );
}

export default App;
