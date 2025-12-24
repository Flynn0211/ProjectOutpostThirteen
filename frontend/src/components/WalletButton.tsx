import { useCurrentAccount, useDisconnectWallet } from "@mysten/dapp-kit";
import { formatAddress } from "@mysten/sui.js/utils";

export function WalletButton() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();

  if (!account) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-300">
        {formatAddress(account.address)}
      </span>
      <button
        onClick={() => disconnect()}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}

