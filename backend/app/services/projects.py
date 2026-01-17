from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.project_member import ProjectMember, ProjectRole


def get_project(db: Session, project_id: int) -> Project | None:
    return db.query(Project).filter(Project.id == project_id).first()


def create_project(
    db: Session, name: str, key: str, description: str | None, owner_id: int
) -> Project:
    project = Project(name=name, key=key, description=description)
    db.add(project)
    db.commit()
    db.refresh(project)
    membership = ProjectMember(
        project_id=project.id, user_id=owner_id, role=ProjectRole.maintainer
    )
    db.add(membership)
    db.commit()
    return project


def list_projects_for_user(db: Session, user_id: int) -> list[Project]:
    return (
        db.query(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .filter(ProjectMember.user_id == user_id)
        .all()
    )


def add_member(
    db: Session, project_id: int, user_id: int, role: ProjectRole
) -> ProjectMember:
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
