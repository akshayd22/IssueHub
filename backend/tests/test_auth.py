def test_signup_login_me(client):
    signup_payload = {
        "name": "Alice Admin",
        "email": "alice@example.com",
        "password": "supersecret123",
    }
    response = client.post("/api/auth/signup", json=signup_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == signup_payload["email"]

    response = client.post(
        "/api/auth/login",
        json={"email": signup_payload["email"], "password": signup_payload["password"]},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    assert token

    response = client.get("/api/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    profile = response.json()
    assert profile["email"] == signup_payload["email"]
