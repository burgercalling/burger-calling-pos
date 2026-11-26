# Burger Calling POS V1.0

100% Pure Vegetarian QSR & Multi-Franchise Point of Sale System.

## Tech Stack
- **Frontend:** Next.js 15 (App Router), React, TypeScript, Tailwind CSS, Shadcn UI, TanStack Query, React Hook Form, Zod
- **Backend:** FastAPI, Python 3.13+, SQLAlchemy 2.0, Alembic, Pydantic v2, JWT (`python-jose` + `passlib[bcrypt]`)
- **Database:** Neon PostgreSQL
- **Media Storage:** Local Backend Storage (`app/uploads/` served via FastAPI `StaticFiles`, abstracted behind `app/storage/` for future S3/GCS/Supabase swap)
- **Hosting:** GitHub → Vercel (Frontend) + Render (Backend)

## Local Quickstart

### 1. Backend
```bash
cd backend
cp .env.example .env
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### 2. Frontend
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

### 3. Tests
```bash
cd backend
pip install -r requirements-dev.txt
TEST_DATABASE_URL="postgresql+psycopg://..." pytest
```
