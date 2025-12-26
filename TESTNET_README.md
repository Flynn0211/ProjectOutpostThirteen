# Testnet Deploy + Frontend Sync Guide

This document is for the **testnet-only** workflow: publish contracts → get new `PACKAGE_ID` → update frontend → create new state to test UI.

## 0) Preparation

- Install Sui CLI and log in to wallet.
- Switch to correct network:
  - `sui client switch --env testnet`
  - `sui client active-env`
  - `sui client active-address`

## 1) Run tests before publishing

From `Contracts/` directory:

- `sui move test`

Ensure it passes (currently main suite is `Contracts/tests/contracts_tests.move`).

## 2) Publish contracts to testnet

From `Contracts/` directory:

- `sui client publish --gas-budget 200000000`

After publishing, CLI will output:

- `packageId` (new PACKAGE_ID)
- created objects (depending on modules)

Record the **new PACKAGE_ID**.

## 3) Update frontend to use new PACKAGE_ID

Open file:

- `frontend/src/constants.ts`

Update:

- `export const PACKAGE_ID = "0x..."` (paste new packageId)

Then build/run frontend:

- `cd frontend`
- `npm install`
- `npm run dev` or `npm run build`

## 4) Note on breaking changes (Important)

- **Republish = type tag change**: objects from old package (NPC/Item/Bunker) will not work with new package.
- **Room layout changed** (added `production_remainder`) ⇒ **Old Bunker objects incompatible**.

=> On testnet, correct way to test UI is:

1. Recruit new NPC (creates new NPC object from new package)
2. Create new bunker (creates new Bunker/rooms from new package)

## 5) Clock object

Frontend uses shared object clock:

- `0x6`

Entries requiring clock (e.g. consumables) are calling with `tx.object("0x6")`.

## 6) Quick Checklist after update

- Open `Manage NPCs` → use Food/Water/Medicine/Revival works
- Open `Inventory` → select NPC → click `Use` on consumables
- Create new bunker and collect production (to verify rounding/remainder)

## 7) Example publish result (filtered terminal output)

Information below is filtered from CLI output when I published package to testnet (kept important items for quick note):

- Command run: `sui client publish --gas-budget 400000000`
- Transaction Digest: `GjP7MXLYBubStomijBw1U4uWb8PyQco5EpuZqmtqPgvM`
- Published Package ID: `0x7dcb6e2d97b26efb0f18e8c3b7a191a47d32145aa87500c24365993fc1a0563c`
- Modules published: `bunker, crafting, expedition, item, marketplace, npc, raid, utils`

- Gas / cost summary (from publish):

  - Gas Budget: 400000000 MIST
  - Storage Cost: 304273600 MIST
  - Computation Cost: 3000000 MIST
  - Storage Rebate: 978120 MIST
  - Non-refundable Storage Fee: 9880 MIST

- Key created / published objects (filtered):
  - UpgradeCap object (created)
  - Shared module objects (marketplace, raid history, etc.)
  - Published package object: same as Package ID above (version 1)

Notes / quick tips:

- There were multiple linter/build warnings printed during the build (duplicate aliases, `unnecessary entry on public` warnings). These are informative only — they don't block publish but you may want to clean them later.
- First attempt with `--gas-budget 200000000` failed with `InsufficientGas`. Retry with a larger budget (e.g. `400000000`) resolved it.
- After publish, update `frontend/src/constants.ts` and set `PACKAGE_ID` to the Published Package ID above so the frontend talks to the new package.

If you want, I can update `frontend/src/constants.ts` now with the new PACKAGE_ID.

Transaction Data │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Sender: 0x7df510ef8a8ee75ada1e3c9626da3d80a3091f72c8599f4859b0ccfc9bc10e63 │
│ Gas Owner: 0x7df510ef8a8ee75ada1e3c9626da3d80a3091f72c8599f4859b0ccfc9bc10e63 │
│ Gas Budget: 500000000 MIST │
│ Gas Price: 1000 MIST │
│ Gas Payment: │
│ ┌── │
│ │ ID: 0x4c0daa4fe9f2f73c0167afd8e4fb509781130b37ec02a00d87c315d697be69b7 │
│ │ Version: 705899942 │
│ │ Digest: JBXDHA55QZKHsD2vk3QftMToVZco46Aq3F4Jbx43459L │
│ └── │
│ │
│ Transaction Kind: Programmable │
│ ╭──────────────────────────────────────────────────────────────────────────────────────────────────────────╮ │
│ │ Input Objects │ │
│ ├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤ │
│ │ 0 Pure Arg: Type: address, Value: "0x7df510ef8a8ee75ada1e3c9626da3d80a3091f72c8599f4859b0ccfc9bc10e63" │ │
│ ╰──────────────────────────────────────────────────────────────────────────────────────────────────────────╯ │
│ ╭─────────────────────────────────────────────────────────────────────────╮ │
│ │ Commands │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ 0 Publish: │ │
│ │ ┌ │ │
│ │ │ Dependencies: │ │
│ │ │ 0x0000000000000000000000000000000000000000000000000000000000000001 │ │
│ │ │ 0x0000000000000000000000000000000000000000000000000000000000000002 │ │
│ │ └ │ │
│ │ │ │
│ │ 1 TransferObjects: │ │
│ │ ┌ │ │
│ │ │ Arguments: │ │
│ │ │ Result 0 │ │
│ │ │ Address: Input 0 │ │
│ │ └ │ │
│ ╰─────────────────────────────────────────────────────────────────────────╯ │
│ │
│ Signatures: │
│ PsDVqVRmtcKsSE9ZFDxYwvUQEfCN7TpktVKdMiQAIIhoKq7D6Ss0MChfsRdIBMNIK2lcVJCMiwSZaT5dliVSCA== │
│ │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
╭───────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Transaction Effects │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Digest: E2SJsAmsSYhzfdXcQNmw9Fh1xNh7VqyAeyfoyeKy8V1o │
│ Status: Success │
│ Executed Epoch: 959 │
│ │
│ Created Objects: │
│ ┌── │
│ │ ID: 0x52a1b1b742e01166f5c878b4e9a4991293f33c30b263f15dacb1abd31f816636 │
│ │ Owner: Shared( 705899943 ) │
│ │ Version: 705899943 │
│ │ Digest: DMj7crYyD6fEwhYCpoSoCzpNJTCcDbmZfkrHnw1buXKn │
│ └── │
│ ┌── │
│ │ ID: 0x5cd10e126108f6cb00403e581874864e3b1c75e7894f2787108f6159781eaf6b │
│ │ Owner: Account Address ( 0x7df510ef8a8ee75ada1e3c9626da3d80a3091f72c8599f4859b0ccfc9bc10e63 ) │
│ │ Version: 705899943 │
│ │ Digest: FFyKsjVT2Pti1KawS57mBV4KGkgvec3jgaKxQi7QNWod │
│ └── │
│ ┌── │
│ │ ID: 0xe47a2620d1072e42d3ba1eb311be78b6ac5644fb1b79e93f191c7f291c00bace │
│ │ Owner: Shared( 705899943 ) │
│ │ Version: 705899943 │
│ │ Digest: r3FemA9Ff5mDnLNxPP7La1yt5GLxNP6Sq3iQztLTVvL │
│ └── │
│ Mutated Objects: │
│ ┌── │
│ │ ID: 0x4c0daa4fe9f2f73c0167afd8e4fb509781130b37ec02a00d87c315d697be69b7 │
│ │ Owner: Account Address ( 0x7df510ef8a8ee75ada1e3c9626da3d80a3091f72c8599f4859b0ccfc9bc10e63 ) │
│ │ Version: 705899943 │
│ │ Digest: EBqULFicnFtmf1NDyQXD1nErCVrgLyEQefe1aC5nnxVf │
│ └── │
│ Published Objects: │
│ ┌── │
│ │ PackageID: 0x810c6ad98b1ac27d23b21565ab926650e247567068cc749df09a3ea54bdd43c3 │
│ │ Version: 1 │
│ │ Digest: 3ByffSAd1wMYUJX6s3fziChWcGk6xfMk77nGZNTGZSJd │
│ │ Modules: bunker, crafting, expedition, item, marketplace, npc, raid, utils │
│ └── │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
