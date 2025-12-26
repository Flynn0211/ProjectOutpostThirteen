# Contract Update Guide

The error you are encountering is because the **Frontend** sent a new name, but the **Contract** on the network is still the old version (does not accept the name parameter yet).

To fix this, you need to publish the latest code version to the Sui network:

1.  Open Terminal (Ctrl+`).
2.  Run the following command to deploy:
    ```bash
    sui client publish --gas-budget 100000000 Contracts
    ```
3.  After successful run, look for **packageId** line in the result (usually starts with `0x...`).
4.  Copy that packageId.
5.  Open `frontend/src/constants.ts` file.
6.  Replace the old `PACKAGE_ID` value with the new one.

Then try again, the error should be gone!
