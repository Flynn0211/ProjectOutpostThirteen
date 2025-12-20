# 🛡️ ON-CHAIN BUNKER
*A Post-Apocalyptic Shelter Management Game on Sui*
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
> **NPC, vật phẩm hiếm và tiến trình phát triển đều là object on-chain, thực sự thuộc về người chơi.**
---
## 🎯 Mục tiêu dự án
Dự án được xây dựng trong khuôn khổ **hackathon Build on Sui**, với các mục tiêu chính:
1. **Chứng minh khả năng biểu diễn NPC như một object on-chain**
2. Xây dựng một gameplay loop quản lý hoàn chỉnh:
   > Quản lý NPC → Thám hiểm → Nhận kết quả → Phát triển bunker
3. Thể hiện rõ **giá trị thực tế của blockchain trong game**, không chỉ là token hay NFT đơn thuần, bằng cách tận dụng mô hình object-centric của Sui để đảm bảo quyền sở hữu minh bạch, tính công bằng và không thể gian lận.
---
## 🧠 Ý tưởng cốt lõi
### NPC là trung tâm
* Mỗi NPC là duy nhất
* Có nghề nghiệp, trạng thái riêng (bỏ qua chi tiết ngoại hình phức tạp như body, mặt, tóc, quần áo để tập trung vào core gameplay trong thời gian hackathon hạn chế)
* Có thể:
  * Làm việc trong bunker
  * Đi thám hiểm
  * Bị thương hoặc mất tích
  * Được trao đổi với người chơi khác
### Blockchain không chỉ để “lưu trữ”
* Quyền sở hữu NPC & item là **minh bạch**
* Không thể giả mạo hoặc chỉnh sửa tuỳ ý
* Phù hợp với mô hình **object-centric** của Sui, nơi mọi object (NPC, item) được quản lý trực tiếp trên chain, tận dụng dynamic fields và shared objects để hỗ trợ tương tác linh hoạt như trade hoặc level up mà không cần intermediary.
---
## 🧩 Các hệ thống chính
### 👤 Hệ thống NPC
* Tạo ngẫu nhiên dựa trên rarity và stats (chi tiết roll rarity và stats nằm hoàn toàn trong smart contract để đảm bảo công bằng)
* Nghề nghiệp ảnh hưởng trực tiếp gameplay:
  * Scavenger
  * Engineer
  * Medic
  * Guard
  * Trader
* Chiêu mộ NPC tốn 0.1 SUI, logic xử lý hoàn toàn trong smart contract (nhận tiền, roll rarity, sinh stats và tạo object NPC)
* Chỉ số cơ bản (HP, stamina, skills) lưu trong object NPC on-chain; giá trị nhân vật (value/power) được suy ra từ dữ liệu on-chain (không lưu riêng để tránh redundancy và tận dụng tính toán dynamic của Sui)

### 🏠 Hệ thống Bunker & Phòng chức năng
* Các phòng cơ bản (giảm số lượng để tập trung MVP):
  * Living Quarters
  * Storage
  * Generator
* Phòng nâng cao yêu cầu điều kiện mở khoá (bỏ Workshop để đơn giản hóa, tập trung vào core loop)
* Phòng có thể nâng cấp, liên kết phụ thuộc lẫn nhau (logic nâng cấp lưu on-chain để tận dụng object ownership)

### 🧭 Hệ thống Thám hiểm (Expedition)
* Người chơi chọn:
  * NPC tham gia
  * Thời gian thám hiểm
  * Tài nguyên mang theo
* Kết quả thám hiểm:
  * Tài nguyên
  * Vật phẩm hiếm
  * NPC mới
  * Sự kiện ngẫu nhiên (narrative)
* Logic roll kết quả (tỷ lệ thành công, rarity item) nằm trong smart contract, sử dụng pseudo-random từ tx digest/clock/sender để đảm bảo tính ngẫu nhiên đủ dùng cho hackathon

### 🎒 Hệ thống Vật phẩm
* **Tài nguyên tiêu hao**: thức ăn, nước, thuốc… (quản lý off-chain cho đơn giản)
* **Vật phẩm hiếm (object on-chain)**:
  * Trade được
  * Dùng nâng cấp
  * Mở khoá phòng hoặc tính năng mới
---
## 🛠️ Thiết kế On-Chain (Tận dụng Sức Mạnh Sui Move)
Dự án tập trung vào thiết kế on-chain để đạt MVP ấn tượng, đi thẳng vào lõi game on-chain và tận dụng object-centric của Sui để tạo niềm tin, công bằng và kinh tế thực thụ. Dưới đây là phân tích chi tiết, chốt rõ cái gì ở smart contract – cái gì ở frontend – cái gì KHÔNG nên làm.

### I. KẾT LUẬN TỔNG QUÁT (CHỐT NGẮN)
* ✅ **TỶ LỆ (rarity, roll kết quả)** → **PHẢI nằm trong smart contract**
* ✅ **CHỈ SỐ CƠ BẢN của NPC** → **PHẢI nằm trong smart contract**
* ✅ **Giá trị nhân vật (value / power / score)** → **TÍNH TOÁN TỪ ON-CHAIN DATA**
* ❌ **Không để frontend quyết định rarity hay stat**
* ❌ **Không hardcode logic roll ở frontend**
👉 Vì đây là **kinh tế + công bằng + niềm tin**. Tận dụng Sui Move để object tự quản lý state, hỗ trợ trade atomic và event emission cho transparency.

### II. PHÂN TÁCH CHI TIẾT TỪNG PHẦN
#### 1. Chiêu mộ NPC tốn 0.1 SUI → logic ở đâu?
👉 **Smart contract**  
Lý do:  
* Liên quan tiền thật (SUI)  
* Tránh gian lận  
* Frontend không được phép “roll hộ”  
Trong Move:  
* Người chơi gửi 0.1 SUI  
* Contract nhận tiền  
* Contract sinh NPC (sử dụng Coin<SUI> và transfer để xử lý phí atomic)

#### III. TỶ LỆ RARITY ĐẶT Ở ĐÂU?
👉 **Smart contract – 100%**  
Ví dụ tư duy (KHÔNG phải code chính xác):  
```text
0–699 → Common
700–899 → Uncommon
900–969 → Rare
970–989 → Epic
990–998 → Legendary
999 → Mythic (nếu muốn khoe)
```  
📌 **Frontend chỉ hiển thị kết quả**  
📌 **Frontend không biết logic roll chi tiết**  
Tận dụng Sui: Sử dụng UID và dynamic fields để lưu rarity linh hoạt.

#### IV. RANDOM TRONG SUI – HIỂU ĐÚNG
Sui **KHÔNG cho random tuyệt đối**, nhưng hackathon thì:  
* Dùng:  
  * tx digest  
  * clock  
  * sender  
* Kết hợp hash → pseudo-random  
👉 **Đủ dùng – BGK chấp nhận**  
Tích hợp vào Move functions để roll rarity/stats/expedition results.

#### V. CHỈ SỐ NHÂN VẬT KHAI BÁO Ở ĐÂU?
👉 **Trong object NPC (on-chain)**  
Ví dụ tư duy schema:  
```text
NPC
- rarity
- max_hp
- stamina
- hunger
- thirst
- skill_1
- skill_2
- skill_3
```  
💡 Lưu ý:  
* Lưu **GIÁ TRỊ GỐC**  
* Không lưu giá trị hiển thị  
Sử dụng Sui's object display để frontend dễ query.

#### VI. CHỈ SỐ PHỤ THUỘC RARITY NHƯ THẾ NÀO?
Có 2 cách — hackathon nên chọn **cách 1**.  
✅ CÁCH 1 (KHUYẾN NGHỊ): Roll base theo rarity  
Ví dụ:  
| Rarity | HP | Stamina | Skill slots |  
| --------- | ------- | ------- | ----------- |  
| Common | 80–100 | 80–100 | 1 |  
| Rare | 110–130 | 110–130 | 2 |  
| Epic | 140–170 | 140–170 | 3 |  
| Legendary | 180–220 | 180–220 | 4 |  
👉 Contract:  
* Xác định rarity  
* Sinh chỉ số trong biên tương ứng  
* Ghi thẳng vào NPC object  
❌ CÁCH 2 (KHÔNG NÊN): Frontend tự cộng  
❌ Dễ gian lận  
❌ Không trustless  
❌ Sai tư duy on-chain  

#### VII. KỸ NĂNG CÁ NHÂN (SKILL) LƯU Ở ĐÂU?
👉 **On-chain**, dưới dạng ID  
```text
skill_ids: vector<u8>
```  
Frontend:  
* Map `skill_id → icon + mô tả`  

#### VIII. CÓ NÊN TĂNG “GIÁ TRỊ” NHÂN VẬT SAU KHI MỞ KHÔNG?
Câu trả lời: **CÓ, NHƯNG KHÔNG LÀ SỐ RIÊNG**  
🚫 Không nên lưu:  
```text
npc.value = 1234
```  
✅ Nên làm:  
* Giá trị = **hàm suy ra từ on-chain data**  
Ví dụ:  
```text
value = rarity_weight + level * 10 + total_skill_score
```  
👉 Frontend:  
* Tính value để hiển thị  
* Không ảnh hưởng logic game  
Tận dụng Sui's query để đọc object và tính dynamic.

#### IX. LOGIC NẰM Ở ĐÂU? (CỰC KỲ QUAN TRỌNG)
🧠 Smart contract (luật cứng)  
* Chiêu mộ  
* Rarity  
* Chỉ số  
* Level up  
* Trade  
* Burn / consume  
* Expedition results (roll on-chain)  
🎮 Frontend (trải nghiệm)  
* Animation mở NPC  
* Hiệu ứng hiếm  
* UI tăng số  
* Xếp hạng  
* Tooltip giải thích  

#### X. SƠ ĐỒ TƯ DUY (GHI NHỚ)
```
Click "Recruit"
↓
Pay 0.1 SUI
↓
Smart contract:
- Roll rarity
- Roll stats
- Create NPC object
↓
Return UID
↓
Frontend:
- Read NPC
- Render hình
- Show rarity glow
```

#### XI. TÓM TẮT 1 LẦN CUỐI (CỰC NGẮN)
* Tỷ lệ → **Smart contract**  
* Chỉ số → **Smart contract**  
* Giá trị → **Suy ra từ dữ liệu**  
* Frontend → **Không quyết định game rule**  

---
## 🧱 Kiến trúc tổng thể
```
Frontend (Web Game)
  ↓ gọi transaction
Sui Blockchain (Move Smart Contract)
  ↓ trả object & state
Frontend hiển thị kết quả
```
### Phân tách rõ ràng:
* **Smart Contract (Move)**: luật chơi, quyền sở hữu, trạng thái, roll random, stats (tận dụng object-centric cho MVP mạnh mẽ)
* **Web Game**: giao diện, trải nghiệm, hiển thị (query object để render)
* **Backend (optional)**: narrative, event text (không giữ tài sản)
---
## 🛠️ Công nghệ sử dụng
### Blockchain
* Sui Testnet
* Sui Move (tận dụng pseudo-random, dynamic fields, shared objects cho trade/expedition)
* Object-centric smart contract
### Frontend
* Vite + React
* TypeScript
* @mysten/dapp-kit
* Sui Wallet
### Backend (tuỳ chọn)
* Node.js
* Narrative / event generator
---
## 📁 Cấu trúc thư mục
### Smart Contract
```
contracts/
├─ Move.toml
└─ sources/
   ├─ vault.move
   ├─ npc.move
   ├─ room.move
   ├─ expedition.move
   └─ item.move
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
## 🚀 Cách chạy dự án (local)
### 1. Deploy smart contract lên Sui Testnet
```bash
cd contracts
sui move build
sui client publish --gas-budget 100000000
```
Lưu lại **Package ID** sau khi deploy.
---
### 2. Chạy web game
```bash
cd webgame
npm install
npm run dev
```
Cập nhật `Package ID` trong:
```
src/config/sui.ts
```
---
## ⚠️ Giới hạn hiện tại (Hackathon Scope)
* Không có PvP thời gian thực
* Event narrative được xử lý off-chain
* Chưa tối ưu balance dài hạn
* Mục tiêu là prototype, không phải game hoàn chỉnh
* Đơn giản hóa ngoại hình NPC và số lượng phòng để fit 4 ngày (tập trung on-chain core)
---
## 👥 Team
* **Tech Lead / System Designer** – Kiến trúc & Move core
* **Move Developer** – Module phụ trợ & test
* **Frontend Developer** – UI / UX web game.