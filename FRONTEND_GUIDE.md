# 🎨 Hướng Dẫn Tích Hợp Frontend (On-Chain Bunker)

Tài liệu này dành cho Frontend Developers để kết nối với hệ thống Smart Contracts của On-Chain Bunker trên Sui.

---

## 🔑 Các Khái Niệm Cốt Lõi

Khi làm việc với Sui và `dapp-kit`, bạn cần chú ý các Object Types sau:

### 1. Object Types
Để query object, bạn cần biết Type chính xác của nó.
*Thay `PACKAGE_ID` bằng địa chỉ package thực tế sau khi deploy.*

| Tên Object | Suffix Type | Mô tả |
| :--- | :--- | :--- |
| **NPC** | `::npc::NPC` | Nhân vật chính. Owned Object. |
| **Item** | `::item::Item` | Vật phẩm. Owned Object. |
| **Bunker** | `::bunker::Bunker` | Hầm trú ẩn. (Có thể là Shared hoặc Owned tùy implementation). |

*Ví dụ full type*: `0x123...::npc::NPC`

---

## 📡 Events (Quan trọng)
Vì logic random thực hiện on-chain, Frontend **KHÔNG THỂ** biết kết quả ngay lập tức từ response của transaction block thông thường. Bạn phải **lắng nghe Events** hoặc parse Events từ Transaction Receipt.

### Các Events cần dùng

**1. `RecruitEvent`** (Module: `utils`)
*   **Khi nào**: Người chơi chiêu mộ NPC thành công.
*   **Dữ liệu**: `npc_id`, `rarity`, `profession`, `max_hp`, `stamina`.
*   **Frontend Action**: Hiển thị popup "Chúc mừng! Bạn nhận được NPC [Rarity]".

**2. `ExpeditionResultEvent`** (Module: `utils`)
*   **Khi nào**: Kết thúc thám hiểm.
*   **Dữ liệu**: `success` (bool), `resources_gained`, `items_gained`, `damage_taken`.
*   **Frontend Action**:
    *   Nếu `success = true`: Hiển thị màn hình chiến thắng, số resource nhận được.
    *   Nếu `success = false`: Hiển thị màn hình thất bại, số máu bị trừ.
    *   **QUAN TRỌNG**: Nếu `damage_taken` rất lớn (ví dụ 9999), đó là dấu hiệu DEATH/KNOCKOUT.

**3. `DeathEvent`** (Module: `utils`)
*   **Khi nào**: NPC bị đánh ngất (Knocked Out) do Critical Failure hoặc hết máu.
*   **Dữ liệu**: `npc_id`, `cause`.
*   **Frontend Action**: Hiển thị trạng thái "Bất tỉnh" (HP=0). Hiển thị nút "Hồi sinh" nếu user có Revival Potion.

---

## 🎮 Tương Tác (Move Calls)

Sử dụng `TransactionBlock` để gọi hàm.

### 1. Chiêu mộ NPC
*   **Function**: `recruit_npc`
*   **Module**: `npc`
*   **Arguments**: `[Clock]`
*   **Payment**: Cần split coin 0.1 SUI để trả phí recruit.
*   **Lưu ý**: Cần truyền object `0x6` (Clock) vào argument.

```typescript
// Ví dụ với @mysten/dapp-kit
const tx = new TransactionBlock();
const [coin] = tx.splitCoins(tx.gas, [tx.pure(100_000_000)]); // 0.1 SUI
tx.moveCall({
  target: `${PACKAGE_ID}::npc::recruit_npc`,
  arguments: [
    coin,
    tx.object('0x6') // Clock object
  ],
});
```

### 2. Bắt đầu Thám Hiểm (Expedition)
*   **Function**: `start_expedition`
*   **Module**: `expedition`
*   **Arguments**:
    1. `npc`: Object ID của NPC.
    2. `bunker`: Object ID của Bunker.
    3. `duration`: Số giờ (u64).
    4. `clock`: `0x6`.

### 3. Equip Item
*   **Function**: `equip_item`
*   **Module**: `npc`
*   **Arguments**:
    1. `npc`: Object ID của NPC.
    2. `item`: Object ID của Item.
    *   **Lưu ý**: Không thể equip item loại `Collectible` (Type 99), `Food` (Type 6), hoặc `Revival Potion` (Type 5). Frontend nên filter list item này khi hiển thị dialog Equip.

### 4. Unequip Item
*   **Function**: `unequip_item`
*   **Module**: `npc`
*   **Arguments**:
    1. `npc`: Object ID của NPC.
    2. `item_id`: ID của item đang equip (Lưu ý: đây có thể là ID của dynamic field, cần kiểm tra kỹ logic frontend để lấy đúng ID).

### 5. Hồi sinh NPC (Revive)
*   **Function**: `revive_npc`
*   **Module**: `npc`
*   **Arguments**:
    1. `npc`: Object ID của NPC.
    2. `potion`: Object ID của Revival Potion (Item Type 5).
    3. `clock`: `0x6`.

### 6. Sử dụng Thức Ăn (Consume Food)
*   **Function**: `consume_food`
*   **Module**: `npc`
*   **Arguments**:
    1. `npc`: Object ID của NPC.
    2. `food`: Object ID của Food (Item Type 6).
    3. `clock`: `0x6`.

---

## 🐛 Mapping Lỗi (Error Codes)

Nếu transaction thất bại, check error code:

| Mã Lỗi | Module | Ý nghĩa |
| :--- | :--- | :--- |
| **400** | expedition | `E_NPC_NOT_READY` - NPC đang bận hoặc quá mệt. |
| **402** | expedition | `E_INVALID_DURATION` - Thời gian không hợp lệ. |
| **101** | npc | `E_INSUFFICIENT_FUNDS` - Không đủ tiền recruit. |
| **105** | npc | `E_NOT_OWNER` - Thao tác trên NPC/Bunker không phải của mình. |
| **208** | npc | `E_INVALID_ITEM` - Item dùng không đúng loại (ví dụ lấy gậy đập vào miệng để hồi máu). |
| **209** | npc | `E_CANNOT_EQUIP_THIS_ITEM` - Cố tình equip item không phải vũ khí/giáp (như Food, Collectible). |

---

## 📝 Quy trình gợi ý cho Frontend

1.  **Màn hình Home**:
    *   Query tất cả object type `NPC` mà user sở hữu.
    *   Query object `Bunker`.
    *   Hiển thị danh sách. Check `current_hp` để xem có NPC nào đang Knocked Out không.

2.  **Khi User bấm "Recruit"**:
    *   Gửi transaction `recruit_npc`.
    *   Subscribe event `RecruitEvent` để biết kết quả (vì ID NPC mới sẽ nằm trong event).
    *   Sau khi có event -> Refresh danh sách NPC.

3.  **Khi User bấm "Thám hiểm"**:
    *   Cho user chọn giờ.
    *   Gửi transaction `start_expedition`.
    *   Show loading...
    *   Đợi event `ExpeditionResultEvent`.
    *   Dựa vào event để hiện popup kết quả.

---

*Tài liệu này được tạo tự động bởi Antigravity Agent.*
