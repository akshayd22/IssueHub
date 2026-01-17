def _auth_headers(client, email: str, password: str, name: str):
    signup = client.post(
        "/api/auth/signup",
        json={"name": name, "email": email, "password": password},
    )
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    token = response.json()["access_token"]
    user_id = signup.json()["id"]
    return {"Authorization": f"Bearer {token}"}, user_id


def test_issue_permissions(client):
    maintainer_headers, maintainer_id = _auth_headers(
        client, "maintainer@example.com", "maintainer123", "Maintainer"
    )
    member_headers, member_id = _auth_headers(
        client, "member@example.com", "member12345", "Member"
    )

    project_response = client.post(
        "/api/projects",
        json={"name": "Alpha", "key": "ALPHA", "description": "Alpha project"},
        headers=maintainer_headers,
    )
    assert project_response.status_code == 200
    project_id = project_response.json()["id"]

    add_member = client.post(
        f"/api/projects/{project_id}/members",
        json={"user_id": member_id, "role": "member"},
        headers=maintainer_headers,
    )
    assert add_member.status_code == 201

    issue_response = client.post(
        f"/api/projects/{project_id}/issues",
        json={
            "title": "Bug 1",
            "description": "Something is wrong",
            "priority": "high",
            "assignee_id": None,
        },
        headers=member_headers,
    )
    assert issue_response.status_code == 201
    issue_id = issue_response.json()["id"]

    get_issue = client.get(
        f"/api/issues/{issue_id}",
        headers=member_headers,
    )
    assert get_issue.status_code == 200

    forbidden = client.patch(
        f"/api/projects/{project_id}/issues/{issue_id}",
        json={"status": "closed"},
        headers=member_headers,
    )
    assert forbidden.status_code == 403

    allowed = client.patch(
        f"/api/projects/{project_id}/issues/{issue_id}",
        json={"title": "Bug 1 updated"},
        headers=member_headers,
    )
    assert allowed.status_code == 200

    maintainer_update = client.patch(
        f"/api/projects/{project_id}/issues/{issue_id}",
        json={"status": "in_progress"},
        headers=maintainer_headers,
    )
    assert maintainer_update.status_code == 200
