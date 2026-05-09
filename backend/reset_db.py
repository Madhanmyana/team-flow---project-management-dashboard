"""
Run this once to drop all existing tables and recreate with correct UUID schema.
Usage: python reset_db.py
"""
import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def reset():
    print("Connecting to database...")
    engine = create_async_engine(
        DATABASE_URL,
        echo=True,
        connect_args={"statement_cache_size": 0} if "postgresql" in DATABASE_URL else {"check_same_thread": False}
    )

    from app.models import Base

    async with engine.begin() as conn:
        print("Dropping all existing tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("Recreating tables with correct UUID schema...")
        await conn.run_sync(Base.metadata.create_all)

    await engine.dispose()
    print("\nDone! Database reset successfully.")

asyncio.run(reset())
