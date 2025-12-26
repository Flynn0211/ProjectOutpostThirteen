import { useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { showToast } from "../utils/toast";

export function useTransaction() {
    const { mutate: originalMutate, ...rest } = useSignAndExecuteTransactionBlock();

    const mutate = (
        { transactionBlock }: { transactionBlock: any },
        options?: { onSuccess?: (res: any) => void; onError?: (err: any) => void }
    ) => {
        originalMutate(
            { transactionBlock },
            {
                onSuccess: (res) => {
                    options?.onSuccess?.(res);
                },
                onError: (err: any) => {
                    const msg = err?.message || String(err);
                    console.error("Transaction failed:", msg);

                    // Check for gas/balance errors
                    if (
                        msg.includes("InsufficientBalance") || 
                        msg.includes("GasBalanceTooLow") || 
                        msg.includes("CoinBalance") ||
                        msg.includes("Balance calculation failed") // sometimes occurs if gas is technically missing
                    ) {
                        showToast(
                            "KHÔNG ĐỦ SUI!", 
                            "Bạn không đủ SUI để trả phí gas cho lệnh này.\nHãy nạp thêm SUI vào ví."
                        );
                    } else if (msg.includes("Rejected")) {
                        // User rejected, usually fine to ignore or show subtle message
                    } else {
                         // Generic error
                         showToast("Lệnh Thất Bại", "Đã có lỗi xảy ra. Kiểm tra console.");
                    }

                    options?.onError?.(err);
                }
            }
        );
    };

    return { mutate, ...rest };
}
