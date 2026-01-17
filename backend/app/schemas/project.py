from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.project_member import ProjectRole


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    key: str = Field(min_length=2, max_length=20, pattern=r"^[A-Z0-9_-]+$")
    description: str | None = Field(default=None, max_length=500)


class ProjectOut(BaseModel):
    id: int
    name: str
    key: str
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectMemberAdd(BaseModel):
    user_id: int | None = None
    email: EmailStr | None = None
    role: ProjectRole = ProjectRole.member


class ProjectMembershipOut(BaseModel):
    project_id: int
    user_id: int
    role: ProjectRole

    model_config = {"from_attributes": True}


class ProjectMemberOut(BaseModel):
    user_id: int
    name: str
    email: EmailStr
    role: ProjectRole