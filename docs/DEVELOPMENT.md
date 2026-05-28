# GoodCheck — Developer Guide

## การตั้งค่าสภาพแวดล้อม

### ข้อกำหนดเบื้องต้น

- Python 3.8+
- SQLite3 (มาพร้อม Python)

### Setup Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env           # แก้ไข SECRET_KEY และ JWT_SECRET_KEY
python run.py                  # เปิดที่ http://localhost:5050
```

### Seed ข้อมูลทดสอบ

```bash
cd backend
source .venv/bin/activate
python seed.py
```

### Setup Frontend

```bash
cd UI1
python3 -m http.server 8000    # เปิดที่ http://localhost:8000
```

### ใช้ Makefile (แนะนำ)

```bash
make install       # ติดตั้ง dependencies ครั้งแรก
make env           # สร้าง .env จาก .env.example
make dev           # เปิดทั้ง backend + frontend
make seed          # seed ข้อมูลทดสอบ
make test-api      # รัน API smoke tests
make check         # ตรวจ syntax Python อย่างเร็ว
make clean         # ลบ __pycache__
```

ค่าที่ override ได้ตอนรัน Makefile:

```bash
API_PORT=5051 FRONTEND_PORT=8010 make dev
VENV_DIR=backend/venv make dev-backend
```

---

## โครงสร้าง Backend

```
backend/app/
├── __init__.py          # Flask app factory
├── models.py            # SQLAlchemy models (User, Product, Order …)
├── constants.py         # Product categories, conditions, locations, statuses
├── auth.py              # Blueprint: /api/auth/*
├── product_routes.py    # Blueprint: /api/products/*
├── order_routes.py      # Blueprint: /api/orders/*
├── chat_routes.py       # Blueprint: /api/chats/*
├── admin_routes.py      # Blueprint: /api/admin/*
├── favorite_routes.py   # Blueprint: /api/favorites/*
├── review_routes.py     # Blueprint: /api/products/<id>/reviews
├── validators.py        # Input validation helpers
├── permissions.py       # Role-based access helpers
├── errors.py            # Global error handlers
└── runtime_setup.py     # DB schema checks + default admin
```

### เพิ่ม Blueprint ใหม่

```python
# 1. สร้างไฟล์ backend/app/my_routes.py
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

my_bp = Blueprint('my_feature', __name__, url_prefix='/api/my-feature')

@my_bp.route('/', methods=['GET'])
@jwt_required()
def index():
    return jsonify({'status': 'ok'}), 200

# 2. Register ใน backend/app/__init__.py
from app.my_routes import my_bp
app.register_blueprint(my_bp)
```

---

## โครงสร้าง Frontend

```
UI1/
├── app.js              # Entry point — import และ init ทุก module
├── index.html          # HTML หลัก (modals อยู่ที่นี่)
├── styles.css          # Design tokens + global styles
├── js/
│   ├── state.js        # Global state (products, user, favorites)
│   ├── api.js          # ฟังก์ชัน fetch ทั้งหมด
│   ├── i18n.js         # i18n engine (EN/TH, THB/USD)
│   ├── auth.js         # Login/Register modal
│   ├── ui.js           # renderProducts, renderCategories …
│   ├── filters.js      # Filter + search logic
│   ├── payment.js      # Payment modal + order flow
│   ├── orders.js       # My Orders modal
│   ├── seller.js       # Seller Hub modal
│   ├── admin.js        # Admin Panel modal
│   ├── chat.js         # Chat modal
│   ├── notifications.js # Toast notifications
│   ├── utils.js        # formatPrice, timeAgo, refreshIcons …
│   └── tour.js         # Onboarding tour
└── locales/
    ├── en.json         # English translations
    └── th.json         # Thai translations
```

ค่า `API_BASE_URL` จะ resolve อัตโนมัติไปที่ `http://<host>:5050/api` เมื่อ frontend เปิดด้วย `http.server` และจะใช้ `/api` บน origin เดียวกันเมื่อเปิดผ่าน Flask backend ที่ port `5050` โดยตรง ถ้าต้อง override ชั่วคราวให้ตั้งใน browser console:

```js
localStorage.setItem("GOODCHECK_API_BASE_URL", "http://localhost:5051/api");
```

### เพิ่ม Module ใหม่

```js
// 1. สร้าง UI1/js/my_feature.js
import { t } from './i18n.js';
import { showToast } from './notifications.js';

export const bindMyFeature = () => {
  document.getElementById('myBtn')?.addEventListener('click', () => {
    showToast(t('my_feature.hello'), 'info');
  });
};

// 2. Import และ bind ใน UI1/app.js
import { bindMyFeature } from './js/my_feature.js';
// ...ภายใน init():
bindMyFeature();
```

### เพิ่ม Translation Key

```json
// UI1/locales/en.json
"my_feature.hello": "Hello from my feature"

// UI1/locales/th.json
"my_feature.hello": "สวัสดีจากฟีเจอร์ใหม่"
```

---

## i18n System

```js
import { t, getCurrency, onLocaleChange } from './js/i18n.js';

// แปล string
t('nav.my_orders')                        // → "My Orders" / "คำสั่งซื้อของฉัน"
t('payment.btn_pay', { price: '$10' })    // → "Pay $10 Securely"

// ดึง currency ปัจจุบัน
getCurrency()    // → 'THB' หรือ 'USD'

// callback เมื่อเปลี่ยนภาษา/สกุลเงิน
onLocaleChange(() => repopulateDropdowns());
```

---

## Code Style

### Python
- ใช้ snake_case สำหรับฟังก์ชันและตัวแปร
- ใช้ `@jwt_required()` สำหรับ protected routes
- ใช้ SQLAlchemy ORM เสมอ (ไม่ raw SQL)
- คืนค่า JSON ด้วย `jsonify({...})` และ HTTP status code

### JavaScript
- ใช้ ES Modules (import/export)
- ใช้ camelCase
- ใช้ `async/await` แทน `.then()`
- ตรวจ error ก่อนใช้ result เสมอ: `if (result?.error) ...`
- ใช้ `t()` สำหรับ user-facing strings ทุกตัว

---

## Debugging

### Backend
```bash
# เปิด Flask debug mode (auto-reload)
FLASK_DEBUG=True python run.py

# เปิด SQLite database
make db-shell
# หรือ: sqlite3 backend/instance/goodcheck.db
```

### Frontend
- F12 → Console: ดู errors ทั้งหมด
- F12 → Network: ดู API calls และ responses
- F12 → Application → Local Storage: ดู `access_token` และ `current_user`

---

## Common Pitfalls

| ปัญหา | วิธีแก้ |
|------|--------|
| CORS error เวลาเปิดด้วย `file://` | ใช้ `python3 -m http.server` แทน |
| 401 Unauthorized | ตรวจ token ใน localStorage |
| `t()` คืน key แทน text | ตรวจว่า key มีใน `en.json`/`th.json` |
| Image ไม่ขึ้น | ตรวจว่า `uploads/products/` มีอยู่ |
| Database ล็อก | ปิด SQLite shell ก่อนรัน migration |
| Filter ไม่เจอสินค้าที่ seed ไว้ | ตรวจว่า category/condition ใช้ value จาก `backend/app/constants.py` และ `UI1/js/state.js` |
