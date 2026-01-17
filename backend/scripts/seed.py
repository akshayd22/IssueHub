from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.comment import Comment
from app.models.issue import Issue, IssuePriority, IssueStatus
from app.models.project import Project
from app.models.project_member import ProjectMember, ProjectRole
from app.models.user import User


def get_or_create_user(db: Session, name: str, email: str, password: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user
    user = User(name=name, email=email, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_or_create_project(
    db: Session, name: str, key: str, description: str | None
) -> Project:
    project = db.query(Project).filter(Project.key == key).first()
    if project:
        return project
    project = Project(name=name, key=key, description=description)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def ensure_membership(
    db: Session, project: Project, user: User, role: ProjectRole
) -> None:
    membership = (
        db.query(ProjectMember)
        .filter(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id,
        )
        .first()
    )
    if membership:
        return
    db.add(ProjectMember(project_id=project.id, user_id=user.id, role=role))
    db.commit()


def seed_issues(
    db: Session,
    project: Project,
    reporter: User,
    assignee: User,
    base_title: str,
) -> list[Issue]:
    existing = db.query(Issue).filter(Issue.project_id == project.id).count()
    if existing >= 10:
        return []

    issues: list[Issue] = []
    for idx in range(1, 11):
        issue = Issue(
            project_id=project.id,
            title=f"{base_title} #{idx}",
            description=f"Demo issue {idx} for {project.name}.",
            status=list(IssueStatus)[idx % len(IssueStatus)],
            priority=list(IssuePriority)[idx % len(IssuePriority)],
            reporter_id=reporter.id,
            assignee_id=assignee.id if idx % 2 == 0 else None,
            created_at=datetime.utcnow() - timedelta(days=idx),
            updated_at=datetime.utcnow() - timedelta(days=idx - 1),
        )
        db.add(issue)
        issues.append(issue)
    db.commit()
    return issues


def seed_comments(db: Session, issues: list[Issue], author: User) -> None:
    for issue in issues[:5]:
        existing = db.query(Comment).filter(Comment.issue_id == issue.id).count()
        if existing:
            continue
        db.add(
            Comment(
                issue_id=issue.id,
                author_id=author.id,
                body="Tracking this issue. Will update shortly.",
            )
        )
    db.commit()


def main() -> None:
    db = SessionLocal()
    try:
        maintainer = get_or_create_user(db, "Maya Maintainer", "maya@example.com", "password123")
        member = get_or_create_user(db, "Lee Member", "lee@example.com", "password123")

        alpha = get_or_create_project(db, "Alpha", "ALPHA", "Primary product work.")
        beta = get_or_create_project(db, "Beta", "BETA", "Internal tooling.")

        ensure_membership(db, alpha, maintainer, ProjectRole.maintainer)
        ensure_membership(db, alpha, member, ProjectRole.member)
        ensure_membership(db, beta, maintainer, ProjectRole.maintainer)

        alpha_issues = seed_issues(db, alpha, maintainer, member, "Alpha bug")
        beta_issues = seed_issues(db, beta, maintainer, maintainer, "Beta bug")

        seed_comments(db, alpha_issues, member)
        seed_comments(db, beta_issues, maintainer)
    finally:
        db.close()


if __name__ == "__main__":
    main()
