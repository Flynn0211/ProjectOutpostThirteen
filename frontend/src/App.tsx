import { useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { ConnectWallet } from "./components/ConnectWallet";
import { WalletButton } from "./components/WalletButton";
import { BunkerView } from "./components/BunkerView";
import { Toolbar } from "./components/Toolbar";

type ToolbarTab = "inventory" | "raid" | "market" | "expedition" | "recruit" | null;

function App() {
  const account = useCurrentAccount();
  const [activeTab, setActiveTab] = useState<ToolbarTab>(null);
  const [bunkerId, setBunkerId] = useState<string | undefined>();

  if (!account) {
    return <ConnectWallet />;
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <BunkerView onBunkerLoaded={setBunkerId} />
      <Toolbar activeTab={activeTab} onTabChange={setActiveTab} bunkerId={bunkerId} />
      <div className="absolute top-4 right-4 z-50">
        <WalletButton />
      </div>
    </div>
  );
}

export default App;
