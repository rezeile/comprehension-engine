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

# Load environment variables
load_dotenv()

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Default to local PostgreSQL for development
    DATABASE_URL = "postgresql://postgres:dev@localhost:5432/comprehension_engine"
    print(f"Warning: DATABASE_URL not set. Using default: {DATABASE_URL}")

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
