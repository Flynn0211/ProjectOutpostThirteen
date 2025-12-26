import { useState, useEffect } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { ConnectWallet } from "./components/ConnectWallet";
import { WalletButton } from "./components/WalletButton";
import { BunkerView } from "./components/BunkerView";
import { Toolbar, type ToolbarTab } from "./components/Toolbar";
import { ToastHost } from "./components/ToastHost";
import { NotificationLogModal } from "./components/NotificationLogModal";
import { RoomDetailModal } from "./components/RoomDetailModal";
import { SwooshLayout } from "./components/SwooshLayout";

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
    <SwooshLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      headerRight={<WalletButton />}
    >
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
        hideBar
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
    </SwooshLayout>
  );
}

export default App;
