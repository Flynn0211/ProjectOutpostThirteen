import { useCurrentAccount, useWallets, useConnectWallet } from "@mysten/dapp-kit";

export function ConnectWallet() {
  const account = useCurrentAccount();
  const wallets = useWallets();
  const { mutate: connect } = useConnectWallet();

  if (account) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">
          Project Outpost Thirteen
        </h1>
        <p className="text-gray-300 mb-6 text-center">
          Connect your Sui wallet to start playing
        </p>
        <div className="space-y-3">
          {wallets.map((wallet) => (
            <button
              key={wallet.name}
              onClick={() => connect({ wallet: wallet })}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
            >
              Connect {wallet.name}
            </button>
          ))}
        </div>
        {wallets.length === 0 && (
          <p className="text-yellow-500 mt-4 text-center">
            No wallets detected. Please install a Sui wallet extension.
          </p>
        )}
      </div>
    </div>
  );
}

