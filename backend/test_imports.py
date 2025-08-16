#!/usr/bin/env python3
"""
Simple script to test imports and identify issues
"""

try:
    print("Testing basic imports...")
    from fastapi import FastAPI, HTTPException, Depends
    print("✅ FastAPI imports successful")
    
    from sqlalchemy.orm import Session
    print("✅ SQLAlchemy imports successful")
    
    from prompts import prompt_manager
    from config import prompt_settings
    print("✅ Prompts imports successful")
    
    print("Testing database imports...")
    from database.connection import get_db, engine, SessionLocal, init_db
    print("✅ Database connection imports successful")
    
    from database.models import User, Conversation, ConversationTurn
    print("✅ Database models imports successful")
    
    from database import get_db, User, Conversation, ConversationTurn
    print("✅ Database module imports successful")
    
    print("\n🎉 All imports successful! The issue might be with uvicorn or virtual environment.")
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    print(f"   Module: {e.name if hasattr(e, 'name') else 'unknown'}")
except Exception as e:
    print(f"❌ Unexpected error: {e}")
