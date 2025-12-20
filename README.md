# 🛡️ ON-CHAIN BUNKER
*A Post-Apocalyptic Shelter Management Game on Sui*  
**Submission for Build on Sui Hackathon**
---
## 📌 Giới thiệu
**On-Chain Bunker** là một game quản lý hầm trú ẩn 2D, lấy cảm hứng từ *Fallout Shelter*, được xây dựng trên **Sui Blockchain**.

Trong một thế giới hậu tận thế, người chơi sẽ:
* Sở hữu một **hầm trú ẩn (Bunker)** on-chain
* Quản lý các **NPC sinh tồn duy nhất**
* Gửi NPC đi **thám hiểm hoang địa**
* Thu thập tài nguyên, vật phẩm hiếm
* Mở rộng và nâng cấp hầm trú ẩn theo thời gian

Điểm khác biệt cốt lõi:  
> **NPC, vật phẩm hiếm và tiến trình phát triển đều là object on-chain, thực sự thuộc về người chơi – với true ownership, risk thực tế và composability.**

---
## 🎯 Mục tiêu dự án
Dự án được xây dựng trong khuôn khổ **hackathon Build on Sui**, với các mục tiêu chính:
1. **Chứng minh khả năng biểu diễn NPC như một object on-chain**
2. Xây dựng một gameplay loop quản lý hoàn chỉnh với **true risk & reward**:
   > Recruit → Equip → Expedition (có rủi ro) → Level up → Phát triển bunker
3. Thể hiện rõ **giá trị thực tế của blockchain trong game**: ownership có hậu quả, kinh tế on-chain, composability nhờ object-centric model của Sui.

---
## 🧠 Ý tưởng cốt lõi
### NPC là trung tâm
* Mỗi NPC là duy nhất, có rarity, stats cơ bản và nghề nghiệp
* Có thể **level up permanent** (stats tăng dần theo thời gian chơi)
* Có **inventory riêng** (equip rare item để tăng hiệu quả)
* Có thể bị thương hoặc **mất hẳn** nếu expedition thất bại
* Được trao đổi tự do với người chơi khác (atomic trade)

### Blockchain không chỉ để “lưu trữ”
* Quyền sở hữu NPC & item là **minh bạch**, không thể giả mạo
* Tận dụng tối đa **object-centric model** của Sui: dynamic fields cho inventory/level, owned objects cho ownership cá nhân, event emission cho transparency

---
## 🧩 Các hệ thống chính
### 👤 Hệ thống NPC
* Tạo ngẫu nhiên dựa trên rarity và stats (roll hoàn toàn trong smart contract)
* **Level up permanent**: Sau mỗi expedition thành công, NPC tăng stats on-chain (HP, stamina…)
* **Inventory system**: NPC có thể equip rare item (sử dụng dynamic object fields của Sui để attach item trực tiếp vào NPC object)
* Nghề nghiệp ảnh hưởng trực tiếp gameplay:
  * Scavenger → Tăng tỷ lệ tìm resource
  * Engineer → Tăng hiệu quả generator
  * Medic → Giảm risk bị thương
  * Guard → Bảo vệ bunker
  * Trader → Bonus khi trade
* Chiêu mộ NPC tốn 0.1 SUI, logic xử lý hoàn toàn trong smart contract

### 🏠 Hệ thống Bunker & Phòng chức năng
* Các phòng cơ bản:
  * Living Quarters
  * Storage
  * Generator
* Phòng có thể nâng cấp, liên kết phụ thuộc lẫn nhau

### 🧭 Hệ thống Thám hiểm (Expedition)
* Người chơi chọn NPC, thời gian và tài nguyên mang theo
* **True risk & reward**:
  * Thành công → Reward tài nguyên, rare item, NPC mới + **level up permanent cho NPC tham gia**
  * Thất bại → NPC có thể bị thương hoặc **mất hẳn (permanent death – object bị destroy/burn)**
  * Equip item tốt → Giảm risk, tăng reward
* Logic roll kết quả (tỷ lệ thành công, rarity item, risk mất NPC) nằm hoàn toàn trong smart contract, sử dụng pseudo-random từ tx digest/clock/sender

### 🎒 Hệ thống Vật phẩm
* **Tài nguyên tiêu hao**: thức ăn, nước, thuốc… (off-chain cho đơn giản)
* **Vật phẩm hiếm (object on-chain)**:
  * Có thể equip vào NPC (attach qua dynamic fields)
  * Trade được
  * Dùng nâng cấp bunker hoặc mở khoá tính năng

---
## 🛠️ Thiết kế On-Chain (Tận dụng Sức Mạnh Sui Move)
### I. KẾT LUẬN TỔNG QUÁT
* ✅ **TỶ LỆ (rarity, roll kết quả, risk expedition)** → **Smart contract**
* ✅ **CHỈ SỐ & LEVEL UP** → **Smart contract**
* ✅ **INVENTORY (equip item)** → **Dynamic object fields**
* ✅ **GIÁ TRỊ NPC** → **Suy ra từ on-chain data**
* ❌ **Frontend không quyết định bất kỳ rule nào**

### II. CÁC TÍNH NĂNG ON-CHAIN MỚI
#### 1. Permanent Level Up
* Sau expedition thành công → Contract tự động tăng stats của NPC object (ví dụ +5 HP, +10 stamina)
* Stats được lưu trực tiếp trong NPC object → Giá trị NPC tăng thực sự theo thời gian chơi

#### 2. Equip Item (Dynamic Fields)
* Rare item có thể được attach trực tiếp vào NPC object làm child object
* Tận dụng **dynamic object fields** của Sui → Không cần restructure contract
* Khi expedition: Contract đọc item được equip để tính bonus/reduce risk

#### 3. True Risk – Permanent Death
* Expedition có % fail → Contract roll và nếu fail nặng → **destroy NPC object** hoặc transfer về "graveyard" shared object
* Player thực sự mất tài sản → Chứng minh true ownership có hậu quả

### III. LOGIC NẰM Ở ĐÂU?
🧠 **Smart contract (luật cứng)**
* Chiêu mộ & roll rarity/stats
* Expedition: roll kết quả, level up, equip bonus, risk death
* Equip/unequip item
* Trade & destroy object

🎮 **Frontend (trải nghiệm)**
* Animation recruit + rarity glow
* Expedition timer + hiệu ứng risk
* Hiển thị level up, equip slot
* Cảnh báo khi có nguy cơ mất NPC

### IV. TÓM TẮT
* Tỷ lệ & risk → **Smart contract**
* Stats & level → **Smart contract**
* Inventory → **Dynamic fields**
* Giá trị → **Suy ra từ dữ liệu on-chain**
* Frontend → **Chỉ hiển thị & tạo trải nghiệm**

---
## 🎉 Tại sao chọn Sui?
* **Object-centric model**: NPC & item là owned object → true ownership, trade atomic
* **Dynamic fields**: Attach item/inventory/level mà không cần wrapper phức tạp
* **Pseudo-random on-chain**: Roll rarity, expedition, risk death mà không cần oracle
* **Event emission**: Thông báo recruit, level up, expedition result → frontend realtime
* **Low gas & fast finality**: Phù hợp tương tác thường xuyên

---
## 🧱 Kiến trúc tổng thể
```
Frontend (Web Game)
  ↓ gọi transaction
Sui Blockchain (Move Smart Contract)
  ↓ trả object & state + events
Frontend hiển thị kết quả
```

* **Smart Contract (Move)**: Toàn bộ luật chơi, ownership, risk/reward
* **Web Game**: UI/UX, animation, query object để render
* **Backend (optional)**: Narrative text

---
## 🛠️ Công nghệ sử dụng
### Blockchain
* Sui Testnet
* Sui Move (dynamic fields, owned/shared objects, event emission)
### Frontend
* Vite + React + TypeScript
* @mysten/dapp-kit + Sui Wallet
### Backend (tuỳ chọn)
* Node.js (narrative generator)

---
## 📁 Cấu trúc thư mục
### Smart Contract
```
contracts/
├─ Move.toml
└─ sources/
   ├─ bunker.move
   ├─ npc.move
   ├─ expedition.move
   ├─ item.move
   └─ utils.move
```

### Web Game
```
webgame/
├─ src/
│ ├─ pages/
│ ├─ components/
│ ├─ services/
│ ├─ hooks/
│ ├─ config/
│ └─ types/
```

---
## 🚀 Cách chạy dự án
### 1. Deploy contract
```bash
cd contracts
sui move build
sui client publish --gas-budget 100000000
```
Lưu **Package ID**.

### 2. Chạy web
```bash
cd webgame
npm install
npm run dev
```
Cập nhật Package ID trong `src/config/sui.ts`

---
## ⚠️ Giới hạn hiện tại (Hackathon Scope)
* Prototype tập trung core on-chain loop
* Không có PvP/multiplayer realtime
* Narrative off-chain
* Balance chưa tối ưu dài hạn
* Đơn giản hóa UI để fit thời gian hackathon

---
## 🚀 Tầm nhìn tương lai
* Marketplace on-chain (Kiosk integration)
* Shared bunker & co-op expedition
* Global expedition log từ events
* Sponsored transaction để giảm barrier

---
## 👥 Team
* **Tech Lead / System Designer** – Kiến trúc & Move core
* **Move Developer** – Module & on-chain logic
* **Frontend Developer** – UI/UX & animation

Chúc dự án của bạn "đã tay" với BGK và đạt kết quả cao trong hackathon! Nếu cần chỉnh thêm gì cứ bảo nhé. 🚀