from sqlalchemy.orm import Session

from app.models.project_member import ProjectMember, ProjectRole


def add_member(db: Session, project_id: int, user_id: int, role: ProjectRole) -> ProjectMember:
    membership = ProjectMember(project_id=project_id, user_id=user_id, role=role)
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return membership


def get_membership(db: Session, project_id: int, user_id: int) -> ProjectMember | None:
    return (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
        .first()
    )


def list_project_members(db: Session, project_id: int) -> list[ProjectMember]:
    return (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id)
        .all()
    )


def remove_member(db: Session, project_id: int, user_id: int) -> bool:
    membership = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
        .first()
    )
    if not membership:
        return False
    db.delete(membership)
    db.commit()
    return True
