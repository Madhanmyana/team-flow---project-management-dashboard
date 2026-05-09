from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime
from .models import RoleEnum, TaskStatusEnum, TaskPriorityEnum, InvitationStatusEnum

# --- User Schemas ---
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    avatar_url: Optional[str] = None

class UserCreate(UserBase):
    pass

class UserResponse(UserBase):
    id: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# --- Project Schemas ---
class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    deadline: Optional[datetime] = None

class ProjectResponse(ProjectBase):
    id: str
    deadline: Optional[datetime] = None
    created_by_id: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Project Member Schemas ---
class ProjectMemberAdd(BaseModel):
    email: EmailStr
    role: RoleEnum = RoleEnum.MEMBER

class ProjectMemberUpdate(BaseModel):
    role: RoleEnum

class ProjectMemberResponse(BaseModel):
    project_id: str
    user_id: str
    role: RoleEnum
    joined_at: datetime
    user: UserResponse

    class Config:
        from_attributes = True

# --- Task Schemas ---
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: TaskStatusEnum = TaskStatusEnum.TODO
    priority: TaskPriorityEnum = TaskPriorityEnum.MEDIUM
    due_date: Optional[datetime] = None

class TaskCreate(TaskBase):
    assignee_id: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatusEnum] = None
    priority: Optional[TaskPriorityEnum] = None
    due_date: Optional[datetime] = None
    assignee_id: Optional[str] = None

class TaskResponse(TaskBase):
    id: str
    project_id: str
    assignee_id: Optional[str] = None
    created_by_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    assignee: Optional[UserResponse] = None

    class Config:
        from_attributes = True

# --- Activity Log Schemas ---
class ActivityLogResponse(BaseModel):
    id: str
    project_id: str
    user_id: Optional[str] = None
    action_type: str
    target: str
    detail: Optional[str] = None
    created_at: datetime
    
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

# --- Invitation Schemas ---
class InvitationResponse(BaseModel):
    id: str
    project_id: str
    invited_by_id: Optional[str] = None
    invited_user_id: str
    status: InvitationStatusEnum
    created_at: datetime
    
    project: Optional[ProjectResponse] = None
    invited_by: Optional[UserResponse] = None
    invited_user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

# --- Auth Schemas ---
class SignUp(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)

    @field_validator("password")
    @classmethod
    def strong_password(cls, v):
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one number")
        return v

class SignIn(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

