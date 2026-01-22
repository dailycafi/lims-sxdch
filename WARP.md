# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a Laboratory Information Management System (LIMS) built with a FastAPI backend and Next.js frontend. The system manages laboratory samples, projects, storage, and audit trails with role-based access control.

**Technology Stack:**
- **Backend:** FastAPI + PostgreSQL + SQLAlchemy (async) + Alembic
- **Frontend:** Next.js (Pages Router) + TypeScript + Tailwind CSS + React Query + Zustand

**Key Ports:**
- Backend: `8002`
- Frontend: `3002`

## Common Development Commands

### Backend (FastAPI)

**Setup:**
```bash
cd backend
pip install -r requirements.txt
```

**Database initialization:**
```bash
cd backend
python init_db.py
```

**Run server:**
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
```

**Alternative run method:**
```bash
cd backend
python app/main.py
```

**API Documentation:**
- Swagger UI: http://localhost:8002/docs
- ReDoc: http://localhost:8002/redoc

**Bcrypt compatibility fix** (if encountering `passlib/bcrypt` errors with bcrypt 4.x):
```bash
cd backend
pip uninstall -y bcrypt
pip install -r requirements.txt --upgrade
```

### Frontend (Next.js)

**Setup:**
```bash
cd frontend
npm install
```

**Run dev server:**
```bash
cd frontend
npm run dev
```

**Build for production:**
```bash
cd frontend
npm run build
```

**Start production server:**
```bash
cd frontend
npm start
```

**Linting:**
```bash
cd frontend
npm run lint
```

## Architecture

### Backend Structure

```
backend/
├── app/
│   ├── api/v1/
│   │   ├── endpoints/     # Individual route handlers
│   │   ├── api.py         # API router registration
│   │   └── deps.py        # Dependency injection (auth, db sessions)
│   ├── core/              # Core configuration
│   │   ├── config.py      # Settings (DATABASE_URL, JWT config)
│   │   ├── database.py    # Database engine and session
│   │   └── security.py    # JWT and password hashing utilities
│   ├── models/            # SQLAlchemy models (database tables)
│   ├── schemas/           # Pydantic schemas (API validation)
│   ├── services/          # Business logic layer
│   └── main.py           # FastAPI app entry point
├── migrations/           # SQL migration scripts
├── init_db.py           # Database initialization script
└── init_roles.py        # Role/permission initialization
```

### Frontend Structure

```
frontend/
├── pages/                # Next.js page routes
│   ├── _app.tsx         # App wrapper with providers
│   ├── index.tsx        # Dashboard homepage
│   ├── login.tsx        # Login page
│   └── [feature]/       # Feature-specific pages
├── components/          # Reusable UI components (Catalyst-based)
├── services/            # API service layer (one per backend endpoint group)
├── lib/
│   ├── api.ts          # Axios instance with auth interceptors
│   └── token-manager.ts # JWT token management
├── store/               # Zustand state management
│   ├── auth.ts         # Authentication state
│   └── project.ts      # Project context state
├── hooks/              # Custom React hooks
└── types/              # TypeScript type definitions
```

### Key Architectural Patterns

**Backend:**
- **API Versioning:** All routes under `/api/v1` prefix
- **Async/await:** All database operations use SQLAlchemy async
- **Dependency Injection:** `deps.py` provides `get_db()` for sessions and `get_current_user()` for auth
- **Role-Based Access Control (RBAC):** Permissions defined in `init_roles.py`, enforced via endpoint dependencies
- **Service Layer:** Business logic separated from route handlers in `app/services/`

**Frontend:**
- **API Layer:** Each backend endpoint group has a corresponding service file (e.g., `samples.service.ts`)
- **State Management:** Zustand for global state (auth, project context), React Query for server state
- **Form Handling:** React Hook Form with validation
- **Authentication:** JWT tokens stored in memory with refresh token flow, managed by token-manager
- **Auth Interceptors:** Automatic token refresh on 401, with pending request queue to avoid race conditions
- **Component Library:** All UI components based on Catalyst design system

### Database Models

**Core entities:**
- `User` - System users with role assignments
- `Role` - RBAC roles (SYSTEM_ADMIN, LAB_DIRECTOR, TEST_MANAGER, SAMPLE_ADMIN, PROJECT_LEAD, ANALYST, QA)
- `Permission` - Granular permissions assigned to roles
- `Project` - Research projects containing samples
- `Sample` - Laboratory samples with lifecycle tracking (pending → received → in_storage → checked_out → returned/transferred/destroyed)
- `Organization` - External organizations (sponsors, clinical sites, transport companies)
- `StorageFreezer`, `StorageShelf`, `StorageRack`, `StorageBox` - Hierarchical storage structure

**Sample management workflow:**
1. Sample receive records (`SampleReceiveRecord`)
2. Sample borrow requests with approval flow (`SampleBorrowRequest`, `SampleBorrowItem`)
3. Sample transfer records (`SampleTransferRecord`, `SampleTransferItem`)
4. Sample destroy requests (`SampleDestroyRequest`)

**Audit trail:**
- `AuditLog` - Comprehensive audit logging for all critical operations

## Environment Configuration

### Backend (.env in backend/)

Required variables:
```
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/lims_db
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

Optional (for file uploads):
```
QINIU_ACCESS_KEY=...
QINIU_SECRET_KEY=...
QINIU_BUCKET_NAME=...
QINIU_BUCKET_DOMAIN=...
```

Generate a secure SECRET_KEY:
```python
import secrets
print(secrets.token_urlsafe(32))
```

### Frontend (.env.local in frontend/)

```
NEXT_PUBLIC_API_URL=http://localhost:8002/api/v1
```

## Database Operations

**Create PostgreSQL database:**
```sql
CREATE DATABASE lims_db;
```

**Initialize database with default data:**
```bash
cd backend
python init_db.py
```

This creates:
- All tables
- Default roles and permissions
- Default users:
  - Admin: `admin` / `admin123`
  - Sample Admin: `sample_admin` / `sample123`
- Sample organizations
- Storage hierarchy (freezers, shelves, racks, boxes)

**Database migrations:**
Manual SQL migration scripts are in `backend/migrations/`. Apply them directly to PostgreSQL if needed.

## Authentication & Authorization

**Authentication flow:**
1. User logs in via `/api/v1/auth/login` (returns access_token + refresh_token)
2. Access token stored in memory (not localStorage for security)
3. On 401 response, frontend automatically attempts token refresh via `/api/v1/auth/refresh`
4. If refresh fails, user is redirected to login

**Role hierarchy (from highest to lowest):**
- SYSTEM_ADMIN: Full system access
- LAB_DIRECTOR: Approval and management
- TEST_MANAGER: Test and analysis management
- SAMPLE_ADMIN: Sample and project CRUD
- PROJECT_LEAD: Sample requests and project management
- ANALYST: Sample usage and viewing
- QA: Quality audit access

**Permission system:**
- Permissions are defined in `backend/init_roles.py`
- Roles have multiple permissions
- Endpoints check permissions via dependency injection (see `app/api/v1/deps.py`)

## API Service Pattern

When adding new backend endpoints, follow this pattern:

1. **Create model** in `app/models/`
2. **Create schema** in `app/schemas/`
3. **Create service** in `app/services/` (business logic)
4. **Create endpoint** in `app/api/v1/endpoints/`
5. **Register router** in `app/api/v1/api.py`
6. **Create frontend service** in `frontend/services/`
7. **Use React Query** in components for data fetching

Example frontend service pattern:
```typescript
import { api } from '@/lib/api';

export const exampleAPI = {
  getAll: async () => {
    const response = await api.get('/endpoint');
    return response.data;
  },
  create: async (data: CreateData) => {
    const response = await api.post('/endpoint', data);
    return response.data;
  },
};
```

## Common Patterns

**Backend endpoint with auth:**
```python
from app.api.v1 import deps

@router.get("/")
async def get_items(
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    # Logic here
    pass
```

**Frontend data fetching with React Query:**
```typescript
import { useQuery } from '@tanstack/react-query';
import { exampleAPI } from '@/services/example.service';

const { data, isLoading } = useQuery({
  queryKey: ['example'],
  queryFn: exampleAPI.getAll
});
```

**Zustand store pattern:**
```typescript
import { create } from 'zustand';

interface Store {
  value: string;
  setValue: (value: string) => void;
}

export const useStore = create<Store>((set) => ({
  value: '',
  setValue: (value) => set({ value })
}));
```

## File Upload Handling

The system supports two methods:
1. **Qiniu Cloud Storage** (configured via QINIU_* env vars) - preferred for production
2. **Local uploads** (fallback) - files stored in `backend/uploads/` and served via `/uploads` static mount

## Sample Status Lifecycle

Understanding sample states is critical:
- `pending` → Sample expected but not yet received
- `received` → Sample physically received, being processed
- `in_storage` → Sample stored in freezer hierarchy
- `checked_out` → Sample borrowed for testing
- `returned` → Sample returned after testing
- `transferred` → Sample moved to another location/organization
- `destroyed` → Sample destroyed per protocol
- `archived` → Sample archived (project closure)

## Testing Strategy

The codebase does not currently have a comprehensive test suite. When adding tests:
- Backend: Use pytest with pytest-asyncio for async tests
- Frontend: Use the Next.js testing setup (likely Jest + React Testing Library)
- Check if test scripts exist in `package.json` or backend test directory before creating new patterns

## Important Notes

- **Chinese UI:** The system is primarily in Chinese (中文). Comments and UI text should be in Chinese unless specifically requested otherwise.
- **Bcrypt compatibility:** The codebase includes a workaround for bcrypt 4.x compatibility at the top of `backend/app/main.py` and `backend/init_db.py`. This should be maintained when making changes.
- **Async database operations:** All database operations must use async/await with AsyncSession.
- **CORS configuration:** Backend is configured to allow `http://localhost:3002` for local development. Update in production.
- **Token security:** Access tokens are intentionally NOT stored in localStorage (security best practice). Do not change this pattern.
- **Login cooldown:** After successful login, auth expired toasts are suppressed for 3 seconds to prevent false positives.

## Debugging Tips

**Backend logging:**
- Logging level configured in `app/main.py` (currently set to WARNING)
- Change to DEBUG for more verbose output during development

**Frontend API debugging:**
- Global debug flag: `window.__DEBUG_API__` is set to true
- API responses and auth flow are logged to console
- Check browser Network tab for request/response details

**Common issues:**
- "passlib/bcrypt error" → Run the bcrypt compatibility fix command
- "CORS error" → Check backend CORS middleware allows frontend origin
- "401 on every request" → Check token refresh logic in `lib/api.ts`
- "Database connection failed" → Verify PostgreSQL is running and DATABASE_URL is correct
