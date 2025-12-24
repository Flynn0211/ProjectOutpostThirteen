import { ReactNode } from "react";
import { 
  createNetworkConfig, 
  SuiClientProvider, 
  WalletProvider as SuiWalletProvider 
} from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui.js/client";
import { NETWORK } from "../constants";

const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl("testnet") },
  mainnet: { url: getFullnodeUrl("mainnet") },
});

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <SuiClientProvider networks={networkConfig} defaultNetwork={NETWORK}>
      <SuiWalletProvider
        autoConnect
        storedWallet="Sui Wallet"
      >
        {children}
      </SuiWalletProvider>
    </SuiClientProvider>
  );
}

