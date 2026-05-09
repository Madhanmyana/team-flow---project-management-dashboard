from sqlalchemy.orm import joinedload
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from datetime import timedelta
import logging

from . import models, schemas, auth, dependencies
from .schemas import ProjectMemberAdd, ProjectMemberResponse
from .database import engine, get_db

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="TeamFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "https://team-flow-project-management-dashbo.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)

# --- Auth Routes ---
@app.post("/auth/signup", response_model=schemas.Token)
async def signup(data: schemas.SignUp, db: AsyncSession = Depends(get_db)):
    """Register a new user with name, email, and password."""
    # Check if email already exists
    result = await db.execute(select(models.User).where(models.User.email == data.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user with hashed password
    user = models.User(
        email=data.email,
        full_name=data.full_name,
        password_hash=auth.hash_password(data.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Return JWT
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/auth/signin", response_model=schemas.Token)
async def signin(data: schemas.SignIn, db: AsyncSession = Depends(get_db)):
    """Sign in with email and password."""
    result = await db.execute(select(models.User).where(models.User.email == data.email))
    user = result.scalars().first()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not auth.verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/auth/me", response_model=schemas.UserResponse)
async def get_me(current_user: models.User = Depends(auth.get_current_user)):
    """Returns the currently authenticated user."""
    return current_user


@app.post("/auth/google", response_model=schemas.Token)
async def google_auth(token_data: dict, db: AsyncSession = Depends(get_db)):
    """Accepts user info from Supabase OAuth session and returns our JWT."""
    email = token_data.get("email")
    name = token_data.get("name", "")
    avatar = token_data.get("avatar")

    if not email:
        raise HTTPException(status_code=400, detail="Missing email")

    # Find or create user
    result = await db.execute(select(models.User).where(models.User.email == email))
    user = result.scalars().first()
    
    if not user:
        user = models.User(email=email, full_name=name or email.split("@")[0], avatar_url=avatar)
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Update avatar if provided by Google
        if avatar and not user.avatar_url:
            user.avatar_url = avatar
            await db.commit()

    # Generate our JWT
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}


# --- Project Routes ---
@app.get("/projects")
async def get_projects(current_user: models.User = Depends(auth.get_current_user), db: AsyncSession = Depends(get_db)):
    """Returns only projects the user is a member of, with their role."""
    result = await db.execute(
        select(models.Project, models.ProjectMember.role)
        .join(models.ProjectMember)
        .where(models.ProjectMember.user_id == current_user.id)
    )
    rows = result.all()
    projects = []
    for project, role in rows:
        p = schemas.ProjectResponse.model_validate(project)
        projects.append({**p.model_dump(), "role": role.value})
    return projects

@app.get("/projects/{project_id}", response_model=schemas.ProjectResponse)
async def get_project(
    project_id: str,
    membership: models.ProjectMember = Depends(dependencies.get_project_member),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Project).where(models.Project.id == project_id))
    db_project = result.scalars().first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found")
    return db_project


@app.get("/projects/{project_id}/members", response_model=list[schemas.ProjectMemberResponse])
async def get_project_members(
    project_id: str,
    membership: models.ProjectMember = Depends(dependencies.get_project_member),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(models.ProjectMember)
        .options(joinedload(models.ProjectMember.user))
        .where(models.ProjectMember.project_id == project_id)
    )
    return result.scalars().all()

@app.post("/projects/{project_id}/members", response_model=schemas.InvitationResponse, status_code=201)
async def invite_project_member(
    project_id: str,
    member: schemas.ProjectMemberAdd,
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creates an invitation instead of directly adding a member."""
    # Verify caller is admin of the project
    result = await db.execute(
        select(models.ProjectMember)
        .where(models.ProjectMember.project_id == project_id)
        .where(models.ProjectMember.user_id == current_user.id)
    )
    pm = result.scalars().first()
    if not pm or pm.role != models.RoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can invite members",
        )
    # Check if user exists in TeamFlow
    result = await db.execute(select(models.User).where(models.User.email == member.email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not registered on TeamFlow. Please ask them to sign up first.")
    # Can't invite yourself
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot invite yourself")
    # Check if already a member
    existing = await db.execute(
        select(models.ProjectMember)
        .where(models.ProjectMember.project_id == project_id)
        .where(models.ProjectMember.user_id == user.id)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="User is already a member of this project")
    # Check for pending invitation
    existing_invite = await db.execute(
        select(models.ProjectInvitation)
        .where(models.ProjectInvitation.project_id == project_id)
        .where(models.ProjectInvitation.invited_user_id == user.id)
        .where(models.ProjectInvitation.status == models.InvitationStatusEnum.PENDING)
    )
    if existing_invite.scalars().first():
        raise HTTPException(status_code=400, detail="Invitation already sent to this user")
    # Create invitation
    invitation = models.ProjectInvitation(
        project_id=project_id,
        invited_by_id=current_user.id,
        invited_user_id=user.id,
    )
    db.add(invitation)
    # Log activity
    log = models.ActivityLog(
        project_id=project_id,
        user_id=current_user.id,
        action_type="invitation_sent",
        target=user.email,
    )
    db.add(log)
    await db.commit()
    await db.refresh(invitation)
    # Eagerly load relationships for response
    result = await db.execute(
        select(models.ProjectInvitation)
        .options(
            joinedload(models.ProjectInvitation.project),
            joinedload(models.ProjectInvitation.invited_by),
            joinedload(models.ProjectInvitation.invited_user),
        )
        .where(models.ProjectInvitation.id == invitation.id)
    )
    return result.scalars().first()


# --- Invitation Routes ---
@app.get("/invitations", response_model=list[schemas.InvitationResponse])
async def get_my_invitations(
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns all pending invitations for the current user."""
    result = await db.execute(
        select(models.ProjectInvitation)
        .options(
            joinedload(models.ProjectInvitation.project),
            joinedload(models.ProjectInvitation.invited_by),
            joinedload(models.ProjectInvitation.invited_user),
        )
        .where(models.ProjectInvitation.invited_user_id == current_user.id)
        .where(models.ProjectInvitation.status == models.InvitationStatusEnum.PENDING)
        .order_by(models.ProjectInvitation.created_at.desc())
    )
    return result.scalars().all()


@app.get("/projects/{project_id}/invitations", response_model=list[schemas.InvitationResponse])
async def get_project_invitations(
    project_id: str,
    membership: models.ProjectMember = Depends(dependencies.require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Returns pending invitations for a project (admin only)."""
    result = await db.execute(
        select(models.ProjectInvitation)
        .options(
            joinedload(models.ProjectInvitation.invited_by),
            joinedload(models.ProjectInvitation.invited_user),
        )
        .where(models.ProjectInvitation.project_id == project_id)
        .where(models.ProjectInvitation.status == models.InvitationStatusEnum.PENDING)
        .order_by(models.ProjectInvitation.created_at.desc())
    )
    return result.scalars().all()


@app.post("/invitations/{invitation_id}/accept")
async def accept_invitation(
    invitation_id: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept a pending invitation — adds user as project member."""
    result = await db.execute(
        select(models.ProjectInvitation)
        .options(joinedload(models.ProjectInvitation.project))
        .where(models.ProjectInvitation.id == invitation_id)
    )
    invitation = result.scalars().first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if invitation.invited_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="This invitation is not for you")
    if invitation.status != models.InvitationStatusEnum.PENDING:
        raise HTTPException(status_code=400, detail="Invitation is no longer pending")

    # Mark accepted
    invitation.status = models.InvitationStatusEnum.ACCEPTED
    # Add as project member
    new_member = models.ProjectMember(
        project_id=invitation.project_id,
        user_id=current_user.id,
        role=models.RoleEnum.MEMBER,
    )
    db.add(new_member)
    # Log activity
    log = models.ActivityLog(
        project_id=invitation.project_id,
        user_id=current_user.id,
        action_type="member_joined",
        target=current_user.email,
        detail="Accepted invitation",
    )
    db.add(log)
    await db.commit()
    return {"ok": True, "project_name": invitation.project.name}


@app.post("/invitations/{invitation_id}/decline")
async def decline_invitation(
    invitation_id: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Decline a pending invitation."""
    result = await db.execute(
        select(models.ProjectInvitation)
        .where(models.ProjectInvitation.id == invitation_id)
    )
    invitation = result.scalars().first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if invitation.invited_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="This invitation is not for you")
    if invitation.status != models.InvitationStatusEnum.PENDING:
        raise HTTPException(status_code=400, detail="Invitation is no longer pending")

    invitation.status = models.InvitationStatusEnum.DECLINED
    await db.commit()
    return {"ok": True}

@app.post("/projects", response_model=schemas.ProjectResponse)
async def create_project(project: schemas.ProjectCreate, current_user: models.User = Depends(auth.get_current_user), db: AsyncSession = Depends(get_db)):
    """Creates a project and automatically makes the creator an ADMIN."""
    # Check for duplicate name
    existing = await db.execute(
        select(models.Project).where(func.lower(models.Project.name) == project.name.strip().lower())
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="A project with this name already exists")
    db_project = models.Project(
        name=project.name.strip(),
        description=project.description,
        deadline=project.deadline,
        created_by_id=current_user.id
    )
    db.add(db_project)
    await db.commit()
    await db.refresh(db_project)

    # Add creator as ADMIN
    admin_member = models.ProjectMember(project_id=db_project.id, user_id=current_user.id, role=models.RoleEnum.ADMIN)
    db.add(admin_member)
    
    # Log activity
    log = models.ActivityLog(project_id=db_project.id, user_id=current_user.id, action_type="project_created", target=project.name)
    db.add(log)
    
    await db.commit()
    return db_project

@app.delete("/projects/{project_id}/members/{user_id}")
async def remove_project_member(
    project_id: str,
    user_id: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify caller is admin of the project
    result = await db.execute(
        select(models.ProjectMember)
        .where(models.ProjectMember.project_id == project_id)
        .where(models.ProjectMember.user_id == current_user.id)
    )
    pm = result.scalars().first()
    if not pm or pm.role != models.RoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can remove members",
        )
    
    # Cannot remove yourself
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Admins cannot remove themselves")

    result = await db.execute(
        select(models.ProjectMember)
        .where(models.ProjectMember.project_id == project_id)
        .where(models.ProjectMember.user_id == user_id)
    )
    member = result.scalars().first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
        
    await db.delete(member)
    await db.commit()
    return {"ok": True}


# --- Dashboard Summary ---
@app.get("/dashboard/summary")
async def get_dashboard_summary(
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns all data needed for the dashboard in a single request."""
    # Get user's project IDs
    result = await db.execute(
        select(models.ProjectMember.project_id)
        .where(models.ProjectMember.user_id == current_user.id)
    )
    project_ids = [row[0] for row in result.all()]
    
    if not project_ids:
        return {
            "projects": [],
            "tasks": [],
            "activity": []
        }

    # Get projects
    projects_result = await db.execute(
        select(models.Project).where(models.Project.id.in_(project_ids))
    )
    projects = projects_result.scalars().all()

    # Get tasks (Admins see all tasks in these projects, Members see assigned tasks)
    # We need to check role for each project, but for simplicity in dashboard summary:
    # Let's get all tasks where user is assignee OR they are admin of the project.
    
    # First, get roles per project
    role_result = await db.execute(
        select(models.ProjectMember.project_id, models.ProjectMember.role)
        .where(models.ProjectMember.user_id == current_user.id)
    )
    roles = {row[0]: row[1] for row in role_result.all()}
    
    admin_project_ids = [pid for pid, role in roles.items() if role == models.RoleEnum.ADMIN]
    member_project_ids = [pid for pid, role in roles.items() if role == models.RoleEnum.MEMBER]

    tasks_query = select(models.Task).options(joinedload(models.Task.assignee)).where(
        (models.Task.project_id.in_(admin_project_ids)) |
        ((models.Task.project_id.in_(member_project_ids)) & (models.Task.assignee_id == current_user.id))
    )
    tasks_result = await db.execute(tasks_query)
    tasks = tasks_result.scalars().all()

    # Get activity
    activity_result = await db.execute(
        select(models.ActivityLog)
        .options(joinedload(models.ActivityLog.user))
        .where(models.ActivityLog.project_id.in_(project_ids))
        .order_by(models.ActivityLog.created_at.desc())
        .limit(15)
    )
    activity = activity_result.scalars().all()

    return {
        "projects": projects,
        "tasks": tasks,
        "activity": activity
    }


# --- Task Routes ---
@app.get("/projects/{project_id}/tasks", response_model=list[schemas.TaskResponse])
async def get_tasks(
    project_id: str, 
    membership: models.ProjectMember = Depends(dependencies.get_project_member), 
    db: AsyncSession = Depends(get_db)
):
    """Admins see all tasks. Members see only assigned tasks."""
    if membership.role == models.RoleEnum.ADMIN:
        query = (select(models.Task).options(joinedload(models.Task.assignee)).where(models.Task.project_id == project_id)
)
    else:
        query = (select(models.Task).options(joinedload(models.Task.assignee)).where(models.Task.project_id == project_id).where(models.Task.assignee_id == membership.user_id)
)
        
    result = await db.execute(query)
    return result.scalars().all()

@app.post("/projects/{project_id}/tasks", response_model=schemas.TaskResponse)
async def create_task(
    project_id: str,
    task: schemas.TaskCreate,
    membership: models.ProjectMember = Depends(dependencies.get_project_member),
    db: AsyncSession = Depends(get_db)
):
    """
    Admins can assign anyone.
    Members can only self-assign.
    """
    if membership.role == models.RoleEnum.MEMBER:
        if task.assignee_id and task.assignee_id != membership.user_id:
            raise HTTPException(status_code=403, detail="Members can only self-assign tasks.")
            
    db_task = models.Task(**task.model_dump(), project_id=project_id, created_by_id=membership.user_id)
    db.add(db_task)
    
    log = models.ActivityLog(project_id=project_id, user_id=membership.user_id, action_type="task_created", target=task.title)
    db.add(log)
    
    await db.commit()
    await db.refresh(db_task)
    return db_task

@app.put("/projects/{project_id}/tasks/{task_id}", response_model=schemas.TaskResponse)
async def update_task(
    project_id: str,
    task_id: str,
    task_update: schemas.TaskUpdate,
    membership: models.ProjectMember = Depends(dependencies.get_project_member),
    db: AsyncSession = Depends(get_db)
):
    """Enforces strict RBAC for updating tasks."""
    result = await db.execute(select(models.Task).where(models.Task.id == task_id).where(models.Task.project_id == project_id))
    db_task = result.scalars().first()
    
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    if membership.role == models.RoleEnum.MEMBER:
        # Check if it's their own task
        if db_task.assignee_id != membership.user_id:
            raise HTTPException(status_code=403, detail="Members can only edit their own assigned tasks.")
        
        # Members cannot reassign tasks
        if task_update.assignee_id is not None and task_update.assignee_id != db_task.assignee_id:
            raise HTTPException(status_code=403, detail="Members cannot assign tasks to others.")
            
        # Status enforcement: Members can only advance one step forward
        if task_update.status is not None and task_update.status != db_task.status:
            status_order = [models.TaskStatusEnum.TODO, models.TaskStatusEnum.IN_PROGRESS, models.TaskStatusEnum.REVIEW, models.TaskStatusEnum.DONE]
            current_idx = status_order.index(db_task.status)
            new_idx = status_order.index(task_update.status)
            
            if new_idx != current_idx + 1:
                raise HTTPException(status_code=403, detail="Members can only advance a task one step forward. Cannot skip or revert.")

    # Apply updates
    update_data = task_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_task, key, value)
        
    if "status" in update_data:
        log = models.ActivityLog(project_id=project_id, user_id=membership.user_id, action_type="status_changed", target=db_task.title, detail=f"Moved to {update_data['status']}")
        db.add(log)
        
    await db.commit()
    await db.refresh(db_task)
    return db_task

@app.delete("/projects/{project_id}/tasks/{task_id}")
async def delete_task(
    project_id: str,
    task_id: str,
    membership: models.ProjectMember = Depends(dependencies.require_admin), # ONLY ADMINS
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(models.Task).where(models.Task.id == task_id).where(models.Task.project_id == project_id))
    db_task = result.scalars().first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    await db.delete(db_task)
    
    log = models.ActivityLog(project_id=project_id, user_id=membership.user_id, action_type="task_deleted", target=db_task.title)
    db.add(log)
    
    await db.commit()
    return {"ok": True}


# --- Activity Log Routes ---
@app.get("/activity", response_model=list[schemas.ActivityLogResponse])
async def get_recent_activity(
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns recent activity across all user's projects."""
    # Get user's project IDs
    result = await db.execute(
        select(models.ProjectMember.project_id)
        .where(models.ProjectMember.user_id == current_user.id)
    )
    project_ids = [row[0] for row in result.all()]
    
    if not project_ids:
        return []

    result = await db.execute(
        select(models.ActivityLog)
        .options(joinedload(models.ActivityLog.user))
        .where(models.ActivityLog.project_id.in_(project_ids))
        .order_by(models.ActivityLog.created_at.desc())
        .limit(15)
    )
    return result.scalars().all()


@app.get("/projects/{project_id}/activity", response_model=list[schemas.ActivityLogResponse])
async def get_project_activity(
    project_id: str,
    membership: models.ProjectMember = Depends(dependencies.get_project_member),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models.ActivityLog)
        .options(joinedload(models.ActivityLog.user))
        .where(models.ActivityLog.project_id == project_id)
        .order_by(models.ActivityLog.created_at.desc())
        .limit(20)
    )
    return result.scalars().all()
