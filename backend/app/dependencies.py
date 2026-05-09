from fastapi import Depends, HTTPException, status, Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from .database import get_db
from .models import User, ProjectMember, RoleEnum
from .auth import get_current_user

async def get_project_member(
    project_id: str = Path(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> ProjectMember:
    """Verifies that the user is a member of the project."""
    result = await db.execute(
        select(ProjectMember)
        .where(ProjectMember.project_id == project_id)
        .where(ProjectMember.user_id == current_user.id)
    )
    member = result.scalars().first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this project"
        )
    return member

async def require_admin(member: ProjectMember = Depends(get_project_member)) -> ProjectMember:
    """Strictly enforces Admin role."""
    if member.role != RoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin permissions required for this action."
        )
    return member

async def require_member_or_admin(member: ProjectMember = Depends(get_project_member)) -> ProjectMember:
    """Allows either Member or Admin."""
    return member
