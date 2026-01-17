# IssueHub — Lightweight Bug Tracker

IssueHub is a minimal bug tracker where teams can create projects, file issues, comment, and manage status/assignees. It includes JWT auth, audit logging, rate limiting, and basic content guardrails.

## Tech Choices & Trade-offs
- Backend: FastAPI + SQLAlchemy + Alembic for clean REST API and migrations.
- DB: PostgreSQL for full enum/JSON support (required).
- Frontend: React + Vite for a fast, simple UI.
- Auth: JWT Bearer tokens stored in localStorage for simplicity.
- Guardrails: Input validation, PII/script detection, rate limiting, audit logs.

## Setup
### Prereqs
- Python 3.13
- Node.js 20+
- PostgreSQL 15+

### Backend
```
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create databases:
```
createdb issuehub
createdb issuehub_test
```

Configure env:
```
copy .env.example .env
```

Run migrations (from `backend`, use `python -m alembic`):
```
python -m alembic upgrade head
python -m alembic current
python -m alembic history
python -m alembic downgrade -1
python -m alembic stamp head
python -m alembic heads
python -m alembic check
python -m alembic revision --autogenerate -m "your message"
```

Start API:
```
uvicorn app.main:app --reload --port 8000
```

Logs are written to `backend/logs/app.log`. Audit trails are stored in the `audit_logs` table.

### Frontend
```
cd frontend
npm install
copy .env.example .env
npm run dev
```

## API (REST)
Base path: `/api`

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /me`
- `POST /projects`
- `GET /projects`
- `POST /projects/{id}/members` (payload: `{ user_id?, email?, role }`)
- `GET /projects/{id}/members`
- `GET /projects/{id}/membership`
- `GET /projects/{id}/issues` (returns `{ items, total, limit, offset }`)
- `POST /projects/{id}/issues`
- `GET /projects/{id}/issues/{issue_id}`
- `PATCH /projects/{id}/issues/{issue_id}`
- `DELETE /projects/{id}/issues/{issue_id}`
- `GET /issues/{issue_id}`
- `PATCH /issues/{issue_id}`
- `DELETE /issues/{issue_id}`
- `GET /issues/{issue_id}/comments`
- `POST /issues/{issue_id}/comments`

Errors are returned as `{ "error": { "code", "message", "details?" } }`.

## Tests
Backend tests use a dedicated Postgres database:
```
cd backend
set TEST_DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/issuehub_test
pytest
```

## Seed Script
Create sample data (users, projects, issues, comments):
```
cd backend
python -m scripts.seed
```

## Architecture Notes
- `backend/app/api`: route handlers
- `backend/app/services`: business logic
- `backend/app/models`: SQLAlchemy models
- `backend/app/schemas`: Pydantic schemas
- `backend/app/core`: settings, security, logging, guardrails, rate limits
- `backend/migrations`: Alembic migrations

## Known Limitations
- Basic localStorage JWT storage (would prefer secure cookies in production).
- Rate limiting is in-memory (not shared across instances).
- Simple PII detection (regex-based).

## With More Time
- Add pagination UI controls with total counts.
- Implement background jobs for notifications.
- Add richer role management and project settings.

