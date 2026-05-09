"""
Add project_invitations table without dropping existing data.
Usage: python add_invitations_table.py
"""
import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def migrate():
    print("Connecting to database...")
    engine = create_async_engine(
        DATABASE_URL,
        echo=True,
        connect_args={"statement_cache_size": 0} if "postgresql" in DATABASE_URL else {"check_same_thread": False}
    )

    from app.models import Base, ProjectInvitation

    async with engine.begin() as conn:
        # Check if table exists first
        if "postgresql" in DATABASE_URL:
            result = await conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'project_invitations')"
            ))
            exists = result.scalar()
        else:
            result = await conn.execute(text(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='project_invitations'"
            ))
            exists = result.first() is not None

        if exists:
            print("Table 'project_invitations' already exists. Skipping.")
        else:
            print("Creating 'project_invitations' table...")
            await conn.run_sync(Base.metadata.create_all, tables=[ProjectInvitation.__table__])
            print("Table created successfully!")

    await engine.dispose()
    print("\nDone!")

asyncio.run(migrate())
