# Hướng dẫn cập nhật Contract

Lỗi bạn gặp phải là do **Frontend** đã gửi tên mới đi, nhưng **Contract** trên mạng vẫn là phiên bản cũ (chưa nhận tham số tên).

Để sửa lỗi này, bạn cần publish phiên bản code mới nhất lên mạng lưới Sui:

1.  Mở Terminal (Ctrl+`).
2.  Chạy lệnh sau để deploy:
    ```bash
    sui client publish --gas-budget 100000000 contracts
    ```
3.  Sau khi chạy thành công, tìm dòng **packageId** trong kết quả (thường bắt đầu bằng `0x...`).
4.  Copy packageId đó.
5.  Mở file `frontend/src/constants.ts`.
6.  Thay thế giá trị `PACKAGE_ID` cũ bằng cái mới.

Sau đó thử lại, lỗi sẽ biến mất!
