# FinSight AI — Database Migrations Guide

> This document explains the manual migration workflow for adding columns to existing database tables. FinSight AI does NOT use Alembic — it uses a hand-written `migrate.py` script instead.

---

## Why Manual Migrations?

SQLAlchemy's `Base.metadata.create_all()` only creates tables that **don't yet exist**. It never modifies existing tables — no column additions, no type changes, no constraint modifications.

This means: whenever a new column is added to a model file (`models/holding.py`, `models/transaction.py`, etc.), that column will exist in the Python code but **not** in the actual Supabase PostgreSQL database until an `ALTER TABLE` statement is run.

`migrate.py` provides a safe, re-runnable way to apply these `ALTER TABLE` statements.

---

## `migrate.py` Script

**Location:** `Full-Stack-Client-Dashboard/migrate.py` (project root)

Uses raw SQL via SQLAlchemy's `engine.connect()` to issue `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements. The `IF NOT EXISTS` clause makes every migration **idempotent** — safe to run multiple times without error.

---

## Running the Migration

```bash
# From the project root (not from backend/)
# Activate the virtual environment first:
.\.venv\Scripts\activate           # Windows
source .venv/bin/activate          # macOS/Linux

# Run the migration
python migrate.py
```

Expected output when all columns already exist (after the first run):
```
Starting schema migration for existing tables...
Holdings table: column 'cost_basis' already exists, skipping.
Holdings table: column 'current_price' already exists, skipping.
... (one line per column, already-exists messages are harmless)
Successfully updated 'holdings' table.
Successfully updated 'transactions' table.
Successfully updated existing cost_basis data.
Migration completed successfully.
```

Expected output on first run (on a database without the new columns):
```
Starting schema migration for existing tables...
Holdings table: added column 'cost_basis'.
Holdings table: added column 'current_price'.
...
Successfully updated 'holdings' table.
Successfully updated 'transactions' table.
Back-filling cost_basis for 12 existing holdings...
Migration completed successfully.
```

---

## What the Current Migration Does

### `holdings` Table — Columns Added

These columns were added via `ALTER TABLE` (not present in the original table schema):

| Column Added | SQL Type | Notes |
|-------------|---------|-------|
| `cost_basis` | `FLOAT` | `quantity × average_price`; back-filled for existing rows |
| `current_price` | `FLOAT` | Updated by `price_update_job.py` every 5 minutes |
| `current_value` | `FLOAT` | `quantity × current_price` |
| `unrealized_pl` | `FLOAT` | `current_value − cost_basis` |
| `unrealized_pl_pct` | `FLOAT` | `(unrealized_pl / cost_basis) × 100` |
| `realized_pl` | `FLOAT DEFAULT 0.0` | Cumulative realized P&L from FIFO sells |
| `realized_pl_pct` | `FLOAT DEFAULT 0.0` | `realized_pl` as % of cost basis |
| `first_purchase_date` | `TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP` | When position was first opened |
| `last_price_update` | `TIMESTAMP WITH TIME ZONE` | Nullable; when price was last refreshed |

### `holdings` Back-fill

After adding `cost_basis`, the migration runs:
```sql
UPDATE holdings
SET cost_basis = quantity * average_price
WHERE cost_basis IS NULL;
```

This ensures existing holdings have a valid `cost_basis` value rather than NULL.

### `transactions` Table — Columns Added

| Column Added | SQL Type | Notes |
|-------------|---------|-------|
| `total_amount` | `FLOAT` | `quantity × price` at time of transaction |
| `realized_pl` | `FLOAT` | FIFO realized P&L for SELL transactions; NULL for BUY |

---

## When to Run `migrate.py`

| Situation | Action Required |
|-----------|----------------|
| You pulled new code and a teammate added a model column | Run `python migrate.py` |
| You added a new column to a model yourself | Add the `ALTER TABLE` to `migrate.py`, commit it, run it, notify the team |
| First-time project setup on a completely fresh Supabase database | **NOT needed** — `create_all()` at startup handles brand-new tables |
| You are a teammate sharing the same `DATABASE_URL` | **NOT needed** — the shared database is already updated when one person ran the migration |

---

## Adding a New Column (Developer Workflow)

When you add a new field to a model file, follow this exact workflow:

### Step 1 — Add to the ORM model

```python
# In backend/app/models/holding.py, for example:
class Holding(Base):
    # ... existing columns ...
    new_column = Column(Float, nullable=True)  # ← Add here
```

### Step 2 — Add the ALTER TABLE to `migrate.py`

```python
# In migrate.py, add to the relevant section:
with engine.connect() as conn:
    conn.execute(text("""
        ALTER TABLE holdings
        ADD COLUMN IF NOT EXISTS new_column FLOAT;
    """))
    conn.commit()
    print("Holdings table: added column 'new_column'.")
```

### Step 3 — Test locally with direct connection

Temporarily ensure `DATABASE_URL` points to the **direct connection** (not the pooler), then run:
```bash
python migrate.py
```

Verify the column was added in Supabase Dashboard → Table Editor → holdings.

### Step 4 — Commit both files together

```bash
git add backend/app/models/holding.py migrate.py
git commit -m "feat: add new_column to holdings table"
```

### Step 5 — Notify teammates

Post in your team channel:
> "Migration run: added `new_column` to `holdings` table. No action needed by others — shared DB is updated."

---

## Supabase Session Pooler and Migrations

> **WARNING:** Do NOT run `migrate.py` while your `DATABASE_URL` points to the Supabase Session Pooler URL (`pooler.supabase.com`).

PgBouncer in transaction mode cannot handle multi-statement DDL operations. `migrate.py` uses `engine.connect()` with explicit commits, which may not work reliably through the pooler.

**Always run migrations using the direct connection:**
```env
DATABASE_URL=postgresql+psycopg2://postgres:[PASS]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
```

After the migration is complete, switch back to the pooler URL for production use.

---

## Why Not Alembic?

Alembic is the standard SQLAlchemy migration tool. The decision to use a manual `migrate.py` instead was made for simplicity:

- The project has a small, stable schema (4 tables).
- Migrations are infrequent.
- Alembic requires a separate `alembic/` directory, `alembic.ini`, and understanding of revision files.
- The `IF NOT EXISTS` pattern in `migrate.py` provides sufficient safety for a small team.

If the schema grows significantly or the team expands, migrating to Alembic would be the appropriate next step.
