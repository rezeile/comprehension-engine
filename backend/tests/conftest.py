"""
Pytest configuration and cross-dialect helpers.

Adds a compilation rule so that PostgreSQL UUID columns render on SQLite
as CHAR(36) for in-memory unit tests.
"""

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import UUID as PG_UUID


@compiles(PG_UUID, "sqlite")
def compile_uuid_sqlite(type_, compiler, **kw):  # noqa: D401
    """Render PostgreSQL UUID as CHAR(36) on SQLite for tests."""
    return "CHAR(36)"


