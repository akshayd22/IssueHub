import type {
  Comment,
  Issue,
  IssueListResponse,
  Member,
  Membership,
  Project,
  User,
} from './types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

function getToken() {
  return localStorage.getItem('issuehub_token')
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem('issuehub_token', token)
  } else {
    localStorage.removeItem('issuehub_token')
  }
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {})
  headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!response.ok) {
    let message = 'Request failed'
    let details: unknown
    try {
      const data = await response.json()
      if (data?.error?.message) {
        message = data.error.message
        details = data.error.details
      }
    } catch {
      message = response.statusText
    }
    throw new ApiError(message, response.status, details)
  }

  if (response.status === 204) {
    return {} as T
  }
  return response.json()
}

export async function signup(payload: {
  name: string
  email: string
  password: string
}): Promise<User> {
  return apiFetch<User>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function login(payload: {
  email: string
  password: string
}): Promise<{ access_token: string }> {
  return apiFetch<{ access_token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' })
}

export async function fetchMe(): Promise<User> {
  return apiFetch<User>('/me')
}

export async function listProjects(): Promise<Project[]> {
  return apiFetch<Project[]>('/projects')
}

export async function createProject(payload: {
  name: string
  key: string
  description?: string
}): Promise<Project> {
  return apiFetch<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function addProjectMember(projectId: number, payload: {
  user_id?: number
  email?: string
  role: 'member' | 'maintainer'
}): Promise<void> {
  await apiFetch(`/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function removeProjectMember(projectId: number, userId: number): Promise<void> {
  await apiFetch(`/projects/${projectId}/members/${userId}`, {
    method: 'DELETE',
  })
}

export async function getMembership(projectId: number): Promise<Membership> {
  return apiFetch<Membership>(`/projects/${projectId}/membership`)
}

export async function listMembers(projectId: number): Promise<Member[]> {
  return apiFetch<Member[]>(`/projects/${projectId}/members`)
}

export async function searchUsers(query: string): Promise<User[]> {
  const search = new URLSearchParams({ q: query })
  return apiFetch<User[]>(`/users/search?${search.toString()}`)
}

export async function listIssues(projectId: number, params: {
  q?: string
  status?: string
  priority?: string
  assignee?: string
  sort?: string
  limit?: number
  offset?: number
}): Promise<IssueListResponse> {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      search.append(key, String(value))
    }
  })
  return apiFetch<IssueListResponse>(`/projects/${projectId}/issues?${search.toString()}`)
}

export async function createIssue(projectId: number, payload: {
  title: string
  description?: string
  priority: string
  assignee_id?: number | null
}): Promise<Issue> {
  return apiFetch<Issue>(`/projects/${projectId}/issues`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getIssue(projectId: number, issueId: number): Promise<Issue> {
  return apiFetch<Issue>(`/projects/${projectId}/issues/${issueId}`)
}

export async function updateIssue(projectId: number, issueId: number, payload: {
  title?: string
  description?: string
  status?: string
  priority?: string
  assignee_id?: number | null
}): Promise<Issue> {
  return apiFetch<Issue>(`/projects/${projectId}/issues/${issueId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteIssue(projectId: number, issueId: number): Promise<void> {
  await apiFetch(`/projects/${projectId}/issues/${issueId}`, {
    method: 'DELETE',
  })
}

export async function listComments(issueId: number): Promise<Comment[]> {
  return apiFetch<Comment[]>(`/issues/${issueId}/comments`)
}

export async function addComment(issueId: number, payload: { body: string }): Promise<Comment> {
  return apiFetch<Comment>(`/issues/${issueId}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
