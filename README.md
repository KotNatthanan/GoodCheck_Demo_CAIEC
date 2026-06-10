# GoodCheck 🛒

**ตลาดซื้อขายอุปกรณ์คอมพิวเตอร์มือสองระดับพรีเมียม**
พร้อมระบบตรวจสอบ, Escrow, และ i18n (EN/TH)

---

## Quick Start

```bash
# 1. เปิด Backend (terminal 1)
cd backend && source .venv/bin/activate && python run.py

# 2. เปิด Frontend (terminal 2)
cd UI1 && python3 -m http.server 8000

# หรือใช้ Makefile
make dev

```

> Backend: `hp://localhost:5050`tt
> Frontend: `http://localhost:8000`

---

## โครงสร้างโปรเจค

```
gcheck/
├── backend/          # Flask REST API
│   ├── app/          # Blueprints, models, validators
│   ├── config/       # Config classes (dev/prod)
│   ├── instance/     # SQLite runtime database (ignored)
│   ├── migrations/   # DB migrations
│   ├── uploads/      # Product images
│   ├── .env          # ตัวแปรสภาพแวดล้อม (ดู .env.example)
│   ├── run.py        # Entry point
│   ├── seed.py       # Seed ข้อมูลทดสอบ
│   └── requirements.txt
│
├── UI1/              # Frontend (Vanilla JS + CSS)
│   ├── js/           # ES Modules (api, auth, chat, filters, i18n …)
│   ├── locales/      # en.json, th.json
│   ├── index.html
│   ├── styles.css
│   └── app.js        # Entry point
│
├── docs/             # เอกสารรายละเอียด
│   ├── DEVELOPMENT.md  # การพัฒนา, code style, debugging
│   ├── API.md          # API endpoints ทั้งหมด
│   ├── FEATURES.md     # ฟีเจอร์และ roadmap
│   └── PROJECT_MAP.md  # แผนที่ module และ flow สำคัญ
│
├── scripts/          # helper scripts
│   └── test_api.sh   # ทดสอบ API อัตโนมัติ
│
├── Makefile          # คำสั่งลัด (make dev, make seed …)
├── docker-compose.yml
└── .gitignore
```

---

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Backend  | Flask, SQLAlchemy, Flask-JWT-Extended, Flask-CORS |
| Frontend | Vanilla JS (ES Modules), CSS variables, Lucide icons |
| Database | SQLite (dev) / PostgreSQL (prod) |
| i18n     | Custom i18n engine — EN/TH, THB/USD toggle |

---

## การตั้งค่าครั้งแรก

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # แก้ไข SECRET_KEY และ JWT_SECRET_KEY
python run.py

# Seed ข้อมูลทดสอบ (optional)
python seed.py
```

สำหรับรายละเอียดเพิ่มเติม → [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)
แผนที่โปรเจกและจุดแก้ไขหลัก → [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md)
API endpoints → [`docs/API.md`](docs/API.md)

---

## หมายเหตุ Security

- อย่า commit ไฟล์ `.env` — มีอยู่ใน `.gitignore` แล้ว
- เปลี่ยน `SECRET_KEY` และ `JWT_SECRET_KEY` ก่อน deploy production
- สำหรับ production ใช้ PostgreSQL และ HTTPS
