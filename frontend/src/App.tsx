import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
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

type AuthMode = 'login' | 'signup'
type ViewMode = 'dashboard' | 'projects' | 'issues'
type NavMenu = 'projects' | 'issues' | null
type IssueWithProject = Issue & { project_name?: string }
type SelectOption = { value: string; label: string }
type ToastType = 'success' | 'error'
type Toast = { id: number; type: ToastType; message: string }

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
  const [showProfileMenu, setShowProfileMenu] = useState(false)
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
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastIdRef = useRef(0)

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

  function pushToast(type: ToastType, message: string) {
    const id = toastIdRef.current + 1
    toastIdRef.current = id
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 4000)
  }

  useEffect(() => {
    if (!statusMessage) return
    pushToast('success', statusMessage)
    setStatusMessage(null)
  }, [statusMessage])

  useEffect(() => {
    if (!errorMessage) return
    pushToast('error', errorMessage)
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
    setLoading(true)
    setErrorMessage(null)
    const form = new FormData(event.currentTarget)
    try {
      if (authMode === 'signup') {
        await signup({
          name: String(form.get('name') || ''),
          email: String(form.get('email') || ''),
          password: String(form.get('password') || ''),
        })
      }
      const result = await login({
        email: String(form.get('email') || ''),
        password: String(form.get('password') || ''),
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
    setLoading(true)
    setErrorMessage(null)
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    try {
      await createProject({
        name: String(form.get('name') || ''),
        key: String(form.get('key') || '').toUpperCase(),
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
    if (!projectId) {
      setErrorMessage('Select a project before creating an issue.')
      return
    }
    try {
      setCreateIssueLoading(true)
      const created = await createIssue(projectId, {
        title: String(form.get('title') || ''),
        description: String(form.get('description') || ''),
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
    try {
      setAddMemberLoading(true)
      const email = String(form.get('email') || '').trim()
      const userIdValue = String(form.get('user_id') || '').trim()
      if (!email && !userIdValue) {
        setErrorMessage('Provide a user ID or email.')
        return
      }
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
    const payload = {
      title: String(form.get('title') || selectedIssue.title),
      description: String(form.get('description') || ''),
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
    try {
      setAddCommentLoading(true)
      const comment = await addComment(selectedIssue.id, {
        body: String(form.get('body') || ''),
      })
      setComments((prev) => [...prev, comment])
      formElement?.reset()
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
    <div className="section card">
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
        <input
          placeholder="Search title"
          value={filters.q}
          onChange={(event) => {
            setFilters({ ...filters, q: event.target.value })
            setPage(0)
          }}
        />
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

      <div className="section grid grid-2">
        <div className="list">
          <p className="muted">
            Showing {pagedIssues.length === 0 ? 0 : page * pageSize + 1}-
            {page * pageSize + pagedIssues.length} of {issueTotalCount}
          </p>
          {pagedIssues.map((issue) => (
            <button key={issue.id} onClick={() => handleSelectIssue(issue)}>
              <div className="row">
                <div>
                  <strong>{issue.title}</strong>
                  <div className="muted">
                    {issue.status} · {issue.priority}
                    {allIssuesView ? ` · ${resolveProjectName(issue.project_id)}` : ''}
                  </div>
                </div>
                <span className="badge">#{issue.id}</span>
              </div>
            </button>
          ))}
          {issueSource.length === 0 ? <p className="muted">No issues found.</p> : null}
          <div className="row">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
              disabled={page === 0}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={page * pageSize + pagedIssues.length >= issueTotalCount}
            >
              Next
            </button>
          </div>
        </div>

        <div className="card issue-details">
          <div className="row">
            <h4>Issue details</h4>
            {selectedIssue ? <span className="badge">#{selectedIssue.id}</span> : null}
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
              <form className="grid" onSubmit={handleUpdateIssue}>
                <label>
                  Title
                  <input name="title" required defaultValue={selectedIssue.title} />
                </label>
                <label>
                  Description
                  <textarea
                    name="description"
                    rows={4}
                    defaultValue={selectedIssue.description ?? ''}
                  />
                </label>
                <label>
                  Priority
                  <SearchableSelect
                    name="priority"
                    defaultValue={selectedIssue.priority}
                    options={prioritySelectOptions}
                  />
                </label>
                {isMaintainer ? (
                  <>
                    <label>
                      Status
                      <SearchableSelect
                        name="status"
                        defaultValue={selectedIssue.status}
                        options={statusSelectOptions}
                      />
                    </label>
                    <label>
                      Assignee
                      <SearchableSelect
                        name="assignee_id"
                        defaultValue={String(selectedIssue.assignee_id ?? '')}
                        options={assigneeSelectOptions}
                      />
                    </label>
                  </>
                ) : null}
                <button className="primary" type="submit" disabled={updateIssueLoading}>
                  {updateIssueLoading ? (
                    <>
                      <span className="spinner" /> Updating...
                    </>
                  ) : (
                    'Update issue'
                  )}
                </button>
                <button type="button" onClick={handleDeleteIssue} disabled={deleteIssueLoading}>
                  {deleteIssueLoading ? (
                    <>
                      <span className="spinner" /> Deleting...
                    </>
                  ) : (
                    'Delete issue'
                  )}
                </button>
              </form>
            </>
          ) : (
            <p className="muted">Select an issue to view details.</p>
          )}
        </div>
      </div>

      {selectedIssue ? (
        <div className="section comments">
          <div className="row">
            <h4>Comments</h4>
            <input
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
              <div key={comment.id} className="comment-card">
                <div className="comment-header">
                  <span className="badge">#{comment.id}</span>
                  <span className="muted">{resolveMemberName(comment.author_id)}</span>
                  <span className="muted">
                    {new Date(comment.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="comment-body">{comment.body}</p>
              </div>
            ))}
            {pagedComments.length === 0 ? <p className="muted">No comments found.</p> : null}
          </div>
          <div className="row">
            <button
              type="button"
              onClick={() => setCommentPage((prev) => Math.max(prev - 1, 0))}
              disabled={commentPage === 0}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCommentPage((prev) => prev + 1)}
              disabled={(commentPage + 1) * commentPageSize >= commentTotal}
            >
              Next
            </button>
          </div>
          <form className="grid section" onSubmit={handleAddComment}>
            <label>
              Add comment
              <textarea name="body" rows={3} required />
            </label>
            <button className="primary" type="submit">
              Add comment
            </button>
          </form>
        </div>
      ) : null}
    </div>
  ) : (
    <div className="section card">
      <p className="muted">Select a project to see its issues.</p>
    </div>
  )

  if (!user) {
    return (
      <div className="app">
        <div className="nav">
          <h2>IssueHub</h2>
        </div>
        <div className="card">
          <h3>{authMode === 'login' ? 'Login' : 'Sign up'}</h3>
          <form className="grid" onSubmit={handleLogin}>
            {authMode === 'signup' ? (
              <>
                <label>
                  Name
                  <input name="name" required />
                </label>
              </>
            ) : null}
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Password
              <input name="password" type="password" required minLength={8} />
            </label>
            <button className="primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" /> Processing...
                </>
              ) : authMode === 'login' ? (
                'Login'
              ) : (
                'Create account'
              )}
            </button>
            <button
              type="button"
              className="link"
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
            >
              {authMode === 'login' ? 'Need an account? Sign up' : 'Have an account? Login'}
            </button>
          </form>
          
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
      <div className="app">
        <div className="nav-bar">
          <div className="nav-container">
            <div className="nav-left">
              <div className="logo">
                <img src="/issuehub-logo.svg" alt="IssueHub logo" />
                <span>IssueHub</span>
              </div>
            </div>
            <div className="nav-center">
          <div className="nav-item">
                <button
                  type="button"
                  className="nav-button"
                  onClick={() =>
                    setOpenMenu((prev) => (prev === 'projects' ? null : 'projects'))
                  }
                >
                  Projects
                </button>
                {openMenu === 'projects' ? (
                  <div className="nav-menu">
                    <input
                      placeholder="Search projects"
                      value={projectNavQuery}
                      onChange={(event) => setProjectNavQuery(event.target.value)}
                    />
                    <div className="nav-list">
                      {navProjectList.map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => {
                            setActiveProject(project)
                            setActiveView('issues')
                            setSelectedIssue(null)
                        setAllIssuesView(false)
                            setOpenMenu(null)
                          }}
                        >
                          {project.name} ({project.key})
                        </button>
                      ))}
                      {navProjectList.length === 0 ? (
                        <p className="muted">No projects found.</p>
                      ) : null}
                    </div>
                    <div className="nav-menu-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setShowProjectModal(true)
                          setOpenMenu(null)
                        }}
                      >
                        Create project
                      </button>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => {
                          setActiveView('projects')
                      setAllIssuesView(false)
                          setOpenMenu(null)
                        }}
                      >
                        Show all projects
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="nav-item">
                <button
                  type="button"
                  className="nav-button"
                  onClick={() => setOpenMenu((prev) => (prev === 'issues' ? null : 'issues'))}
                >
                  Issues
                </button>
                {openMenu === 'issues' ? (
                  <div className="nav-menu">
                    <input
                      placeholder="Search issues"
                      value={issueNavQuery}
                      onChange={(event) => setIssueNavQuery(event.target.value)}
                  disabled={allIssuesLoading}
                    />
                <div className="nav-list">
                  {navIssueList.map((issue) => (
                    <button
                      key={issue.id}
                      type="button"
                      onClick={() => {
                        handleSelectIssue(issue)
                        setActiveView('issues')
                        setAllIssuesView(false)
                        setOpenMenu(null)
                      }}
                    >
                      {issue.title}
                    </button>
                  ))}
                  {navIssueList.length === 0 ? (
                    <p className="muted">
                      {issueNavQuery ? 'No issues found.' : 'No recent issues yet.'}
                    </p>
                  ) : null}
                </div>
                    <div className="nav-menu-actions">
                      <button
                        type="button"
                        onClick={() => {
                      openIssueModal()
                          setOpenMenu(null)
                        }}
                      >
                        Create issue
                      </button>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => {
                          setActiveView('issues')
                      setAllIssuesView(true)
                      setPage(0)
                      loadAllIssues()
                          setOpenMenu(null)
                        }}
                      >
                        Show all issues
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="nav-actions">
              <button
                className="primary"
                type="button"
                onClick={() => {
                  openIssueModal()
                }}
              >
                Create Issue
              </button>
              {isMaintainer ? (
                <button type="button" onClick={openCreateUserModal}>
                  Create User
                </button>
              ) : null}
              <div
                className="profile"
                onMouseEnter={() => setShowProfileMenu(true)}
                onMouseLeave={() => setShowProfileMenu(false)}
              >
                <button
                  type="button"
                  className="avatar-button"
                  onClick={() => setShowProfileMenu((prev) => !prev)}
                >
                  {getInitials(user.name)}
                </button>
                {showProfileMenu ? (
                  <div className="profile-menu">
                    <div className="profile-meta">
                      <strong>{user.name}</strong>
                      <span className="muted">{user.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusMessage('Profile page coming soon.')
                        setShowProfileMenu(false)
                      }}
                    >
                      Profile
                    </button>
                    <button type="button" onClick={handleLogout}>
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

      
      {activeView === 'dashboard' ? (
        <>
          <div className="grid grid-2 split-60-40">
            <div className="card">
              <div className="row">
                <h3>Projects</h3>
                <button type="button" onClick={() => setShowProjectModal(true)}>
                  Create Project
                </button>
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
                  <button
                    key={project.id}
                    className={project.id === activeProject?.id ? 'primary' : ''}
                    onClick={() => {
                      setSelectedIssue(null)
                      setActiveProject(project)
                      setAllIssuesView(false)
                    }}
                  >
                    {project.name} ({project.key})
                  </button>
                ))}
                {pagedProjects.length === 0 ? (
                  <p className="muted">No projects found.</p>
                ) : null}
              </div>
              <div className="row">
                <button
                  type="button"
                  onClick={() => setProjectPage((prev) => Math.max(prev - 1, 0))}
                  disabled={projectPage === 0}
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setProjectPage((prev) => prev + 1)}
                  disabled={(projectPage + 1) * projectPageSize >= projectTotal}
                >
                  Next
                </button>
              </div>
            </div>

            <div className="card">
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
                      <span className="pill">Role: {membership?.role ?? 'member'}</span>
                      <span className="badge">Key: {activeProject.key}</span>
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
                      <input
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
                        <div key={member.user_id} className="member-card">
                          <div className="member-avatar">
                            {getInitials(member.name)}
                          </div>
                          <div className="member-info">
                            <strong>{member.name}</strong>
                            <span className="muted">{member.email}</span>
                          </div>
                          <div className="member-actions">
                            <span className="badge">{member.role}</span>
                            {isMaintainer && user?.id !== member.user_id ? (
                              <button
                                type="button"
                                className="danger"
                                onClick={() => handleRemoveMember(member.user_id)}
                                disabled={removeMemberLoading === member.user_id}
                              >
                                {removeMemberLoading === member.user_id ? (
                                  <>
                                    <span className="spinner" /> Removing...
                                  </>
                                ) : (
                                  'Remove'
                                )}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      {pagedMembers.length === 0 ? (
                        <p className="muted">No members found.</p>
                      ) : null}
                    </div>
                    <div className="row">
                      <button
                        type="button"
                        onClick={() => setMemberPage((prev) => Math.max(prev - 1, 0))}
                        disabled={memberPage === 0}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setMemberPage((prev) => prev + 1)}
                        disabled={(memberPage + 1) * memberPageSize >= memberTotal}
                      >
                        Next
                      </button>
                    </div>
                    {isMaintainer ? (
                      <div className="member-form card">
                        <div className="row">
                          <h5>Add member</h5>
                          <span className="muted">Invite by ID or email</span>
                        </div>
                        <form className="grid" onSubmit={handleAddMember}>
                        <label>
                          Find user
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
                        </label>
                          <label>
                            Or add by email
                            <input name="email" type="email" />
                          </label>
                          <label>
                            Role
                            <SearchableSelect
                              name="role"
                              defaultValue="member"
                              options={roleOptions}
                            />
                          </label>
                          <button className="primary" type="submit" disabled={addMemberLoading}>
                            {addMemberLoading ? (
                              <>
                                <span className="spinner" /> Adding...
                              </>
                            ) : (
                              'Add member'
                            )}
                          </button>
                          <p className="muted">Provide a user ID or email.</p>
                        </form>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="muted">Select a project to see its issues.</p>
              )}
            </div>
          </div>

          {issuesSection}
        </>
      ) : null}

      {activeView === 'projects' ? (
        <div className="section card">
          <div className="row">
            <h3>All projects</h3>
            <button type="button" onClick={() => setShowProjectModal(true)}>
              Create project
            </button>
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
                <button
                  key={project.id}
                  className={project.id === activeProject?.id ? 'primary' : ''}
                  onClick={() => {
                    setSelectedIssue(null)
                    setActiveProject(project)
                    setActiveView('issues')
                    setAllIssuesView(false)
                  }}
                >
                {project.name} ({project.key})
              </button>
            ))}
            {pagedProjects.length === 0 ? <p className="muted">No projects found.</p> : null}
          </div>
          <div className="row">
            <button
              type="button"
              onClick={() => setProjectPage((prev) => Math.max(prev - 1, 0))}
              disabled={projectPage === 0}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setProjectPage((prev) => prev + 1)}
              disabled={(projectPage + 1) * projectPageSize >= projectTotal}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {activeView === 'issues' ? issuesSection : null}
      </div>
      {showProjectModal ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal card" role="dialog" aria-modal="true">
          <div className="row">
            <h3>Create project</h3>
            <button type="button" onClick={() => setShowProjectModal(false)}>
              Close
            </button>
          </div>
          <form
            className="grid"
            onSubmit={async (event) => {
              await handleCreateProject(event)
              setShowProjectModal(false)
            }}
          >
            <label>
              Name
              <input name="name" required />
            </label>
            <label>
              Key
              <input name="key" required />
            </label>
            <label>
              Description
              <textarea name="description" rows={3} />
            </label>
            <button className="primary" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" /> Saving...
                </>
              ) : (
                'Create'
              )}
            </button>
          </form>
          </div>
        </div>
      ) : null}
      {showIssueModal ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal card" role="dialog" aria-modal="true">
            <div className="row">
              <h3>Create issue</h3>
              <button type="button" onClick={() => setShowIssueModal(false)}>
                Close
              </button>
            </div>
            <form
              className="grid"
              onSubmit={async (event) => {
                await handleCreateIssue(event)
                setShowIssueModal(false)
              }}
            >
              <label>
                Project
                <SearchableSelect
                  name="project_id"
                  required
                  defaultValue={activeProject?.id ? String(activeProject.id) : ''}
                  placeholder="Select a project"
                  options={projectSelectOptions}
                />
              </label>
              <label>
                Title
                <input name="title" required />
              </label>
              <label>
                Description
                <textarea name="description" rows={4} />
              </label>
              <label>
                Priority
                <SearchableSelect
                  name="priority"
                  defaultValue="medium"
                  options={prioritySelectOptions}
                />
              </label>
              {isMaintainer ? (
                <label>
                  Assignee
                  <SearchableSelect
                    name="assignee_id"
                    defaultValue=""
                    options={assigneeSelectOptions}
                  />
                </label>
              ) : null}
              <button className="primary" type="submit" disabled={createIssueLoading}>
                {createIssueLoading ? (
                  <>
                    <span className="spinner" /> Saving...
                  </>
                ) : (
                  'Create'
                )}
              </button>
            </form>
          </div>
        </div>
      ) : null}
      {showCreateUserModal ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal card" role="dialog" aria-modal="true">
            <div className="row">
              <h3>Create user</h3>
              <button type="button" onClick={() => setShowCreateUserModal(false)}>
                Close
              </button>
            </div>
            <form
              className="grid"
              onSubmit={async (event) => {
                await handleCreateUser(event)
                setShowCreateUserModal(false)
              }}
            >
              <label>
                Name
                <input name="name" required />
              </label>
              <label>
                Email
                <input name="email" type="email" required />
              </label>
              <label>
                Password
                <input name="password" type="password" required minLength={8} />
              </label>
              <label>
                Project
                <SearchableSelect
                  name="project_id"
                  placeholder="Select a project"
                  options={projectSelectOptions}
                />
              </label>
              <button className="primary" type="submit" disabled={createUserLoading}>
                {createUserLoading ? (
                  <>
                    <span className="spinner" /> Creating...
                  </>
                ) : (
                  'Create user'
                )}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
