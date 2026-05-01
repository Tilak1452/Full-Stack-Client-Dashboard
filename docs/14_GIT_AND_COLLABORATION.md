# FinSight AI — Git & Collaboration

> This document covers the Git workflow, branch strategy, collaboration conventions, and key files for onboarding new developers.

---

## Repository

| Item | Value |
|------|-------|
| **GitHub Repository** | `https://github.com/Tilak1452/Full-Stack-Client-Dashboard` |
| **Primary Branch** | `main` |
| **Monorepo** | Yes — frontend and backend are in the same repository |

---

## Branch Strategy

This project uses **feature branches** with pull requests into `main`. Direct commits to `main` are prohibited.

### Workflow

```bash
# 1. Always start from an up-to-date main
git checkout main
git pull origin main

# 2. Create a feature branch (use descriptive names)
git checkout -b feature/add-crypto-watchlist
# or: fix/portfolio-pl-calculation, refactor/agent-prompts, docs/update-api-ref

# 3. Make your changes and commit in logical chunks
git add .
git commit -m "feat: add crypto symbols to watchlist API"

# 4. Push your branch to GitHub
git push origin feature/add-crypto-watchlist

# 5. Open a Pull Request on GitHub
# - Add a description of what changed and why
# - Reference any related issues
# - Request review from a teammate

# 6. After approval, merge via GitHub UI (squash merge preferred for clean history)

# 7. Delete the feature branch after merge
git branch -d feature/add-crypto-watchlist
```

---

## Commit Message Conventions

Use the conventional commits format for clarity:

| Prefix | When to Use |
|--------|------------|
| `feat:` | New feature (e.g., `feat: add portfolio export to CSV`) |
| `fix:` | Bug fix (e.g., `fix: RSI calculation wrong for weekend data`) |
| `docs:` | Documentation only (e.g., `docs: update API reference for agent endpoint`) |
| `refactor:` | Code restructure without behavior change |
| `chore:` | Dependency updates, config changes (e.g., `chore: update yfinance to 0.2.38`) |
| `test:` | Adding or modifying tests |

---

## What Is GITIGNORED

The following are in `.gitignore` and must **never** be committed:

| Path | Reason |
|------|--------|
| `.env` | Contains secrets (database URL, API keys, JWT secrets) |
| `.venv/` | Machine-specific Python virtual environment |
| `frontend/node_modules/` | Node.js dependencies (installed from `package-lock.json`) |
| `frontend/.next/` | Next.js build output |
| `frontend/.env.local` | Frontend environment secrets |
| `*.db` | SQLite local database files |
| `backend/vector_db/` | ChromaDB local vector store (machine-specific) |
| `graphify-out/cache/` | Graphify incremental build cache |
| `__pycache__/` | Python bytecode cache |
| `.vscode/` | Editor-specific settings |

---

## What IS Committed

| Path | Reason |
|------|--------|
| `.env.example` | Safe template showing required variable names with empty values |
| `requirements.txt` | Python dependency list (the source of truth for Python deps) |
| `package.json` + `package-lock.json` | Node.js dependency list and lockfile |
| `frontend/tailwind.config.ts` | Design system configuration |
| `graphify-out/graph.json` | Knowledge graph (updated by git hook) |
| `graphify-out/GRAPH_REPORT.md` | Human-readable architecture summary |
| All source code | `backend/`, `frontend/src/`, `docs/` |

---

## Key Collaboration Files

| File | Purpose |
|------|---------|
| `requirements.txt` | Python dependencies — update after `pip install <pkg>` with `pip freeze > requirements.txt` |
| `frontend/package-lock.json` | Node.js lockfile — always commit this; do not regenerate without reason |
| `.env.example` | Template for `.env` — always keep in sync when adding new env vars |
| `docs/` | This documentation set — update when adding features |
| `redundancy_cleanup.md` | Historical log of what was deleted on April 29, 2026 (for reference) |

---

## Adding New Dependencies

### Python Backend

```bash
# Activate venv
.\.venv\Scripts\activate

# Install the package
pip install <package-name>

# Freeze to requirements.txt
pip freeze > requirements.txt

# Commit the updated requirements.txt
git add requirements.txt
git commit -m "chore: add <package-name> dependency"
```

### Frontend (Node.js)

```bash
cd frontend

# Install and save to package.json
npm install <package-name>

# Commit both package.json and package-lock.json
git add package.json package-lock.json
git commit -m "chore: add <package-name> dependency"
```

---

## Onboarding a New Developer

Steps for a new team member to get the project running from scratch:

1. **Clone the repo:** `git clone https://github.com/Tilak1452/Full-Stack-Client-Dashboard.git`
2. **Read `docs/03_ENVIRONMENT_SETUP.md`** — covers Python venv, `.env` creation, frontend setup.
3. **Get secrets from the team lead:** `DATABASE_URL`, `SUPABASE_JWT_SECRET`, Supabase URL and anon key, at least one LLM API key.
4. **Create `.env`** from `.env.example` and fill in the secrets.
5. **Create `frontend/.env.local`** with Supabase URL and anon key.
6. **Install Python deps:** `pip install -r requirements.txt`
7. **Install Node deps:** `cd frontend && npm install`
8. **Run both servers** per `docs/03_ENVIRONMENT_SETUP.md` Section 6.
9. **Verify:** `http://localhost:8000/health` → `{"status":"ok"}` and `http://localhost:3000` → login page.

For detailed step-by-step instructions with screenshots, see `git_guide.md` in the project root.

---

## Database Migrations and Team Coordination

Because all developers share the **same Supabase PostgreSQL database**, database migrations have immediate effect on everyone.

**Protocol when adding a new model column:**
1. Add the column to the SQLAlchemy model file.
2. Add the `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` statement to `migrate.py`.
3. Run `python migrate.py` **once** — this fixes the shared cloud database for all team members.
4. Commit the updated model file and `migrate.py` together.
5. Notify the team: *"Migration run for `<column_name>` on `<table>`"*.

Team members do **not** need to run the migration themselves — since the database is shared, one run fixes it for everyone.

See `15_DATABASE_MIGRATIONS.md` for full details.
