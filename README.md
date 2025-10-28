# Cứu hộ Miền Trung

Web cộng đồng báo cáo ngập lụt — Leaflet (OpenStreetMap) + Firebase.

## Hướng dẫn nhanh
1. Clone repo hoặc upload file.
2. Mở `app.js` và kiểm tra `firebaseConfig` (đã set sẵn nếu em dùng config đã cung cấp).
3. Upload thư mục lên GitHub.
4. Kết nối repo với Vercel → Deploy (mặc định).
5. Trên Firebase Console:
   - Bật Authentication (Email/Password).
   - Tạo Firestore (mới) hoặc Realtime DB nếu muốn, bật Storage.
   - Trong giai đoạn test, đặt rules tạm: allow read/write (sẽ hướng dẫn cấu hình an toàn sau).

## File chính
- index.html
- style.css
- app.js
- manifest.json (PWA)
- service-worker.js (caching cơ bản)
- vercel.json (CORS headers)
- /assets (logo + marker icons)

## Lưu ý bảo mật
Sau khi test xong, cập nhật rules Firestore/Storage để giới hạn write chỉ cho người dùng đã xác thực, hoặc cho admin quyền đặc biệt.