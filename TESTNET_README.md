# Testnet Deploy + Frontend Sync Guide

Tài liệu này dành cho workflow **testnet-only**: publish contracts → lấy `PACKAGE_ID` mới → cập nhật frontend → tạo lại state mới để test UI.

## 0) Chuẩn bị

- Cài Sui CLI và đăng nhập ví.
- Switch đúng network:
  - `sui client switch --env testnet`
  - `sui client active-env`
  - `sui client active-address`

## 1) Chạy tests trước khi publish

Từ thư mục `Contracts/`:

- `sui move test`

Đảm bảo pass (hiện tại suite chính là `Contracts/tests/contracts_tests.move`).

## 2) Publish contracts lên testnet

Từ thư mục `Contracts/`:

- `sui client publish --gas-budget 200000000`

Sau khi publish, CLI sẽ in ra:
- `packageId` (PACKAGE_ID mới)
- các object được tạo (tuỳ modules)

Ghi lại **PACKAGE_ID mới**.

## 3) Cập nhật frontend dùng PACKAGE_ID mới

Mở file:
- `frontend/src/constants.ts`

Cập nhật:
- `export const PACKAGE_ID = "0x..."` (dán packageId mới)

Sau đó build/run frontend:
- `cd frontend`
- `npm install`
- `npm run dev` hoặc `npm run build`

## 4) Lưu ý breaking changes (quan trọng)

- **Republish = type tag đổi**: object của package cũ (NPC/Item/Bunker) sẽ không dùng với package mới.
- **Room layout changed** (thêm `production_remainder`) ⇒ **Bunker objects cũ không tương thích**.

=> Trên testnet, cách đúng để test UI là:

1) Recruit NPC mới (tạo NPC object mới theo package mới)
2) Create bunker mới (tạo Bunker/rooms mới theo package mới)

## 5) Clock object

Frontend dùng clock shared object:
- `0x6`

Các entry cần clock (ví dụ consumables) đang gọi với `tx.object("0x6")`.

## 6) Checklist nhanh sau khi cập nhật

- Mở `Manage NPCs` → dùng Food/Water/Medicine/Revival được
- Mở `Inventory` → chọn NPC → bấm `Use` trên consumables
- Tạo bunker mới và collect production thử (để verify rounding/remainder)

## 7) Ví dụ kết quả publish (filtered terminal output)

Thông tin dưới đây là phần đã lọc từ output CLI khi mình publish package lên testnet (giữ những mục quan trọng để ghi lại nhanh):

- Command chạy: `sui client publish --gas-budget 400000000`
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
