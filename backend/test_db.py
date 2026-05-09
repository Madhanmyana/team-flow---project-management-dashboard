import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def test_connection():
    url = os.getenv("DATABASE_URL")
    # Convert sqlalchemy+asyncpg to pure asyncpg
    clean_url = url.replace("postgresql+asyncpg://", "postgresql://")
    print(f"Attempting to connect to: {clean_url.split('@')[1]}")
    try:
        conn = await asyncpg.connect(clean_url)
        print("✅ SUCCESS: Connected to Supabase PostgreSQL!")
        await conn.close()
    except Exception as e:
        print(f"❌ FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())
