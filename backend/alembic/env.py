import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context
from dotenv import load_dotenv
from urllib.parse import urlparse, urlunparse

# Load environment variables
load_dotenv()

# Add the parent directory to sys.path to import our modules
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

def _resolve_db_url() -> str:
    url = os.getenv("DATABASE_URL") or os.getenv("RAILWAY_DATABASE_URL") or os.getenv("POSTGRES_URL")
    if url:
        return url

    host = os.getenv("PGHOST") or os.getenv("POSTGRES_HOST")
    user = os.getenv("PGUSER") or os.getenv("POSTGRES_USER")
    password = os.getenv("PGPASSWORD") or os.getenv("POSTGRES_PASSWORD")
    dbname = os.getenv("PGDATABASE") or os.getenv("POSTGRES_DB") or os.getenv("POSTGRES_DATABASE") or "postgres"
    port = os.getenv("PGPORT") or os.getenv("POSTGRES_PORT") or "5432"

    if host and user and password:
        base = f"postgresql://{user}:{password}@{host}:{port}/{dbname}"
        try:
            parsed = urlparse(base)
            is_local = parsed.hostname in ("localhost", "127.0.0.1") or (parsed.hostname or "").endswith(".local")
            query = parsed.query
            if not is_local and "sslmode=" not in (query or ""):
                query = (query + ("&" if query else "")) + "sslmode=require"
            return urlunparse(parsed._replace(query=query))
        except Exception:
            return base

    default_url = "postgresql://postgres:dev@localhost:5432/comprehension_engine"
    print(f"Warning: DATABASE_URL not set. Using default: {default_url}")
    return default_url

# Set the database URL from environment
config.set_main_option("sqlalchemy.url", _resolve_db_url())

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
from database.models import Base
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
