# GoodCheck — Features & Roadmap

## ✅ ฟีเจอร์ที่เสร็จแล้ว

### Core Marketplace
- [x] ลงทะเบียน / เข้าสู่ระบบ (JWT)
- [x] โปรไฟล์ผู้ใช้ (Buyer / Seller)
- [x] CRUD สินค้า พร้อมอัปโหลดรูปภาพหลายรูป
- [x] ค้นหา + กรองสินค้า (หมวดหมู่, จังหวัด, สภาพ, ช่วงราคา)
- [x] เรียงลำดับ (ใหม่สุด, ราคา, rating)
- [x] รีวิวและ rating สินค้า
- [x] ระบบรายการโปรด (Favorites)

### Payment & Order Flow
- [x] Mock credit card payment modal
- [x] Order lifecycle: pending → paid → seller_shipped → inspection → delivered → completed
- [x] GoodCheck inspection escrow layer
- [x] My Orders modal พร้อม timeline

### Communication
- [x] Chat ระหว่าง buyer–seller
- [x] Toast notifications

### Admin
- [x] Admin dashboard: ภาพรวม, users, products, orders, logs
- [x] Product moderation (อนุมัติ/ปฏิเสธ)
- [x] User management (suspend/activate)

### Seller
- [x] Seller Hub: จัดการสินค้าตัวเอง
- [x] Order management สำหรับ seller

### Internationalization
- [x] สลับภาษา EN / TH
- [x] สลับสกุลเงิน THB / USD (พร้อม live rate banner)
- [x] Price filter labels เปลี่ยนตาม currency
- [x] Payment modal, Orders modal ทำงานกับ i18n

### UX
- [x] Dark / Light mode
- [x] Responsive design
- [x] Onboarding tour
- [x] Skeleton loading states

---

## 🔮 Roadmap

### Phase 2 (Next)
- [ ] Email notifications เมื่อสถานะ order เปลี่ยน
- [ ] Real-time notifications (SSE / WebSocket)
- [x] Seller rating system
- [ ] Product condition — เพิ่ม "Open Box"
- [x] Buyer protection claim flow

### Phase 3 (Future)
- [ ] Mobile App (React Native หรือ Flutter)
- [ ] AI product condition assessment
- [ ] Advanced analytics dashboard
- [ ] Stripe / Omise payment gateway จริง
- [ ] WhatsApp / LINE notification integration
