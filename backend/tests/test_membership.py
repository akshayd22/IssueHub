from fastapi.testclient import TestClient


def _signup(client: TestClient, name: str, email: str, password: str) -> dict:
    response = client.post(
        "/api/auth/signup", json={"name": name, "email": email, "password": password}
    )
    return response.json()


def _login(client: TestClient, email: str, password: str) -> dict:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_project_membership_lifecycle(client: TestClient):
    maintainer = _signup(client, "Maintainer", "maintain@example.com", "maintain123")
    member = _signup(client, "Member", "member2@example.com", "member12345")
    headers = _login(client, maintainer["email"], "maintain123")

    project = client.post(
        "/api/projects",
        json={"name": "Delta", "key": "DELTA", "description": "Delta project"},
        headers=headers,
    ).json()

    add_member = client.post(
        f"/api/projects/{project['id']}/members",
        json={"email": member["email"], "role": "member"},
        headers=headers,
    )
    assert add_member.status_code == 201

    members = client.get(
        f"/api/projects/{project['id']}/members",
        headers=headers,
    )
    assert members.status_code == 200
    emails = [entry["email"] for entry in members.json()]
    assert member["email"] in emails

    removed = client.delete(
        f"/api/projects/{project['id']}/members/{member['id']}",
        headers=headers,
    )
    assert removed.status_code == 204

    members_after = client.get(
        f"/api/projects/{project['id']}/members",
        headers=headers,
    )
    emails_after = [entry["email"] for entry in members_after.json()]
    assert member["email"] not in emails_after
