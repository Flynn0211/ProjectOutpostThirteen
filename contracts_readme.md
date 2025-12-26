# Contracts (Move / Sui)

Move package for Project Outpost Thirteen deployed on Sui.

## Latest testnet IDs (as of 2025-12-27)

If you republish, you will get new IDs.

- Published Package ID (`PACKAGE_ID`): `0xbc518133d1745edd7fdf8c1503e01ed9e187164299c8ac5b8f38a502a2a821b5`
- Shared `BunkerNpcLedger` (`VITE_BUNKER_NPC_LEDGER_ID`): `0x1fc51236f6e55b99ba9fa67f76756481454b13d98cbf0a99eaa2a9991abb41e7`
- Shared `RaidHistory` (`VITE_RAID_HISTORY_ID`): `0x6ec3c50947da18d0ecb87c37f15e39d78e7e64ab9af56943daee9b13e7bd3d97`
- Shared `Marketplace` (`VITE_MARKETPLACE_ID`): `0x90dbcf066b0fb008cd65185258a91e2ad259c99946a2fee20804b34f4bc51f2a`
- `UpgradeCap` (owned by publisher): `0xe401bb7edd52b4760464e9f046a70cbf1fc8ddba8b38a466660e0cd25b3d554b`

## What’s in this package

Modules live in `Contracts/sources/`:

- `npc.move`: NPC lifecycle, equipment (weapon/armor/tool1/tool2), inventory (dynamic fields), recovery/consumables.
- `item.move`: Item types (weapon/armor/tool/consumables), bonus stats, durability.
- `bunker.move`: Bunker, rooms, production/collection, repair.
- `expedition.move`: Expedition game loop, success/damage/item chance logic.
- `crafting.move`: Crafting flows (items/blueprints/bandages).
- `marketplace.move`: Shared marketplace object and listing/buying flows.
- `raid.move`: Shared raid history + raid entrypoints.
- `utils.move`: Constants, PRNG helpers, and events.

## Key on-chain objects

Publishing creates a new package address and (typically) shared objects used by the frontend:

- `Marketplace` (shared)
- `RaidHistory` (shared)
- `BunkerNpcLedger` (shared)
- `UpgradeCap` (owned by the publisher address)

Important: republishing changes type addresses; objects created under the old package will not decode under the new package.

## Local build & test

From `Contracts/` directory:

- Build: `sui move build`
- Tests: `sui move test`

## Testnet deploy + frontend sync

This section is the testnet-only workflow: publish contracts → get new `PACKAGE_ID` → update frontend → create new state to test UI.

### 0) Preparation

- Install Sui CLI and log in to wallet.
- Switch to correct network:
	- `sui client switch --env testnet`
	- `sui client active-env`
	- `sui client active-address`

### 1) Run tests before publishing

From `Contracts/` directory:

- `sui move test`

Ensure it passes (main suite is `Contracts/tests/contracts_tests.move`).

### 2) Publish contracts to testnet

From `Contracts/` directory:

- `sui client publish --gas-budget 500000000`

After publishing, CLI will output:

- `packageId` (new PACKAGE_ID)
- created objects (depending on modules)

Record the **new PACKAGE_ID** and also the **shared object IDs** (Marketplace / RaidHistory / BunkerNpcLedger).

### 3) Update frontend to use new PACKAGE_ID

Open:

- `frontend/src/constants.ts`

Update:

- `export const PACKAGE_ID = "0x..."` (paste new packageId)

Also update the shared object IDs (or set env vars) if you republished:

- `BUNKER_NPC_LEDGER_ID` (or `VITE_BUNKER_NPC_LEDGER_ID`)
- `RAID_HISTORY_ID` (or `VITE_RAID_HISTORY_ID`)
- `MARKETPLACE_OBJECT_ID` (or `VITE_MARKETPLACE_ID`)

Then build/run frontend:

- `cd frontend`
- `npm install`
- `npm run dev` or `npm run build`

Frontend setup docs: [frontend/README.md](frontend/README.md)

### 4) Note on breaking changes (Important)

- **Republish = type tag change**: objects from old package (NPC/Item/Bunker) will not work with new package.
- **Room layout changed** (added `production_remainder`) ⇒ **Old Bunker objects incompatible**.

Correct way to test UI after republish:

1. Recruit new NPC (creates new NPC object from new package)
2. Create new bunker (creates new Bunker/rooms from new package)

### 5) Clock object

Frontend uses shared object clock:

- `0x6`

Entries requiring clock (e.g. consumables) are calling with `tx.object("0x6")`.

### 6) Quick checklist after update

- Open `Manage NPCs` → use Food/Water/Medicine/Revival works
- Open `Inventory` → select NPC → click `Use` on consumables
- Create new bunker and collect production (to verify rounding/remainder)

### 7) Example publish result (filtered terminal output)

Information below is filtered from CLI output when publishing package to testnet (kept important items for quick note):

- Command run: `sui client publish --gas-budget 500000000`
- Transaction Digest: `C4dfrJiXSsPgw9dfQgaAMPzdkUtUHFMCjNvLWzPx15za`
- Published Package ID: `0xbc518133d1745edd7fdf8c1503e01ed9e187164299c8ac5b8f38a502a2a821b5`
- Modules published: `bunker, crafting, expedition, item, marketplace, npc, raid, utils`

- Key created / published objects (filtered):
	- Shared `BunkerNpcLedger`: `0x1fc51236f6e55b99ba9fa67f76756481454b13d98cbf0a99eaa2a9991abb41e7`
	- Shared `RaidHistory`: `0x6ec3c50947da18d0ecb87c37f15e39d78e7e64ab9af56943daee9b13e7bd3d97`
	- Shared `Marketplace`: `0x90dbcf066b0fb008cd65185258a91e2ad259c99946a2fee20804b34f4bc51f2a`
	- `UpgradeCap` (owned by publisher): `0xe401bb7edd52b4760464e9f046a70cbf1fc8ddba8b38a466660e0cd25b3d554b`

## Notes / known issues

- Move linter warnings may appear during build/publish; they do not necessarily block publishing.
- After republish, test with freshly created objects (recruit a new NPC and create a new bunker).
