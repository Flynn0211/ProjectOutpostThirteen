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

const isRateLimitError = (error: unknown): boolean => {
  const anyErr = error as any;
  const status = anyErr?.status ?? anyErr?.response?.status;
  if (status === 429) return true;
  const msg = String(anyErr?.message ?? "");
  return msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("Unexpected status code: 429");
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Prevent hidden refetch sources (focus/reconnect/mount) from amplifying load.
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: (failureCount, error) => {
        if (isRateLimitError(error)) return failureCount < 1;
        return failureCount < 2;
      },
      retryDelay: (failureCount, error) => {
        const base = isRateLimitError(error) ? 2000 : 600;
        return Math.min(base * 2 ** failureCount, 30000);
      },
    },
  },
});
// -----------------------

const getRpcUrl = (net: "testnet" | "mainnet") => {
  // Mysten public fullnodes can block browser CORS. In dev, route through Vite proxy.
  if (import.meta.env.DEV) return net === "testnet" ? "/sui-testnet" : "/sui-mainnet";
  return getFullnodeUrl(net);
};

const { networkConfig } = createNetworkConfig({
  testnet: { url: getRpcUrl("testnet") },
  mainnet: { url: getRpcUrl("mainnet") },
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