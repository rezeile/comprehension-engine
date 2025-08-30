#!/usr/bin/env python3
"""
Verify that the production database has the correct schema.
Run this after applying the database fix.
"""

import os
import sys
from sqlalchemy import create_engine, text

def verify_attachments_column(database_url):
    """Verify that the attachments column exists in production database."""
    try:
        engine = create_engine(database_url)
        
        with engine.connect() as conn:
            # Check if attachments column exists
            result = conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'conversation_turns' 
                AND column_name = 'attachments';
            """))
            
            column_exists = result.fetchone() is not None
            
            if column_exists:
                print("✅ SUCCESS: 'attachments' column exists in conversation_turns table")
                
                # Also list all columns for verification
                result = conn.execute(text("""
                    SELECT column_name, data_type 
                    FROM information_schema.columns 
                    WHERE table_name = 'conversation_turns' 
                    ORDER BY column_name;
                """))
                
                columns = result.fetchall()
                print("\nAll columns in conversation_turns table:")
                for col_name, col_type in columns:
                    mark = "✅" if col_name == "attachments" else "  "
                    print(f"{mark} {col_name}: {col_type}")
                    
                return True
            else:
                print("❌ ERROR: 'attachments' column is missing from conversation_turns table")
                return False
                
    except Exception as e:
        print(f"❌ ERROR: Failed to connect to database: {e}")
        return False


def verify_adaptive_learning_tables(database_url):
    """Verify that adaptive learning tables exist with key indexes."""
    try:
        engine = create_engine(database_url)
        with engine.connect() as conn:
            # Check tables existence
            res = conn.execute(text(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema='public' AND table_name IN (
                    'prompts','prompt_assignments','learning_analyses'
                )
                ORDER BY table_name;
                """
            ))
            tables = [r[0] for r in res]
            missing = sorted(list(set(['prompts','prompt_assignments','learning_analyses']) - set(tables)))

            # Check key indexes
            idx_checks = {
                'prompts': ['ix_prompts_scope_is_active'],
                'prompt_assignments': [
                    'ix_prompt_assignments_scope',
                    'ix_prompt_assignments_user_id',
                    'ix_prompt_assignments_conversation_id',
                ],
                'learning_analyses': ['ix_learning_analyses_user_conversation'],
            }
            missing_indexes = []
            for table_name, wanted_indexes in idx_checks.items():
                for idx in wanted_indexes:
                    res = conn.execute(text(
                        """
                        SELECT indexname FROM pg_indexes
                        WHERE schemaname='public' AND tablename=:t AND indexname=:i
                        """
                    ), {"t": table_name, "i": idx})
                    if res.fetchone() is None:
                        missing_indexes.append(idx)

            ok = not missing and not missing_indexes
            if ok:
                print("✅ SUCCESS: Adaptive learning tables and indexes present:")
                print("  tables:", tables)
            else:
                if missing:
                    print("❌ Missing tables:", missing)
                if missing_indexes:
                    print("⚠️  Missing indexes:", missing_indexes)
            return ok
    except Exception as e:
        print(f"❌ ERROR: Failed to verify adaptive learning tables: {e}")
        return False

if __name__ == "__main__":
    # Try to get database URL from environment
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("Please provide DATABASE_URL environment variable")
        print("Usage: DATABASE_URL=your_production_url python3 verify_production_schema.py")
        sys.exit(1)
    
    print("Verifying production database schema...")
    success = verify_attachments_column(database_url)
    # Also verify adaptive learning tables
    success_adaptive = verify_adaptive_learning_tables(database_url)
    
    if success and success_adaptive:
        print("\n🎉 Production database is ready!")
    else:
        print("\n⚠️  Production database is missing required columns/tables or indexes.")
        print("- To add attachments: ALTER TABLE conversation_turns ADD COLUMN attachments JSONB;")
        print("- To add adaptive learning tables: run Alembic upgrade")

    sys.exit(0 if (success and success_adaptive) else 1)
