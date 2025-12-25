import type { ReactNode } from "react";
import { 
  createNetworkConfig, 
  SuiClientProvider, 
  WalletProvider as SuiWalletProvider 
} from "@mysten/dapp-kit";
import "@mysten/dapp-kit/dist/index.css";

// Lưu ý: Nếu bước trước bạn đã cài @mysten/sui, hãy đổi thành "@mysten/sui/client"
import { getFullnodeUrl } from "@mysten/sui.js/client";
import { NETWORK } from "../constants";
// ----------------------- Thêm phần này để cấu hình React Query
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient();
// -----------------------

const { networkConfig } = createNetworkConfig({
  testnet: { url: getFullnodeUrl("testnet") },
  mainnet: { url: getFullnodeUrl("mainnet") },
});

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    // Bao bọc QueryClientProvider ở ngoài cùng
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={NETWORK as "testnet" | "mainnet"}>
        <SuiWalletProvider autoConnect>
          {children}
        </SuiWalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}