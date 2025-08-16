"""
API routes module for the Comprehension Engine.

This module organizes all API endpoints into separate route modules
for better maintainability and organization.
"""

from .auth_routes import router as auth_router

__all__ = ["auth_router"]
