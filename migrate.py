import os
from sqlalchemy import text
from backend.app.core.database import SessionLocal, engine

def migrate():
    print("Starting schema migration for existing tables...")
    with engine.connect() as conn:
        try:
            # Add columns to holdings
            # We use IF NOT EXISTS just in case some were already created manually
            conn.execute(text("ALTER TABLE holdings ADD COLUMN IF NOT EXISTS cost_basis FLOAT;"))
            conn.execute(text("ALTER TABLE holdings ADD COLUMN IF NOT EXISTS current_price FLOAT;"))
            conn.execute(text("ALTER TABLE holdings ADD COLUMN IF NOT EXISTS current_value FLOAT;"))
            conn.execute(text("ALTER TABLE holdings ADD COLUMN IF NOT EXISTS unrealized_pl FLOAT;"))
            conn.execute(text("ALTER TABLE holdings ADD COLUMN IF NOT EXISTS unrealized_pl_pct FLOAT;"))
            conn.execute(text("ALTER TABLE holdings ADD COLUMN IF NOT EXISTS realized_pl FLOAT DEFAULT 0.0;"))
            conn.execute(text("ALTER TABLE holdings ADD COLUMN IF NOT EXISTS realized_pl_pct FLOAT DEFAULT 0.0;"))
            conn.execute(text("ALTER TABLE holdings ADD COLUMN IF NOT EXISTS first_purchase_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;"))
            conn.execute(text("ALTER TABLE holdings ADD COLUMN IF NOT EXISTS last_price_update TIMESTAMP WITH TIME ZONE;"))
            print("Successfully updated 'holdings' table.")

            # Add columns to transactions
            conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS total_amount FLOAT;"))
            conn.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS realized_pl FLOAT;"))
            print("Successfully updated 'transactions' table.")

            # Calculate cost_basis for existing holdings if it's null
            conn.execute(text("UPDATE holdings SET cost_basis = quantity * average_price WHERE cost_basis IS NULL;"))
            print("Successfully updated existing cost_basis data.")

            conn.commit()
            print("Migration completed.")
        except Exception as e:
            print(f"Error during migration: {e}")
            conn.rollback()

if __name__ == "__main__":
    migrate()

# === AUTH: Users table safety check ===
# The users table is normally created by SQLAlchemy's create_all() on startup.
# This block is a fallback in case create_all() was skipped or failed.

try:
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                hashed_password VARCHAR(255) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMPTZ
            );
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_id ON users(id);"))
        conn.commit()
        print("Successfully ensured 'users' table exists.")
except Exception as e:
    print(f"Warning: Could not verify users table: {e}")
