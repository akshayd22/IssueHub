export type User = {
  id: number
  name: string
  email: string
  created_at: string
}

export type Project = {
  id: number
  name: string
  key: string
  description: string | null
  created_at: string
}

export type Membership = {
  project_id: number
  user_id: number
  role: 'member' | 'maintainer'
}

export type Member = {
  user_id: number
  name: string
  email: string
  role: 'member' | 'maintainer'
}

export type Issue = {
  id: number
  project_id: number
  title: string
  description: string | null
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  reporter_id: number
  assignee_id: number | null
  created_at: string
  updated_at: string
}

export type IssueListResponse = {
  items: Issue[]
  total: number
  limit: number
  offset: number
}

export type Comment = {
  id: number
  issue_id: number
  author_id: number
  body: string
  created_at: string
}
