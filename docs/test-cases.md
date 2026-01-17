# Test Cases

This document summarizes the backend test coverage implemented under `backend/tests`.

## Authentication
- Signup + login + `/me` profile retrieval.
- Validates JWT issuance and protected route access.

## Issue Permissions
- Member can create and view issues in their project.
- Member cannot update restricted fields (status) unless maintainer.
- Maintainer can update status for any issue in their project.

## Comments
- Create an issue comment.
- Retrieve comment list for the issue.

## Project Membership
- Maintainer can add a member by email.
- Members list includes the added user.
- Maintainer can remove a member.

## Issue Filters & Sorting
- Filter by query (title search).
- Filter by status.
- Filter by priority.
- Filter by assignee.
- Sort by `created_at` (descending).
