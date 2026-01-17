import enum

from sqlalchemy import Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ProjectRole(str, enum.Enum):
    member = "member"
    maintainer = "maintainer"


class ProjectMember(Base):
    __tablename__ = "project_members"

    project_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("projects.id"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), primary_key=True)
    role: Mapped[ProjectRole] = mapped_column(
        Enum(ProjectRole, name="project_role"), default=ProjectRole.member, nullable=False
    )

    project = relationship("Project", back_populates="members")
    user = relationship("User")
