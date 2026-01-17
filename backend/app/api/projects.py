from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_maintainer, require_rate_limit
from app.models.user import User
from app.schemas.project import (
    ProjectCreate,
    ProjectMemberAdd,
    ProjectMemberOut,
    ProjectMembershipOut,
    ProjectOut,
)
from app.services.audit import write_audit_log
from app.services.auth import get_user_by_email, get_user_by_id
from app.services.projects import (
    add_member,
    create_project,
    get_membership,
    get_project,
    list_project_members,
    list_projects_for_user,
    remove_member,
)


router = APIRouter(prefix="/projects", tags=["projects"])


@router.post(
    "",
    response_model=ProjectOut,
    dependencies=[Depends(require_rate_limit)],
)
def create_project_endpoint(
    payload: ProjectCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectOut:
    project = create_project(db, payload.name, payload.key, payload.description, user.id)
    write_audit_log(db, user.id, "project_created", "project", project.id, None)
    return project


@router.get("", response_model=list[ProjectOut])
def list_projects(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ProjectOut]:
    return list_projects_for_user(db, user.id)


@router.post(
    "/{project_id}/members",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_rate_limit)],
)
def add_member_endpoint(
    project_id: int,
    payload: ProjectMemberAdd,
    user: User = Depends(require_maintainer),
    db: Session = Depends(get_db),
) -> dict:
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    if payload.user_id:
        target_user = get_user_by_id(db, payload.user_id)
    elif payload.email:
        target_user = get_user_by_email(db, payload.email)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide user_id or email",
        )
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    existing = get_membership(db, project_id, target_user.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="User already a member"
        )
    add_member(db, project_id, target_user.id, payload.role)
    write_audit_log(
        db,
        user.id,
        "member_added",
        "project",
        project_id,
        {"member_id": target_user.id, "role": payload.role},
    )
    return {"status": "added"}


@router.get("/{project_id}/membership", response_model=ProjectMembershipOut)
def get_membership_endpoint(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectMembershipOut:
    membership = get_membership(db, project_id, user.id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Project membership required",
        )
    return membership


@router.get("/{project_id}/members", response_model=list[ProjectMemberOut])
def list_members_endpoint(
    project_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectMemberOut]:
    membership = get_membership(db, project_id, user.id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Project membership required",
        )
    members = list_project_members(db, project_id)
    return [
        ProjectMemberOut(
            user_id=member.user_id,
            name=member.user.name,
            email=member.user.email,
            role=member.role,
        )
        for member in members
    ]


@router.delete(
    "/{project_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_rate_limit)],
)
def remove_member_endpoint(
    project_id: int,
    user_id: int,
    user: User = Depends(require_maintainer),
    db: Session = Depends(get_db),
) -> None:
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    removed = remove_member(db, project_id, user_id)
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Member not found"
        )
    write_audit_log(
        db,
        user.id,
        "member_removed",
        "project",
        project_id,
        {"member_id": user_id},
    )
    return None
