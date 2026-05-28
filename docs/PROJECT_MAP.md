# GoodCheck — Project Map

เอกสารนี้ใช้เป็นจุดเริ่มต้นเวลาจะเพิ่มฟีเจอร์หรือแก้บั๊ก

## Runtime

- Backend dev server: `http://localhost:5050`
- Frontend dev server: `http://localhost:8000`
- API base: `http://localhost:5050/api`
- SQLite dev DB: `backend/instance/goodcheck.db`
- Uploaded product images: `backend/uploads/products/`

## Backend Entry Points

- `backend/run.py` โหลด `.env`, สร้าง Flask app, แล้วรัน server
- `backend/app/__init__.py` คือ app factory, register blueprints, สร้าง tables, และ serve frontend/static uploads
- `backend/config/config.py` รวม config จาก environment เช่น `DATABASE_URL`, `PORT`, `JWT_ACCESS_TOKEN_EXPIRES`
- `backend/app/constants.py` เก็บ domain values ที่ควรใช้ร่วมกัน เช่น product categories, conditions, locations, statuses

## Backend Modules

- `auth.py`: register, login, profile
- `product_routes.py`: product CRUD, upload image, listing filters, category/location options
- `order_routes.py`: order lifecycle และ role-gated status transitions
- `claim_routes.py`: buyer protection claim
- `seller_review_routes.py`: buyer review seller หลัง order เสร็จ
- `chat_routes.py`: buyer/seller conversation และ messages
- `favorite_routes.py`: favorites
- `admin_routes.py`: moderation, users, orders, claims, logs
- `validators.py`: request validation
- `permissions.py`: current user, active user, admin guard
- `runtime_setup.py`: schema compatibility checks และ default admin

## Frontend Entry Points

- `UI1/index.html` เก็บ DOM หลักและ modals
- `UI1/app.js` init i18n, auth state, filters, modals, admin/seller/chat/payment/orders
- `UI1/js/state.js` เก็บ global state, API base resolution, category definitions
- `UI1/js/api.js` รวม fetch wrappers ทุก endpoint
- `UI1/js/i18n.js` โหลด locale และ currency behavior

## Common Change Paths

- เพิ่ม API endpoint: เพิ่ม/แก้ blueprint ใน `backend/app/*_routes.py`, register ใน `backend/app/__init__.py` ถ้าเป็น blueprint ใหม่, เพิ่ม helper ใน `UI1/js/api.js`
- เพิ่ม field ของสินค้า: แก้ `Product` ใน `models.py`, `runtime_setup.py` ถ้าต้องรองรับ DB เก่า, `validators.py`, form ใน `UI1/index.html`, submit/render logic ใน `UI1/js/ui.js` หรือ `seller.js`
- เพิ่ม product category/condition: แก้ `backend/app/constants.py`, `UI1/js/state.js`, translation labels ใน `UI1/locales/*.json`, และ seed data
- แก้ order flow: เริ่มที่ transition maps ใน `backend/app/order_routes.py`, แล้วปรับ UI ใน `UI1/js/orders.js`, `UI1/js/seller.js`, `UI1/js/admin.js`
- เพิ่มข้อความบนหน้า: เพิ่ม key ใน `UI1/locales/en.json` และ `UI1/locales/th.json`, แล้วเรียกผ่าน `t()`

## Local Commands

```bash
make install
make env
make seed
make dev
make check
make test-api
```

ถ้า port ชน:

```bash
API_PORT=5051 FRONTEND_PORT=8010 make dev
```

ถ้า frontend ต้องชี้ backend port อื่น:

```js
localStorage.setItem("GOODCHECK_API_BASE_URL", "http://localhost:5051/api");
```
