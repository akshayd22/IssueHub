from fastapi.testclient import TestClient


def _signup_and_login(client: TestClient, name: str, email: str, password: str) -> dict:
    client.post("/api/auth/signup", json={"name": name, "email": email, "password": password})
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_issue_comments_flow(client: TestClient):
    headers = _signup_and_login(client, "Commenter", "commenter@example.com", "comment123")

    project = client.post(
        "/api/projects",
        json={"name": "Gamma", "key": "GAMMA", "description": "Gamma project"},
        headers=headers,
    ).json()

    issue = client.post(
        f"/api/projects/{project['id']}/issues",
        json={
            "title": "Comment test",
            "description": "Needs a comment",
            "priority": "medium",
            "assignee_id": None,
        },
        headers=headers,
    ).json()

    add_comment = client.post(
        f"/api/issues/{issue['id']}/comments",
        json={"body": "First comment"},
        headers=headers,
    )
    assert add_comment.status_code == 201

    list_comments = client.get(
        f"/api/issues/{issue['id']}/comments",
        headers=headers,
    )
    assert list_comments.status_code == 200
    bodies = [comment["body"] for comment in list_comments.json()]
    assert "First comment" in bodies
