from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.project_member import ProjectMember


def get_project(db: Session, project_id: int) -> Project | None:
    return db.query(Project).filter(Project.id == project_id).first()


def create_project(db: Session, name: str, key: str, description: str | None) -> Project:
    project = Project(name=name, key=key, description=description)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def list_projects_for_user(db: Session, user_id: int) -> list[Project]:
    return (
        db.query(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .filter(ProjectMember.user_id == user_id)
        .all()
    )
