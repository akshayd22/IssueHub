from sqlalchemy.orm import Session

from app.dao import memberships as membership_dao
from app.dao import projects as project_dao
from app.models.project import Project
from app.models.project_member import ProjectMember, ProjectRole


def get_project(db: Session, project_id: int) -> Project | None:
    return project_dao.get_project(db, project_id)


def create_project(
    db: Session, name: str, key: str, description: str | None, owner_id: int
) -> Project:
    project = project_dao.create_project(db, name=name, key=key, description=description)
    membership_dao.add_member(db, project.id, owner_id, ProjectRole.maintainer)
    return project


def list_projects_for_user(db: Session, user_id: int) -> list[Project]:
    return project_dao.list_projects_for_user(db, user_id)


def add_member(
    db: Session, project_id: int, user_id: int, role: ProjectRole
) -> ProjectMember:
    return membership_dao.add_member(db, project_id, user_id, role)


def get_membership(db: Session, project_id: int, user_id: int) -> ProjectMember | None:
    return membership_dao.get_membership(db, project_id, user_id)


def list_project_members(db: Session, project_id: int) -> list[ProjectMember]:
    return membership_dao.list_project_members(db, project_id)


def remove_member(db: Session, project_id: int, user_id: int) -> bool:
    return membership_dao.remove_member(db, project_id, user_id)
