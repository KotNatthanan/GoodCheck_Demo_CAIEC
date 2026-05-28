# GoodCheck — Makefile
# ใช้งาน: make <command>

BACKEND_DIR := backend
FRONTEND_DIR := UI1
VENV_DIR ?= $(BACKEND_DIR)/.venv
VENV := $(CURDIR)/$(VENV_DIR)/bin/activate
PYTHON ?= python3
API_PORT ?= 5050
FRONTEND_PORT ?= 8000
DB_PATH ?= $(BACKEND_DIR)/instance/goodcheck.db

.PHONY: help dev dev-backend dev-frontend seed install env db-shell test-api check clean

help: ## แสดงคำสั่งทั้งหมด
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ─── Development ────────────────────────────────────────────────────────────

dev: ## เปิด backend + frontend พร้อมกัน (macOS/Linux)
	@echo "▶ Starting backend on :$(API_PORT) and frontend on :$(FRONTEND_PORT) ..."
	@(cd $(BACKEND_DIR) && . "$(VENV)" && PORT=$(API_PORT) python run.py) &
	@sleep 1
	@(cd $(FRONTEND_DIR) && $(PYTHON) -m http.server $(FRONTEND_PORT))

dev-backend: ## เปิดเฉพาะ backend
	cd $(BACKEND_DIR) && . "$(VENV)" && PORT=$(API_PORT) python run.py

dev-frontend: ## เปิดเฉพาะ frontend
	cd $(FRONTEND_DIR) && $(PYTHON) -m http.server $(FRONTEND_PORT)

# ─── Setup ──────────────────────────────────────────────────────────────────

install: ## ติดตั้ง Python dependencies
	$(PYTHON) -m venv $(VENV_DIR) && . "$(VENV)" && \
		pip install --upgrade pip && pip install -r $(BACKEND_DIR)/requirements.txt
	@echo "✅ Done. Copy .env.example → .env and edit your secrets."

env: ## สร้าง .env จาก .env.example (ถ้ายังไม่มี)
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env; \
		echo "✅ Created backend/.env — edit SECRET_KEY and JWT_SECRET_KEY"; \
	else \
		echo "ℹ️  backend/.env already exists, skipping."; \
	fi

# ─── Database ───────────────────────────────────────────────────────────────

seed: ## Seed ข้อมูลทดสอบเข้า database
	cd $(BACKEND_DIR) && . "$(VENV)" && python seed.py

db-shell: ## เปิด SQLite shell
	sqlite3 $(DB_PATH)

# ─── Testing ────────────────────────────────────────────────────────────────

test-api: ## รัน API smoke tests (ต้องเปิด backend ก่อน)
	API_BASE=http://localhost:$(API_PORT)/api bash scripts/test_api.sh

check: ## ตรวจ syntax Python อย่างเร็ว
	cd $(BACKEND_DIR) && . "$(VENV)" && python -m compileall app config run.py seed.py

# ─── Cleanup ────────────────────────────────────────────────────────────────

clean: ## ลบ __pycache__ และ .pyc files
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; true
	find . -name "*.pyc" -delete 2>/dev/null; true
	@echo "✅ Clean done."
