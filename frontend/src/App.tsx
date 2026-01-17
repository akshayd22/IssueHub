import { useEffect, useMemo, useState, type FormEvent } from 'react'
import './style.css'
import {
  addComment,
  addProjectMember,
  createIssue,
  createProject,
  deleteIssue,
  fetchMe,
  getIssue,
  getMembership,
  listComments,
  listIssues,
  listMembers,
  listProjects,
  login,
  logout,
  removeProjectMember,
  searchUsers,
  setToken,
  signup,
  updateIssue,
} from './api'
import type { Comment, Issue, Member, Membership, Project, User } from './types'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Toaster } from "@/components/ui/toaster"
import { toast } from "@/components/ui/use-toast"

type AuthMode = 'login' | 'signup'
type ViewMode = 'dashboard' | 'projects' | 'issues'
type NavMenu = 'projects' | 'issues' | null
type IssueWithProject = Issue & { project_name?: string }
type SelectOption = { value: string; label: string }

const emailRegex = /^\S+@\S+\.\S+$/

function isValidEmail(email: string) {
  return emailRegex.test(email)
}

type SearchableSelectProps = {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  name?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  onChange?: (value: string) => void
  onSearch?: (query: string) => void
  searchPlaceholder?: string
  emptyActionLabel?: string
  onEmptyAction?: () => void
  minSearchCharsForAction?: number
}

function SearchableSelect({
  options,
  value,
  defaultValue = '',
  name,
  placeholder = 'Select an option',
  required,
  disabled,
  onChange,
  onSearch,
  searchPlaceholder = 'Search...',
  emptyActionLabel,
  onEmptyAction,
  minSearchCharsForAction = 0,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [internalValue, setInternalValue] = useState(defaultValue)
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue

  useEffect(() => {
    if (!isControlled) {
      setInternalValue(defaultValue)
    }
  }, [defaultValue, isControlled])

  const selectedLabel =
    options.find((option) => option.value === currentValue)?.label ?? placeholder

  const filteredOptions = query
    ? options.filter((option) =>
        option.label.toLowerCase().includes(query.trim().toLowerCase())
      )
    : options
  const canShowEmptyAction =
    Boolean(emptyActionLabel && onEmptyAction) && query.trim().length >= minSearchCharsForAction

  return (
    <div className="select-dropdown">
      <button
        type="button"
        className="select-trigger"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
      >
        <span>{selectedLabel}</span>
        <span className="select-caret">▾</span>
      </button>
      {open ? (
        <div className="select-menu">
          <input
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => {
              const nextValue = event.target.value
              setQuery(nextValue)
              onSearch?.(nextValue)
            }}
            autoFocus
            disabled={disabled}
          />
          <div className="select-options">
            {filteredOptions.map((option) => (
              <button
                key={option.value || option.label}
                type="button"
                className="select-option"
                onClick={() => {
                  if (!isControlled) {
                    setInternalValue(option.value)
                  }
                  onChange?.(option.value)
                  setOpen(false)
                  setQuery('')
                }}
                disabled={disabled}
              >
                {option.label}
              </button>
            ))}
            {filteredOptions.length === 0 ? (
              <div className="select-empty">
                <p className="muted">No options found.</p>
                {canShowEmptyAction ? (
                  <button
                    type="button"
                    className="select-empty-action"
                    onClick={() => {
                      onEmptyAction?.()
                      setOpen(false)
                      setQuery('')
                    }}
                  >
                    {emptyActionLabel}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {name ? (
        <input type="hidden" name={name} value={currentValue} required={required} />
      ) : null}
    </div>
  )
}

type IssueFilters = {
  q: string
  status: string
  priority: string
  assignee: string
  sort: string
}

const defaultFilters: IssueFilters = {
  q: '',
  status: '',
  priority: '',
  assignee: '',
  sort: 'created_at',
}

export default function App() {
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [token, setAuthToken] = useState<string | null>(
    localStorage.getItem('issuehub_token')
  )
  const [user, setUser] = useState<User | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [activeView, setActiveView] = useState<ViewMode>('dashboard')
  const [openMenu, setOpenMenu] = useState<NavMenu>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [issues, setIssues] = useState<Issue[]>([])
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [recentIssues, setRecentIssues] = useState<Issue[]>([])
  const [allIssues, setAllIssues] = useState<IssueWithProject[]>([])
  const [allIssueTotal, setAllIssueTotal] = useState(0)
  const [allIssuesLoading, setAllIssuesLoading] = useState(false)
  const [allIssuesView, setAllIssuesView] = useState(false)
  const [projectQuery, setProjectQuery] = useState('')
  const [projectPage, setProjectPage] = useState(0)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [projectNavQuery, setProjectNavQuery] = useState('')
  const [issueNavQuery, setIssueNavQuery] = useState('')
  const [memberQuery, setMemberQuery] = useState('')
  const [memberPage, setMemberPage] = useState(0)
  const [memberLookupOptions, setMemberLookupOptions] = useState<SelectOption[]>([])
  const [memberLookupLoading, setMemberLookupLoading] = useState(false)
  const [commentQuery, setCommentQuery] = useState('')
  const [commentPage, setCommentPage] = useState(0)
  const [filters, setFilters] = useState<IssueFilters>(defaultFilters)
  const [page, setPage] = useState(0)
  const [issueTotal, setIssueTotal] = useState(0)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [createIssueLoading, setCreateIssueLoading] = useState(false)
  const [addMemberLoading, setAddMemberLoading] = useState(false)
  const [updateIssueLoading, setUpdateIssueLoading] = useState(false)
  const [deleteIssueLoading, setDeleteIssueLoading] = useState(false)
  const [addCommentLoading, setAddCommentLoading] = useState(false)
  const [createUserLoading, setCreateUserLoading] = useState(false)
  const [removeMemberLoading, setRemoveMemberLoading] = useState<number | null>(null)

  const isMaintainer = membership?.role === 'maintainer'
  const pageSize = 10
  const projectPageSize = 7
  const memberPageSize = 6
  const commentPageSize = 5

  const recentProjects = useMemo(
    () => projects.slice(0, 5),
    [projects]
  )

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }

    fetchMe()
      .then((data) => setUser(data))
      .catch(() => {
        setToken(null)
        setAuthToken(null)
      })
  }, [token])

  useEffect(() => {
    if (!user) return
    loadProjects()
  }, [user])

  useEffect(() => {
    if (!activeProject) return
    loadProjectData(activeProject)
  }, [activeProject])

  useEffect(() => {
    if (!activeProject) return
    loadIssues(activeProject)
  }, [filters, page, activeProject?.id])

  useEffect(() => {
    if (openMenu !== 'issues') return
    if (allIssues.length === 0 && !allIssuesLoading) {
      loadAllIssues()
    }
  }, [openMenu, allIssues.length, allIssuesLoading])

  useEffect(() => {
    if (!allIssuesView) return
    loadAllIssues()
  }, [allIssuesView, filters, projects.length])

  useEffect(() => {
    if (!selectedIssue) return
    const stillVisible = issues.some((issue) => issue.id === selectedIssue.id)
    if (!stillVisible) {
      setSelectedIssue(null)
    }
  }, [issues, selectedIssue])

  useEffect(() => {
    if (!statusMessage) return
    toast({ description: statusMessage, variant: "success" })
    setStatusMessage(null)
  }, [statusMessage])

  useEffect(() => {
    if (!errorMessage) return
    toast({ description: errorMessage, variant: "destructive" })
    setErrorMessage(null)
  }, [errorMessage])

  const filteredProjects = useMemo(() => {
    const query = projectQuery.trim().toLowerCase()
    if (!query) return projects
    return projects.filter((project) =>
      `${project.name} ${project.key}`.toLowerCase().includes(query)
    )
  }, [projects, projectQuery])

  const navProjectResults = useMemo(() => {
    const query = projectNavQuery.trim().toLowerCase()
    if (!query) return recentProjects
    return projects.filter((project) =>
      `${project.name} ${project.key}`.toLowerCase().includes(query)
    )
  }, [projects, projectNavQuery, recentProjects])

  const navIssueResults = useMemo(() => {
    const query = issueNavQuery.trim().toLowerCase()
    if (!query) return recentIssues
    const pool = allIssues.length > 0 ? allIssues : recentIssues
    return pool.filter((issue) =>
      `${issue.title} ${issue.status} ${issue.priority}`.toLowerCase().includes(query)
    )
  }, [allIssues, issueNavQuery, recentIssues])

  const navProjectList = useMemo(() => navProjectResults.slice(0, 8), [navProjectResults])
  const navIssueList = useMemo(() => navIssueResults.slice(0, 8), [navIssueResults])

  const statusFilterOptions: SelectOption[] = [
    { value: '', label: 'All status' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
  ]

  const statusSelectOptions: SelectOption[] = [
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
  ]

  const priorityFilterOptions: SelectOption[] = [
    { value: '', label: 'All priority' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ]

  const prioritySelectOptions: SelectOption[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' },
  ]

  const sortOptions: SelectOption[] = [
    { value: 'created_at', label: 'Newest' },
    { value: 'priority', label: 'Priority' },
    { value: 'status', label: 'Status' },
  ]

  const roleOptions: SelectOption[] = [
    { value: 'member', label: 'Member' },
    { value: 'maintainer', label: 'Maintainer' },
  ]

  const assigneeFilterOptions: SelectOption[] = [
    { value: '', label: 'All assignees' },
    ...members.map((member) => ({
      value: String(member.user_id),
      label: member.name,
    })),
  ]

  const assigneeSelectOptions: SelectOption[] = [
    { value: '', label: 'Unassigned' },
    ...members.map((member) => ({
      value: String(member.user_id),
      label: `${member.name} (${member.role})`,
    })),
  ]

  const projectSelectOptions: SelectOption[] = projects.map((project) => ({
    value: String(project.id),
    label: `${project.name} (${project.key})`,
  }))

  const filteredMembers = useMemo(() => {
    const query = memberQuery.trim().toLowerCase()
    if (!query) return members
    return members.filter((member) =>
      `${member.name} ${member.email ?? ''} ${member.role}`.toLowerCase().includes(query)
    )
  }, [members, memberQuery])

  const filteredComments = useMemo(() => {
    const query = commentQuery.trim().toLowerCase()
    if (!query) return comments
    return comments.filter((comment) => comment.body.toLowerCase().includes(query))
  }, [comments, commentQuery])

  const projectTotal = filteredProjects.length
  const projectStart = projectTotal === 0 ? 0 : projectPage * projectPageSize + 1
  const projectEnd = Math.min((projectPage + 1) * projectPageSize, projectTotal)
  const pagedProjects = filteredProjects.slice(
    projectPage * projectPageSize,
    projectPage * projectPageSize + projectPageSize
  )

  const memberTotal = filteredMembers.length
  const memberStart = memberTotal === 0 ? 0 : memberPage * memberPageSize + 1
  const memberEnd = Math.min((memberPage + 1) * memberPageSize, memberTotal)
  const pagedMembers = filteredMembers.slice(
    memberPage * memberPageSize,
    memberPage * memberPageSize + memberPageSize
  )

  const commentTotal = filteredComments.length
  const commentStart = commentTotal === 0 ? 0 : commentPage * commentPageSize + 1
  const commentEnd = Math.min((commentPage + 1) * commentPageSize, commentTotal)
  const pagedComments = filteredComments.slice(
    commentPage * commentPageSize,
    commentPage * commentPageSize + commentPageSize
  )

  useEffect(() => {
    setProjectPage(0)
  }, [projectQuery])

  useEffect(() => {
    setMemberPage(0)
  }, [memberQuery, activeProject?.id])

  useEffect(() => {
    setCommentPage(0)
  }, [commentQuery, selectedIssue?.id])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '')
    if (authMode === 'signup') {
      if (!name || !email || !password) {
        setErrorMessage('Name, email, and password are required.')
        return
      }
    }
    if (!email || !password) {
      setErrorMessage('Email and password are required.')
      return
    }
    if (!isValidEmail(email)) {
      setErrorMessage('Enter a valid email address.')
      return
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      if (authMode === 'signup') {
        await signup({
          name,
          email,
          password,
        })
      }
      const result = await login({
        email,
        password,
      })
      setToken(result.access_token)
      setAuthToken(result.access_token)
      setStatusMessage('Welcome back!')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    try {
      await logout()
    } catch {
      // Ignore logout error
    } finally {
      setToken(null)
      setAuthToken(null)
      setUser(null)
      setProjects([])
      setActiveProject(null)
    }
  }

  async function loadProjects() {
    const data = await listProjects()
    setProjects(data)
  }

  async function loadProjectData(project: Project) {
    setLoading(true)
    setErrorMessage(null)
    try {
      setPage(0)
      setIssueTotal(0)
      setMemberQuery('')
      setMemberPage(0)
      const [membershipData, membersData] = await Promise.all([
        getMembership(project.id),
        listMembers(project.id),
      ])
      setMembership(membershipData)
      setMembers(membersData)
      await loadIssues(project)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  async function loadIssues(project: Project) {
    const data = await listIssues(project.id, {
      ...filters,
      limit: pageSize,
      offset: page * pageSize,
    })
    setIssues(data.items)
    setIssueTotal(data.total)
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const name = String(form.get('name') || '').trim()
    const key = String(form.get('key') || '').trim().toUpperCase()
    if (!name || !key) {
      setErrorMessage('Project name and key are required.')
      return
    }
    setLoading(true)
    try {
      await createProject({
        name,
        key,
        description: String(form.get('description') || ''),
      })
      formElement?.reset()
      await loadProjects()
      setStatusMessage('Project created.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const projectIdValue = String(form.get('project_id') || '').trim()
    const projectId = projectIdValue ? Number(projectIdValue) : activeProject?.id
    const title = String(form.get('title') || '').trim()
    if (!projectId) {
      setErrorMessage('Select a project before creating an issue.')
      return
    }
    if (!title) {
      setErrorMessage('Issue title is required.')
      return
    }
    try {
      setCreateIssueLoading(true)
      const created = await createIssue(projectId, {
        title,
        description: String(form.get('description') || '').trim(),
        priority: String(form.get('priority') || 'medium'),
        assignee_id: form.get('assignee_id')
          ? Number(form.get('assignee_id'))
          : null,
      })
      setRecentIssues((prev) => {
        const next = [created, ...prev.filter((item) => item.id !== created.id)]
        return next.slice(0, 5)
      })
      formElement?.reset()
      if (!activeProject || activeProject.id !== projectId) {
        const project = projects.find((item) => item.id === projectId) || null
        if (project) {
          setActiveProject(project)
        }
      }
      await loadIssues({ id: projectId } as Project)
      setStatusMessage('Issue created.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create issue')
    } finally {
      setCreateIssueLoading(false)
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeProject) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const email = String(form.get('email') || '').trim()
    const userIdValue = String(form.get('user_id') || '').trim()
    if (!email && !userIdValue) {
      setErrorMessage('Provide a user ID or email.')
      return
    }
    if (email && !isValidEmail(email)) {
      setErrorMessage('Enter a valid email address.')
      return
    }
    if (userIdValue && Number.isNaN(Number(userIdValue))) {
      setErrorMessage('User ID must be a number.')
      return
    }
    try {
      setAddMemberLoading(true)
      await addProjectMember(activeProject.id, {
        user_id: userIdValue ? Number(userIdValue) : undefined,
        email: email || undefined,
        role: String(form.get('role') || 'member') as 'member' | 'maintainer',
      })
      formElement?.reset()
      setMemberQuery('')
      setMemberPage(0)
      await loadProjectData(activeProject)
      setStatusMessage('Member added.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to add member')
    } finally {
      setAddMemberLoading(false)
    }
  }

  async function handleUserLookup(query: string) {
    if (query.trim().length < 2) {
      setMemberLookupOptions([])
      return
    }
    try {
      setMemberLookupLoading(true)
      const users = await searchUsers(query.trim())
      setMemberLookupOptions(
        users.map((item) => ({
          value: String(item.id),
          label: `${item.name} (${item.email})`,
        }))
      )
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to search users')
    } finally {
      setMemberLookupLoading(false)
    }
  }

  async function handleRemoveMember(targetUserId: number) {
    if (!activeProject) return
    if (!user) return
    if (targetUserId === user.id) {
      setErrorMessage('You cannot remove yourself.')
      return
    }
    const confirmed = window.confirm('Remove this member from the project?')
    if (!confirmed) return
    try {
      setRemoveMemberLoading(targetUserId)
      await removeProjectMember(activeProject.id, targetUserId)
      setMemberQuery('')
      setMemberPage(0)
      await loadProjectData(activeProject)
      setStatusMessage('Member removed.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to remove member')
    } finally {
      setRemoveMemberLoading(null)
    }
  }

  async function handleSelectIssue(issue: Issue) {
    const projectId = issue.project_id
    let project = projects.find((item) => item.id === projectId) || null
    if (!project) {
      const data = await listProjects()
      setProjects(data)
      project = data.find((item) => item.id === projectId) || null
    }
    if (project && activeProject?.id !== project.id) {
      setActiveProject(project)
    }
    const [issueDetail, issueComments] = await Promise.all([
      getIssue(projectId, issue.id),
      listComments(issue.id),
    ])
    setSelectedIssue(issueDetail)
    setComments(issueComments)
    setRecentIssues((prev) => {
      const next = [issueDetail, ...prev.filter((item) => item.id !== issueDetail.id)]
      return next.slice(0, 5)
    })
  }

  async function handleUpdateIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeProject || !selectedIssue) return
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') || selectedIssue.title).trim()
    if (!title) {
      setErrorMessage('Issue title is required.')
      return
    }
    const payload = {
      title,
      description: String(form.get('description') || '').trim(),
      priority: String(form.get('priority') || selectedIssue.priority),
      status: isMaintainer ? String(form.get('status') || selectedIssue.status) : undefined,
      assignee_id: isMaintainer
        ? form.get('assignee_id')
          ? Number(form.get('assignee_id'))
          : null
        : undefined,
    }
    try {
      setUpdateIssueLoading(true)
      const updated = await updateIssue(activeProject.id, selectedIssue.id, payload)
      setSelectedIssue(updated)
      await loadIssues(activeProject)
      setStatusMessage('Issue updated.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update issue')
    } finally {
      setUpdateIssueLoading(false)
    }
  }

  async function handleDeleteIssue() {
    if (!activeProject || !selectedIssue) return
    try {
      setDeleteIssueLoading(true)
      await deleteIssue(activeProject.id, selectedIssue.id)
      setSelectedIssue(null)
      await loadIssues(activeProject)
      setStatusMessage('Issue deleted.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete issue')
    } finally {
      setDeleteIssueLoading(false)
    }
  }

  async function handleAddComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedIssue) return
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const body = String(form.get('body') || '').trim()
    if (!body) {
      setErrorMessage('Comment cannot be empty.')
      return
    }
    try {
      setAddCommentLoading(true)
      const comment = await addComment(selectedIssue.id, {
        body,
      })
      setComments((prev) => [...prev, comment])
      formElement?.reset()
      setStatusMessage('Comment added.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to add comment')
    } finally {
      setAddCommentLoading(false)
    }
  }

  function resolveMemberName(userId: number | null) {
    if (!userId) {
      return 'Unassigned'
    }
    const member = members.find((item) => item.user_id === userId)
    return member ? member.name : `User #${userId}`
  }

  function resolveProjectName(projectId: number) {
    const project = projects.find((item) => item.id === projectId)
    return project ? project.name : `Project #${projectId}`
  }

  function getInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return 'U'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }

  async function loadAllIssues() {
    setAllIssuesLoading(true)
    setErrorMessage(null)
    try {
      let projectList = projects
      if (projectList.length === 0) {
        projectList = await listProjects()
        setProjects(projectList)
      }
      if (projectList.length === 0) {
        setAllIssues([])
        setAllIssueTotal(0)
        return
      }
      const limit = 50
      const results = await Promise.all(
        projectList.map(async (project) => {
          let items: Issue[] = []
          let offset = 0
          let total = 0
          while (true) {
            const data = await listIssues(project.id, {
              ...filters,
              limit,
              offset,
            })
            total = data.total
            items = items.concat(data.items)
            if (items.length >= total || data.items.length === 0) break
            offset += limit
          }
          return { project, items, total }
        })
      )

      const merged = results.flatMap(({ project, items }) =>
        items.map((item) => ({ ...item, project_name: project.name }))
      )
      const total = results.reduce((sum, entry) => sum + entry.total, 0)
      setAllIssues(merged)
      setAllIssueTotal(total)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load issues')
    } finally {
      setAllIssuesLoading(false)
    }
  }

  async function openIssueModal() {
    try {
      if (projects.length === 0) {
        const data = await listProjects()
        setProjects(data)
      }
      setShowIssueModal(true)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load projects')
    }
  }

  async function openCreateUserModal() {
    try {
      if (projects.length === 0) {
        const data = await listProjects()
        setProjects(data)
      }
      setShowCreateUserModal(true)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load projects')
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') || '').trim()
    const email = String(form.get('email') || '').trim()
    const password = String(form.get('password') || '')
    const projectId = Number(String(form.get('project_id') || '').trim())

    if (!name || !email || !password) {
      setErrorMessage('Name, email, and password are required.')
      return
    }
    if (!isValidEmail(email)) {
      setErrorMessage('Enter a valid email address.')
      return
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters.')
      return
    }

    try {
      setCreateUserLoading(true)
      const created = await signup({ name, email, password })
      if (projectId) {
        await addProjectMember(projectId, { user_id: created.id, role: 'member' })
      }
      setStatusMessage('User created.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to create user')
    } finally {
      setCreateUserLoading(false)
    }
  }

  const issueSource = allIssuesView ? allIssues : issues
  const issueTotalCount = allIssuesView ? allIssueTotal : issueTotal
  const pagedIssues = allIssuesView
    ? issueSource.slice(page * pageSize, page * pageSize + pageSize)
    : issueSource

  const issuesSection = allIssuesView || activeProject ? (
    <Card className="section p-6">
      <div className="row">
        <h3>{allIssuesView ? 'All issues' : 'Issues'}</h3>
        <button
          type="button"
          onClick={() => {
            setSelectedIssue(null)
            openIssueModal()
          }}
        >
          New Issue
        </button>
      </div>
      <div className="toolbar issues-toolbar">
        <SearchableSelect
          options={statusFilterOptions}
          value={filters.status}
          onChange={(value) => {
            setFilters({ ...filters, status: value })
            setPage(0)
          }}
        />
        <SearchableSelect
          options={priorityFilterOptions}
          value={filters.priority}
          onChange={(value) => {
            setFilters({ ...filters, priority: value })
            setPage(0)
          }}
        />
        <SearchableSelect
          options={assigneeFilterOptions}
          value={filters.assignee}
          onChange={(value) => {
            setFilters({ ...filters, assignee: value })
            setPage(0)
          }}
        />
        <SearchableSelect
          options={sortOptions}
          value={filters.sort}
          onChange={(value) => {
            setFilters({ ...filters, sort: value })
            setPage(0)
          }}
        />
      </div>

      <div className="section grid items-start gap-6 lg:grid-cols-2">
        <div className="self-start space-y-3">
          <Input
            placeholder="Search by id or title"
            value={filters.q}
            onChange={(event) => {
              setFilters({ ...filters, q: event.target.value })
              setPage(0)
            }}
          />
          <p className="muted">
            Showing {pagedIssues.length === 0 ? 0 : page * pageSize + 1}-
            {page * pageSize + pagedIssues.length} of {issueTotalCount}
          </p>
          <div className="list max-h-[calc(100dvh-var(--nav-height)-16rem)] overflow-auto pr-2">
            {pagedIssues.map((issue) => (
              <Button
                key={issue.id}
                variant="ghost"
                className="w-full justify-between"
                onClick={() => handleSelectIssue(issue)}
              >
                <div className="text-left">
                  <strong>{issue.title}</strong>
                  <div className="text-sm text-muted-foreground">
                    {issue.status} · {issue.priority}
                    {allIssuesView ? ` · ${resolveProjectName(issue.project_id)}` : ''}
                  </div>
                </div>
                <Badge variant="secondary">#{issue.id}</Badge>
              </Button>
            ))}
            {issueSource.length === 0 ? <p className="muted">No issues found.</p> : null}
          </div>
          <div className="row">
            <Button
              variant="outline"
              onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={page * pageSize + pagedIssues.length >= issueTotalCount}
            >
              Next
            </Button>
          </div>
        </div>

        <Card className="p-6 issue-details">
          <div className="row">
            <h4>Issue details</h4>
            {selectedIssue ? <Badge variant="secondary">#{selectedIssue.id}</Badge> : null}
          </div>
          {selectedIssue ? (
            <>
              <div className="issue-meta">
                <div className="issue-meta-item">
                  <span className="muted">Status</span>
                  <strong>{selectedIssue.status}</strong>
                </div>
                <div className="issue-meta-item">
                  <span className="muted">Priority</span>
                  <strong>{selectedIssue.priority}</strong>
                </div>
                <div className="issue-meta-item">
                  <span className="muted">Reporter</span>
                  <strong>{resolveMemberName(selectedIssue.reporter_id)}</strong>
                </div>
                <div className="issue-meta-item">
                  <span className="muted">Assignee</span>
                  <strong>{resolveMemberName(selectedIssue.assignee_id)}</strong>
                </div>
                <div className="issue-meta-item">
                  <span className="muted">Created</span>
                  <strong>{new Date(selectedIssue.created_at).toLocaleString()}</strong>
                </div>
                <div className="issue-meta-item">
                  <span className="muted">Updated</span>
                  <strong>{new Date(selectedIssue.updated_at).toLocaleString()}</strong>
                </div>
              </div>
              <form className="grid gap-4" onSubmit={handleUpdateIssue}>
                <div className="grid gap-2">
                  <Label htmlFor="issue-title-edit">Title</Label>
                  <Input
                    id="issue-title-edit"
                    name="title"
                    required
                    defaultValue={selectedIssue.title}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="issue-desc-edit">Description</Label>
                  <Textarea
                    id="issue-desc-edit"
                    name="description"
                    rows={4}
                    defaultValue={selectedIssue.description ?? ''}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <SearchableSelect
                    name="priority"
                    defaultValue={selectedIssue.priority}
                    options={prioritySelectOptions}
                  />
                </div>
                {isMaintainer ? (
                  <>
                    <div className="grid gap-2">
                      <Label>Status</Label>
                      <SearchableSelect
                        name="status"
                        defaultValue={selectedIssue.status}
                        options={statusSelectOptions}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Assignee</Label>
                      <SearchableSelect
                        name="assignee_id"
                        defaultValue={String(selectedIssue.assignee_id ?? '')}
                        options={assigneeSelectOptions}
                      />
                    </div>
                  </>
                ) : null}
                <Button type="submit" disabled={updateIssueLoading}>
                  {updateIssueLoading ? (
                    <>
                      <span className="spinner" /> Updating...
                    </>
                  ) : (
                    "Update issue"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={handleDeleteIssue} disabled={deleteIssueLoading}>
                  {deleteIssueLoading ? (
                    <>
                      <span className="spinner" /> Deleting...
                    </>
                  ) : (
                    "Delete issue"
                  )}
                </Button>
              </form>
            </>
          ) : (
            <p className="muted">Select an issue to view details.</p>
          )}
        </Card>
      </div>

      {selectedIssue ? (
        <div className="section comments">
          <div className="row">
            <h4>Comments</h4>
            <Input
              placeholder="Search comments"
              value={commentQuery}
              onChange={(event) => setCommentQuery(event.target.value)}
            />
          </div>
          <p className="muted">
            Showing {commentStart}-{commentEnd} of {commentTotal}
          </p>
          <div className="list comment-list">
            {pagedComments.map((comment) => (
              <Card key={comment.id} className="comment-card">
                <div className="comment-header">
                  <Badge variant="outline">#{comment.id}</Badge>
                  <span className="muted">{resolveMemberName(comment.author_id)}</span>
                  <span className="muted">
                    {new Date(comment.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="comment-body">{comment.body}</p>
              </Card>
            ))}
            {pagedComments.length === 0 ? <p className="muted">No comments found.</p> : null}
          </div>
          <div className="row">
            <Button
              variant="outline"
              onClick={() => setCommentPage((prev) => Math.max(prev - 1, 0))}
              disabled={commentPage === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setCommentPage((prev) => prev + 1)}
              disabled={(commentPage + 1) * commentPageSize >= commentTotal}
            >
              Next
            </Button>
          </div>
          <form className="grid gap-4 section" onSubmit={handleAddComment}>
            <div className="grid gap-2">
              <Label htmlFor="comment-body">Add comment</Label>
              <Textarea id="comment-body" name="body" rows={3} required />
            </div>
            <Button type="submit" disabled={addCommentLoading}>
              {addCommentLoading ? (
                <>
                  <span className="spinner" /> Posting...
                </>
              ) : (
                "Add comment"
              )}
            </Button>
          </form>
        </div>
      ) : null}
    </Card>
  ) : (
    <Card className="section p-6">
      <p className="muted">Select a project to see its issues.</p>
    </Card>
  )

  if (!user) {
    return (
      <div className="app">
        <div className="nav">
          <h2>IssueHub</h2>
        </div>
        <Card className="p-6">
          <h3>{authMode === 'login' ? 'Login' : 'Sign up'}</h3>
          <form className="grid gap-4" onSubmit={handleLogin}>
            {authMode === 'signup' ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="auth-name">Name</Label>
                  <Input id="auth-name" name="name" required />
                </div>
              </>
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input id="auth-email" name="email" type="email" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="auth-password">Password</Label>
              <Input id="auth-password" name="password" type="password" required minLength={8} />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" /> Processing...
                </>
              ) : authMode === 'login' ? (
                "Login"
              ) : (
                "Create account"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
            >
              {authMode === 'login' ? 'Need an account? Sign up' : 'Have an account? Login'}
            </Button>
          </form>
          
        </Card>
      </div>
    )
  }

  return (
    <>
      <Toaster />
      <div className="app">
        <div className="nav-bar">
          <Sheet
            open={isMobileMenuOpen}
            onOpenChange={(open) => {
              setIsMobileMenuOpen(open)
              setOpenMenu(null)
            }}
          >
            <div className="nav-container">
            <div className="nav-left">
              <div className="logo">
                <img src="/issuehub-logo.svg" alt="IssueHub logo" />
                <span>IssueHub</span>
              </div>
            </div>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="nav-toggle"
                aria-label="Open menu"
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-nav"
                onClick={() => {
                  setIsMobileMenuOpen(true)
                  setOpenMenu(null)
                }}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <div className="nav-center nav-desktop">
              <div className="nav-item">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setOpenMenu((prev) => (prev === 'projects' ? null : 'projects'))
                  }
                >
                  Projects
                </Button>
                {openMenu === 'projects' ? (
                  <div className="nav-menu">
                    <Input
                      placeholder="Search projects"
                      value={projectNavQuery}
                      onChange={(event) => setProjectNavQuery(event.target.value)}
                    />
                    <div className="nav-list">
                      {navProjectList.map((project) => (
                        <Button
                          key={project.id}
                          variant="ghost"
                          className="justify-start"
                          onClick={() => {
                            setActiveProject(project)
                            setActiveView('issues')
                            setSelectedIssue(null)
                        setAllIssuesView(false)
                            setOpenMenu(null)
                          }}
                        >
                          {project.name} ({project.key})
                        </Button>
                      ))}
                      {navProjectList.length === 0 ? (
                        <p className="muted">No projects found.</p>
                      ) : null}
                    </div>
                    <div className="nav-menu-actions">
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setShowProjectModal(true)
                          setOpenMenu(null)
                        }}
                      >
                        Create project
                      </Button>
                      <Button
                        onClick={() => {
                          setActiveView('projects')
                      setAllIssuesView(false)
                          setOpenMenu(null)
                        }}
                      >
                        Show all projects
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="nav-item">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenMenu((prev) => (prev === 'issues' ? null : 'issues'))}
                >
                  Issues
                </Button>
                {openMenu === 'issues' ? (
                  <div className="nav-menu">
                    <Input
                      placeholder="Search issues"
                      value={issueNavQuery}
                      onChange={(event) => setIssueNavQuery(event.target.value)}
                  disabled={allIssuesLoading}
                    />
                <div className="nav-list">
                  {navIssueList.map((issue) => (
                    <Button
                      key={issue.id}
                      variant="ghost"
                      className="justify-start"
                      onClick={() => {
                        handleSelectIssue(issue)
                        setActiveView('issues')
                        setAllIssuesView(false)
                        setOpenMenu(null)
                      }}
                    >
                      {issue.title}
                    </Button>
                  ))}
                  {navIssueList.length === 0 ? (
                    <p className="muted">
                      {issueNavQuery ? 'No issues found.' : 'No recent issues yet.'}
                    </p>
                  ) : null}
                </div>
                    <div className="nav-menu-actions">
                      <Button
                        variant="ghost"
                        onClick={() => {
                      openIssueModal()
                          setOpenMenu(null)
                        }}
                      >
                        Create issue
                      </Button>
                      <Button
                        onClick={() => {
                          setActiveView('issues')
                      setAllIssuesView(true)
                      setPage(0)
                      loadAllIssues()
                          setOpenMenu(null)
                        }}
                      >
                        Show all issues
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="nav-actions nav-desktop">
              <Button onClick={openIssueModal}>Create Issue</Button>
              {isMaintainer ? (
                <Button variant="outline" onClick={openCreateUserModal}>
                  Create User
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full">
                    {getInitials(user.name)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="px-2 py-1.5 text-sm">
                    <div className="font-semibold">{user.name}</div>
                    <div className="text-muted-foreground">{user.email}</div>
                  </div>
                  <DropdownMenuItem
                    onClick={() => setStatusMessage('Profile page coming soon.')}
                  >
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            </div>
            <SheetContent side="top" className="nav-mobile" id="mobile-nav">
              <div className="nav-mobile-header">
                <div className="nav-mobile-profile">
                  <div className="avatar-button">{getInitials(user.name)}</div>
                  <div className="profile-meta">
                    <strong>{user.name}</strong>
                    <span className="muted">{user.email}</span>
                  </div>
                </div>
              </div>

              <div className="nav-mobile-section">
                <p className="nav-mobile-title">Navigation</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveView('projects')
                    setAllIssuesView(false)
                    setIsMobileMenuOpen(false)
                  }}
                >
                  Projects
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveView('issues')
                    setAllIssuesView(true)
                    setPage(0)
                    loadAllIssues()
                    setIsMobileMenuOpen(false)
                  }}
                >
                  Issues
                </Button>
              </div>

              <div className="nav-mobile-section">
                <p className="nav-mobile-title">Actions</p>
                <Button
                  onClick={() => {
                    openIssueModal()
                    setIsMobileMenuOpen(false)
                  }}
                >
                  Create Issue
                </Button>
                {isMaintainer ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      openCreateUserModal()
                      setIsMobileMenuOpen(false)
                    }}
                  >
                    Create User
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusMessage('Profile page coming soon.')
                    setIsMobileMenuOpen(false)
                  }}
                >
                  Profile
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    handleLogout()
                    setIsMobileMenuOpen(false)
                  }}
                >
                  Logout
                </Button>
              </div>

              <div className="nav-mobile-section">
                <p className="nav-mobile-title">Projects</p>
                <Input
                  placeholder="Search projects"
                  value={projectNavQuery}
                  onChange={(event) => setProjectNavQuery(event.target.value)}
                />
                <div className="nav-list">
                  {navProjectList.map((project) => (
                    <Button
                      key={project.id}
                      variant="outline"
                      onClick={() => {
                        setActiveProject(project)
                        setActiveView('issues')
                        setSelectedIssue(null)
                        setAllIssuesView(false)
                        setIsMobileMenuOpen(false)
                      }}
                    >
                      {project.name} ({project.key})
                    </Button>
                  ))}
                  {navProjectList.length === 0 ? (
                    <p className="muted">No projects found.</p>
                  ) : null}
                </div>
                <div className="nav-menu-actions">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowProjectModal(true)
                      setIsMobileMenuOpen(false)
                    }}
                  >
                    Create project
                  </Button>
                  <Button
                    onClick={() => {
                      setActiveView('projects')
                      setAllIssuesView(false)
                      setIsMobileMenuOpen(false)
                    }}
                  >
                    Show all projects
                  </Button>
                </div>
              </div>

              <div className="nav-mobile-section">
                <p className="nav-mobile-title">Issues</p>
                <Input
                  placeholder="Search issues"
                  value={issueNavQuery}
                  onChange={(event) => setIssueNavQuery(event.target.value)}
                  disabled={allIssuesLoading}
                />
                <div className="nav-list">
                  {navIssueList.map((issue) => (
                    <Button
                      key={issue.id}
                      variant="outline"
                      onClick={() => {
                        handleSelectIssue(issue)
                        setActiveView('issues')
                        setAllIssuesView(false)
                        setIsMobileMenuOpen(false)
                      }}
                    >
                      {issue.title}
                    </Button>
                  ))}
                  {navIssueList.length === 0 ? (
                    <p className="muted">
                      {issueNavQuery ? 'No issues found.' : 'No recent issues yet.'}
                    </p>
                  ) : null}
                </div>
                <div className="nav-menu-actions">
                  <Button
                    variant="outline"
                    onClick={() => {
                      openIssueModal()
                      setIsMobileMenuOpen(false)
                    }}
                  >
                    Create issue
                  </Button>
                  <Button
                    onClick={() => {
                      setActiveView('issues')
                      setAllIssuesView(true)
                      setPage(0)
                      loadAllIssues()
                      setIsMobileMenuOpen(false)
                    }}
                  >
                    Show all issues
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

      
      {activeView === 'dashboard' ? (
        <>
          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <Card className="p-6">
              <div className="row">
                <h3>Projects</h3>
                <Button variant="outline" onClick={() => setShowProjectModal(true)}>
                  Create Project
                </Button>
              </div>
              <Input
                placeholder="Search projects"
                value={projectQuery}
                onChange={(event) => setProjectQuery(event.target.value)}
              />
              <p className="muted">
                Showing {projectStart}-{projectEnd} of {projectTotal}
              </p>
              <div className="list">
                {pagedProjects.map((project) => (
                  <Button
                    key={project.id}
                    variant={project.id === activeProject?.id ? "default" : "outline"}
                    className="w-full justify-between"
                    onClick={() => {
                      setSelectedIssue(null)
                      setActiveProject(project)
                      setAllIssuesView(false)
                    }}
                  >
                    {project.name} ({project.key})
                  </Button>
                ))}
                {pagedProjects.length === 0 ? (
                  <p className="muted">No projects found.</p>
                ) : null}
              </div>
              <div className="row">
                <Button
                  variant="outline"
                  onClick={() => setProjectPage((prev) => Math.max(prev - 1, 0))}
                  disabled={projectPage === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setProjectPage((prev) => prev + 1)}
                  disabled={(projectPage + 1) * projectPageSize >= projectTotal}
                >
                  Next
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              {activeProject ? (
                <>
                  <div className="project-header">
                    <div>
                      <h3>{activeProject.name}</h3>
                      <p className="muted">
                        {activeProject.description || 'No description.'}
                      </p>
                    </div>
                    <div className="project-meta">
                      <Badge variant="secondary">Role: {membership?.role ?? 'member'}</Badge>
                      <Badge variant="outline">Key: {activeProject.key}</Badge>
                    </div>
                  </div>

                  <div className="section members-panel">
                    <div className="row">
                      <h4>Members</h4>
                      <div className="members-filter">
                        <SearchableSelect
                          options={[
                            { value: 'all', label: 'All' },
                            { value: 'maintainer', label: 'Maintainers' },
                            { value: 'member', label: 'Members' },
                          ]}
                          defaultValue="all"
                          onChange={(value) => {
                            if (value === 'all') {
                              setMemberQuery('')
                              return
                            }
                            setMemberQuery(value)
                          }}
                        />
                      </div>
                    </div>
                    <div className="members-toolbar">
                      <Input
                        placeholder="Search members"
                        value={memberQuery}
                        onChange={(event) => setMemberQuery(event.target.value)}
                      />
                      <p className="muted">
                        Showing {memberStart}-{memberEnd} of {memberTotal}
                      </p>
                    </div>
                    <div className="list member-list">
                      {pagedMembers.map((member) => (
                        <Card key={member.user_id} className="member-card">
                          <div className="member-avatar">
                            {getInitials(member.name)}
                          </div>
                          <div className="member-info">
                            <strong>{member.name}</strong>
                            <span className="muted">{member.email}</span>
                          </div>
                          <div className="member-actions">
                            <Badge variant="secondary">{member.role}</Badge>
                            {isMaintainer && user?.id !== member.user_id ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRemoveMember(member.user_id)}
                                disabled={removeMemberLoading === member.user_id}
                              >
                                {removeMemberLoading === member.user_id ? (
                                  <>
                                    <span className="spinner" /> Removing...
                                  </>
                                ) : (
                                  "Remove"
                                )}
                              </Button>
                            ) : null}
                          </div>
                        </Card>
                      ))}
                      {pagedMembers.length === 0 ? (
                        <p className="muted">No members found.</p>
                      ) : null}
                    </div>
                    <div className="row">
                      <Button
                        variant="outline"
                        onClick={() => setMemberPage((prev) => Math.max(prev - 1, 0))}
                        disabled={memberPage === 0}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setMemberPage((prev) => prev + 1)}
                        disabled={(memberPage + 1) * memberPageSize >= memberTotal}
                      >
                        Next
                      </Button>
                    </div>
                    {isMaintainer ? (
                      <div className="member-form card">
                        <div className="row">
                          <h5>Add member</h5>
                          <span className="muted">Invite by ID or email</span>
                        </div>
                        <form className="grid gap-4" onSubmit={handleAddMember}>
                          <div className="grid gap-2">
                            <Label>Find user</Label>
                            <SearchableSelect
                              name="user_id"
                              placeholder="Search by name or email"
                              searchPlaceholder="Type at least 2 characters"
                              options={memberLookupOptions}
                              onSearch={handleUserLookup}
                              disabled={memberLookupLoading}
                              emptyActionLabel="Create user"
                              onEmptyAction={openCreateUserModal}
                              minSearchCharsForAction={2}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="member-email">Or add by email</Label>
                            <Input id="member-email" name="email" type="email" />
                          </div>
                          <div className="grid gap-2">
                            <Label>Role</Label>
                            <SearchableSelect
                              name="role"
                              defaultValue="member"
                              options={roleOptions}
                            />
                          </div>
                          <Button type="submit" disabled={addMemberLoading}>
                            {addMemberLoading ? (
                              <>
                                <span className="spinner" /> Adding...
                              </>
                            ) : (
                              "Add member"
                            )}
                          </Button>
                          <p className="muted">Provide a user ID or email.</p>
                        </form>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="muted">Select a project to see its issues.</p>
              )}
            </Card>
          </div>

          {issuesSection}
        </>
      ) : null}

      {activeView === 'projects' ? (
        <Card className="section p-6">
          <div className="row">
            <h3>All projects</h3>
            <Button variant="outline" onClick={() => setShowProjectModal(true)}>
              Create project
            </Button>
          </div>
          <input
            placeholder="Search projects"
            value={projectQuery}
            onChange={(event) => setProjectQuery(event.target.value)}
          />
          <p className="muted">
            Showing {projectStart}-{projectEnd} of {projectTotal}
          </p>
          <div className="list">
            {pagedProjects.map((project) => (
              <Button
                key={project.id}
                variant={project.id === activeProject?.id ? "default" : "outline"}
                className="w-full justify-between"
                onClick={() => {
                  setSelectedIssue(null)
                  setActiveProject(project)
                  setActiveView('issues')
                  setAllIssuesView(false)
                }}
              >
                {project.name} ({project.key})
              </Button>
            ))}
            {pagedProjects.length === 0 ? <p className="muted">No projects found.</p> : null}
          </div>
          <div className="row">
            <Button
              variant="outline"
              onClick={() => setProjectPage((prev) => Math.max(prev - 1, 0))}
              disabled={projectPage === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              onClick={() => setProjectPage((prev) => prev + 1)}
              disabled={(projectPage + 1) * projectPageSize >= projectTotal}
            >
              Next
            </Button>
          </div>
        </Card>
      ) : null}

      {activeView === 'issues' ? issuesSection : null}
      </div>
      <Dialog open={showProjectModal} onOpenChange={setShowProjectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              await handleCreateProject(event)
              setShowProjectModal(false)
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="project-name">Name</Label>
              <Input id="project-name" name="name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-key">Key</Label>
              <Input id="project-key" name="key" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-desc">Description</Label>
              <Textarea id="project-desc" name="description" rows={3} />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" /> Saving...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={showIssueModal} onOpenChange={setShowIssueModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create issue</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              await handleCreateIssue(event)
              setShowIssueModal(false)
            }}
          >
            <div className="grid gap-2">
              <Label>Project</Label>
              <SearchableSelect
                name="project_id"
                required
                defaultValue={activeProject?.id ? String(activeProject.id) : ''}
                placeholder="Select a project"
                options={projectSelectOptions}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="issue-title">Title</Label>
              <Input id="issue-title" name="title" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="issue-desc">Description</Label>
              <Textarea id="issue-desc" name="description" rows={4} />
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <SearchableSelect
                name="priority"
                defaultValue="medium"
                options={prioritySelectOptions}
              />
            </div>
            {isMaintainer ? (
              <div className="grid gap-2">
                <Label>Assignee</Label>
                <SearchableSelect
                  name="assignee_id"
                  defaultValue=""
                  options={assigneeSelectOptions}
                />
              </div>
            ) : null}
            <Button type="submit" disabled={createIssueLoading}>
              {createIssueLoading ? (
                <>
                  <span className="spinner" /> Saving...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={showCreateUserModal} onOpenChange={setShowCreateUserModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              await handleCreateUser(event)
              setShowCreateUserModal(false)
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="user-name">Name</Label>
              <Input id="user-name" name="name" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" name="email" type="email" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-password">Password</Label>
              <Input id="user-password" name="password" type="password" required minLength={8} />
            </div>
            <div className="grid gap-2">
              <Label>Project</Label>
              <SearchableSelect
                name="project_id"
                placeholder="Select a project"
                options={projectSelectOptions}
              />
            </div>
            <Button type="submit" disabled={createUserLoading}>
              {createUserLoading ? (
                <>
                  <span className="spinner" /> Creating...
                </>
              ) : (
                "Create user"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
