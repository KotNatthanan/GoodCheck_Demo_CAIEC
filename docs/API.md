# GoodCheck — API Reference

Base URL: `http://localhost:5050/api`

> ⚠️ Routes ที่มี 🔒 ต้องส่ง `Authorization: Bearer <token>` header

---

## Authentication `/api/auth`

| Method | Endpoint | Auth | คำอธิบาย |
|--------|---------|------|---------|
| POST | `/auth/register` | ❌ | ลงทะเบียนผู้ใช้ใหม่ |
| POST | `/auth/login` | ❌ | เข้าสู่ระบบ → คืน JWT token |
| GET | `/auth/profile` | 🔒 | ดูโปรไฟล์ตัวเอง |
| PUT | `/auth/profile` | 🔒 | อัปเดตโปรไฟล์ |

### POST /auth/register
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "full_name": "string",  // optional
  "user_type": "buyer"    // "buyer" | "seller"
}
```

### POST /auth/login
```json
{ "email": "string", "password": "string" }
```
ได้รับ: `{ "access_token": "...", "user": {...} }`

---

## Products `/api/products`

| Method | Endpoint | Auth | คำอธิบาย |
|--------|---------|------|---------|
| GET | `/products` | ❌ | ดึงรายการสินค้า (filter + pagination) |
| GET | `/products/<id>` | ❌ | รายละเอียดสินค้า |
| POST | `/products` | 🔒 | สร้างสินค้าใหม่ (JSON) |
| PUT | `/products/<id>` | 🔒 | แก้ไขสินค้า |
| DELETE | `/products/<id>` | 🔒 | ลบสินค้า |
| GET | `/products/categories` | ❌ | รายการหมวดหมู่ |
| GET | `/products/locations` | ❌ | รายการจังหวัด |
| GET | `/products/my-listings` | 🔒 | สินค้าของ seller ตัวเอง |
| POST | `/products/upload-image` | 🔒 | อัปโหลดรูปภาพ (multipart) |
| POST | `/products/<id>/reviews` | 🔒 | เพิ่มรีวิว |

### GET /products — Query Parameters
| Param | Type | Default | คำอธิบาย |
|-------|------|---------|---------|
| `search` | string | — | ค้นหาจาก title |
| `category` | string | — | กรองตามหมวดหมู่ |
| `location` | string | — | กรองตามจังหวัด |
| `condition` | string | — | `Brand new` / `Like new` / `Good condition` / `Used` |
| `sort_by` | string | `created_at` | `price` / `rating` / `created_at` |
| `sort_order` | string | `desc` | `asc` / `desc` |
| `page` | int | 1 | หน้า |
| `per_page` | int | 12 | จำนวนต่อหน้า |

`/products/categories` และ `/products/locations` จะคืนค่าชุด default จาก `backend/app/constants.py` ก่อน แล้วค่อย append ค่าที่พบจริงใน approved listings เพื่อให้ form ใช้งานได้แม้ฐานข้อมูลยังว่าง

---

## Orders `/api/orders`

| Method | Endpoint | Auth | คำอธิบาย |
|--------|---------|------|---------|
| POST | `/orders` | 🔒 | สร้างออเดอร์ใหม่ |
| GET | `/orders` | 🔒 | ดึงออเดอร์ (`?role=buyer`/`seller`) |
| POST | `/orders/<id>/pay` | 🔒 | ชำระเงิน (mock card) |
| PUT | `/orders/<id>/status` | 🔒 | อัปเดตสถานะ |
| POST | `/orders/<id>/seller-review` | 🔒 | buyer รีวิว seller หลัง order เสร็จ |
| POST | `/orders/<id>/claim` | 🔒 | buyer เปิด buyer protection claim หลังจัดส่ง |

### Order Status Flow
```
pending_payment → paid → seller_shipped → inspection → inspection_passed → delivered → completed
                                                                                     ↘ cancelled
```

---

## Favorites `/api/favorites`

| Method | Endpoint | Auth | คำอธิบาย |
|--------|---------|------|---------|
| GET | `/favorites/ids` | 🔒 | รายการ ID ที่กด ❤️ |
| POST | `/favorites/<product_id>` | 🔒 | เพิ่มในรายการโปรด |
| DELETE | `/favorites/<product_id>` | 🔒 | ลบออกจากรายการโปรด |

---

## Seller Reviews `/api/sellers`

| Method | Endpoint | Auth | คำอธิบาย |
|--------|---------|------|---------|
| GET | `/sellers/<id>/reviews` | ❌ | รีวิว seller ล่าสุด + ค่าเฉลี่ย |

---

## Chats `/api/chats`

| Method | Endpoint | Auth | คำอธิบาย |
|--------|---------|------|---------|
| GET | `/chats` | 🔒 | ดึง conversations ทั้งหมด |
| POST | `/chats` | 🔒 | สร้าง conversation ใหม่ |
| GET | `/chats/<id>` | 🔒 | รายละเอียด conversation |
| POST | `/chats/<id>/messages` | 🔒 | ส่งข้อความ |

---

## Admin `/api/admin` 🔒 (admin only)

| Method | Endpoint | คำอธิบาย |
|--------|---------|---------|
| GET | `/admin/overview` | สถิติภาพรวม |
| GET | `/admin/products` | รายการสินค้าทั้งหมด |
| PUT | `/admin/products/<id>/moderation` | อนุมัติ/ปฏิเสธสินค้า |
| GET | `/admin/users` | รายการ users |
| PUT | `/admin/users/<id>/status` | ตั้งค่า account status |
| GET | `/admin/orders` | orders ทั้งระบบ |
| PUT | `/admin/orders/<id>/status` | อัปเดตสถานะ order |
| GET | `/admin/claims` | buyer protection claims |
| PUT | `/admin/claims/<id>` | อัปเดตสถานะ claim |
| GET | `/admin/logs` | activity logs |

---

## Health Check

```
GET /api/health → { "status": "ok" }
```

---

## Error Response Format

```json
{
  "error": true,
  "message": "คำอธิบายความผิดพลาด",
  "status": 400
}
```

| HTTP Code | ความหมาย |
|-----------|---------|
| 400 | Bad Request — ข้อมูลไม่ถูกต้อง |
| 401 | Unauthorized — token หมดอายุหรือไม่มี |
| 403 | Forbidden — ไม่มีสิทธิ์ |
| 404 | Not Found |
| 500 | Server Error |
