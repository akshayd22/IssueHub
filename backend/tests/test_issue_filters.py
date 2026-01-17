from datetime import datetime

from fastapi.testclient import TestClient


def _signup_and_login(client: TestClient, name: str, email: str, password: str) -> tuple[dict, dict]:
    signup = client.post("/api/auth/signup", json={"name": name, "email": email, "password": password})
    login = client.post("/api/auth/login", json={"email": email, "password": password})
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, signup.json()


def _create_issue(client: TestClient, project_id: int, headers: dict, title: str, priority: str, assignee_id: int | None):
    response = client.post(
        f"/api/projects/{project_id}/issues",
        json={
            "title": title,
            "description": f"{title} description",
            "priority": priority,
            "assignee_id": assignee_id,
        },
        headers=headers,
    )
    assert response.status_code == 201
    return response.json()


def test_issue_filters_and_sorting(client: TestClient):
    maintainer_headers, maintainer = _signup_and_login(
        client, "Filter Maintainer", "filter@example.com", "filter123"
    )
    _member_headers, member = _signup_and_login(
        client, "Filter Member", "filtermember@example.com", "member12345"
    )

    project = client.post(
        "/api/projects",
        json={"name": "Filter Project", "key": "FILTER", "description": "Filters"},
        headers=maintainer_headers,
    ).json()

    add_member = client.post(
        f"/api/projects/{project['id']}/members",
        json={"user_id": member["id"], "role": "member"},
        headers=maintainer_headers,
    )
    assert add_member.status_code == 201

    issue_login = _create_issue(
        client, project["id"], maintainer_headers, "Login bug", "critical", member["id"]
    )
    issue_ui = _create_issue(
        client, project["id"], maintainer_headers, "UI glitch", "low", None
    )
    issue_api = _create_issue(
        client, project["id"], maintainer_headers, "API error", "high", member["id"]
    )

    close_issue = client.patch(
        f"/api/projects/{project['id']}/issues/{issue_api['id']}",
        json={"status": "closed"},
        headers=maintainer_headers,
    )
    assert close_issue.status_code == 200

    search = client.get(
        f"/api/projects/{project['id']}/issues?q=login",
        headers=maintainer_headers,
    )
    titles = [item["title"] for item in search.json()["items"]]
    assert "Login bug" in titles
    assert "UI glitch" not in titles

    status_filter = client.get(
        f"/api/projects/{project['id']}/issues?status=closed",
        headers=maintainer_headers,
    )
    status_titles = [item["title"] for item in status_filter.json()["items"]]
    assert "API error" in status_titles
    assert "UI glitch" not in status_titles

    priority_filter = client.get(
        f"/api/projects/{project['id']}/issues?priority=critical",
        headers=maintainer_headers,
    )
    priority_titles = [item["title"] for item in priority_filter.json()["items"]]
    assert "Login bug" in priority_titles
    assert "UI glitch" not in priority_titles

    assignee_filter = client.get(
        f"/api/projects/{project['id']}/issues?assignee={member['id']}",
        headers=maintainer_headers,
    )
    assignee_titles = [item["title"] for item in assignee_filter.json()["items"]]
    assert "Login bug" in assignee_titles
    assert "API error" in assignee_titles
    assert "UI glitch" not in assignee_titles

    sorted_resp = client.get(
        f"/api/projects/{project['id']}/issues?sort=created_at",
        headers=maintainer_headers,
    )
    items = sorted_resp.json()["items"]
    timestamps = [datetime.fromisoformat(item["created_at"]) for item in items]
    assert timestamps == sorted(timestamps, reverse=True)
