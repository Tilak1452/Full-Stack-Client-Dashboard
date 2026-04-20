import os
from sqlalchemy import text
from backend.app.core.database import SessionLocal, engine
from backend.app.core.database import Base
from backend.app.models.portfolio import Portfolio
from backend.app.models.holding import Holding
from backend.app.models.transaction import Transaction
from backend.app.models.alert import Alert

def migrate():
    print("User Isolation Migration: Wiping old tables and recreating...")
    
    # 1. Drop existing tables to clear out data and schema
    with engine.connect() as conn:
        try:
            print("Dropping legacy tables...")
            conn.execute(text("DROP TABLE IF EXISTS transactions CASCADE;"))
            conn.execute(text("DROP TABLE IF EXISTS holdings CASCADE;"))
            conn.execute(text("DROP TABLE IF EXISTS portfolios CASCADE;"))
            conn.execute(text("DROP TABLE IF EXISTS alerts CASCADE;"))
            conn.commit()
            print("Successfully dropped legacy tables.")
        except Exception as e:
            print(f"Error dropping tables: {e}")
            conn.rollback()
            return
            
    # 2. Recreate tables with the new schemas (including user_id)
    print("Recreating tables with per-user isolation schemas...")
    try:
        Base.metadata.create_all(bind=engine)
        print("Successfully recreated tables.")
    except Exception as e:
        print(f"Error recreating tables: {e}")

if __name__ == "__main__":
    migrate()
