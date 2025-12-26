import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";

export function BalanceDisplay() {
    const account = useCurrentAccount();
    const { data: balance } = useSuiClientQuery("getBalance", {
        owner: account?.address || "",
    }, {
        enabled: !!account,
        refetchInterval: 5000 // Refresh every 5s
    });

    if (!balance || !account) return null;

    // Convert MIST to SUI (1 SUI = 1,000,000,000 MIST)
    const suiBalance = (parseInt(balance.totalBalance) / 1_000_000_000).toFixed(2);

    return (
        <div className="bg-[#0d1117] border border-[#4deeac] rounded px-3 py-1.5 flex items-center gap-2 shadow-[0_0_10px_rgba(77,238,172,0.2)]">
            <span className="text-[#4deeac] font-bold text-sm tracking-wide">
                {suiBalance} SUI
            </span>
        </div>
    );
}
