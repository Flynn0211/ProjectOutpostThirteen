# Project Outpost Thirteen

Project Outpost Thirteen is a small on-chain survival/bunker game on Sui:

- Move smart contracts (NPCs, items, bunker, expeditions, marketplace, raids)
- React + Vite frontend that interacts with Sui via wallet

## Repos / docs

- Contracts live in `Contracts/`.
- Frontend lives in `frontend/`.
- Frontend ↔ contract integration notes: [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md)

## Quickstart

### Frontend (local)

Requirements:

- Node.js 18+ recommended
- A Sui wallet in the browser (testnet)

From `frontend/`:

- `npm install`
- `npm run dev`

Optional build:

- `npm run build`

Configuration (recommended): create `frontend/.env.local`:

```bash
VITE_NETWORK=testnet
VITE_PACKAGE_ID=0x...
VITE_MARKETPLACE_ID=0x...
VITE_RAID_HISTORY_ID=0x...
VITE_BUNKER_NPC_LEDGER_ID=0x...
```

### Contracts (local)

From `Contracts/`:

- `sui move build`
- `sui move test`

## Testnet deploy + frontend sync

### Latest testnet IDs (as of 2025-12-27)

If you republish, you will get new IDs.

- Published Package ID (`PACKAGE_ID`): `0xbc518133d1745edd7fdf8c1503e01ed9e187164299c8ac5b8f38a502a2a821b5`
- Shared `BunkerNpcLedger` (`VITE_BUNKER_NPC_LEDGER_ID`): `0x1fc51236f6e55b99ba9fa67f76756481454b13d98cbf0a99eaa2a9991abb41e7`
- Shared `RaidHistory` (`VITE_RAID_HISTORY_ID`): `0x6ec3c50947da18d0ecb87c37f15e39d78e7e64ab9af56943daee9b13e7bd3d97`
- Shared `Marketplace` (`VITE_MARKETPLACE_ID`): `0x90dbcf066b0fb008cd65185258a91e2ad259c99946a2fee20804b34f4bc51f2a`
- `UpgradeCap` (owned by publisher): `0xe401bb7edd52b4760464e9f046a70cbf1fc8ddba8b38a466660e0cd25b3d554b`

### Publish steps

0) Preparation:

- `sui client switch --env testnet`
- `sui client active-env`
- `sui client active-address`

1) Run tests:

- `cd Contracts`
- `sui move test`

2) Publish:

- `sui client publish --gas-budget 500000000`

3) Update frontend IDs:

- Update `frontend/src/constants.ts` OR set env vars in `frontend/.env.local`.
- Republish creates a new `PACKAGE_ID` and new shared object IDs; update all of them.

## Notes / pitfalls

- Republish breaks on-chain types: objects from older package versions will not decode under the new package.
- If the UI loads an old bunker object, you may see parsing/display errors; create a new bunker after republish.

## Roadmap

Phases (feature-level):

- Phase 1: Core loop (NPC recruit, inventory, equipment, recovery)
- Phase 2: Economy (marketplace)
- Phase 3: Advanced systems (durability, crafting)
- Phase 4: PvP (raids)

## Current roadmap (short-term)

- Testnet iteration: publish → update IDs → validate UI flows with new objects
- Stability: reduce hard-coded IDs, improve transaction error feedback
- Cleanup: address Move lints/warnings where it improves composability
- Documentation: keep deployment notes and IDs up to date

## Known issues / pitfalls

- Republish breaks on-chain types: objects from older package versions will not decode under the new package.
- Republish also creates new shared objects (Marketplace / RaidHistory / BunkerNpcLedger): update all IDs, not only `PACKAGE_ID`.
- If the UI loads an old bunker object, you may see parsing/display errors; create a new bunker after republish.

## Tech

- Chain: Sui, Move
- Frontend: React, TypeScript, Vite, Tailwind CSS
- Wallet/tx: Mysten dapp-kit
- Data: TanStack Query
