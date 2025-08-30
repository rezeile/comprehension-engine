"""
Database connection configuration for the Comprehension Engine.

This module handles SQLAlchemy database setup, connection pooling,
and session management for PostgreSQL.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from urllib.parse import urlparse, urlunparse, ParseResult

# Load environment variables
load_dotenv()

def _build_database_url_from_env() -> str:
    """
    Construct a PostgreSQL URL from environment variables.

    Priority:
    1) DATABASE_URL
    2) Common Railway / Postgres vars (PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT)
    3) POSTGRES_* fallbacks
    4) Local development default
    """
    url = os.getenv("DATABASE_URL") or os.getenv("RAILWAY_DATABASE_URL") or os.getenv("POSTGRES_URL")
    if url:
        return url

    # Assemble from discrete PG* vars
    host = os.getenv("PGHOST") or os.getenv("POSTGRES_HOST")
    user = os.getenv("PGUSER") or os.getenv("POSTGRES_USER")
    password = os.getenv("PGPASSWORD") or os.getenv("POSTGRES_PASSWORD")
    dbname = os.getenv("PGDATABASE") or os.getenv("POSTGRES_DB") or os.getenv("POSTGRES_DATABASE") or "postgres"
    port = os.getenv("PGPORT") or os.getenv("POSTGRES_PORT") or "5432"

    if host and user and password:
        base = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
        # Enforce SSL for non-local hosts unless explicitly disabled
        try:
            parsed: ParseResult = urlparse(base)
            is_local = parsed.hostname in ("localhost", "127.0.0.1") or (parsed.hostname or "").endswith(".local")
            query = parsed.query
            if not is_local:
                if "sslmode=" not in (query or ""):
                    query = (query + ("&" if query else "")) + "sslmode=require"
            secure = parsed._replace(query=query)
            return urlunparse(secure)
        except Exception:
            return base

    # Default to local PostgreSQL for development
    default_url = "postgresql://postgres:dev@localhost:5432/comprehension_engine"
    print(f"Warning: DATABASE_URL not set. Using default: {default_url}")
    return default_url

# Database configuration
DATABASE_URL = _build_database_url_from_env()

# Create SQLAlchemy engine for PostgreSQL
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Verify connections before use
    pool_recycle=300  # Recycle connections every 5 minutes
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create declarative base for models
Base = declarative_base()

def get_db():
    """
    Dependency to get database session.
    
    Yields:
        Session: SQLAlchemy database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """
    Initialize database by creating all tables.
    
    This should be called when the application starts.
    """
    from . import models  # Import models to register them
    Base.metadata.create_all(bind=engine)
    print("Database initialized successfully")
