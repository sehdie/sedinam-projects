import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  Activity,
  AlignJustify,
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Command,
  FileText,
  Filter,
  FolderKanban,
  GripVertical,
  LayoutGrid,
  LoaderCircle,
  ListFilter,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  Sparkles,
  SquareCheckBig,
  X,
} from "lucide-react";

const columns = [
  { id: "backlog", label: "To do", tone: "slate" },
  { id: "inProgress", label: "In progress", tone: "blue" },
  { id: "review", label: "In review", tone: "amber" },
  { id: "done", label: "Done", tone: "green" },
];

const priorities = [
  { id: "urgent", label: "Urgent" },
  { id: "high", label: "High" },
  { id: "normal", label: "Normal" },
  { id: "low", label: "Low" },
];

const priorityLabels = Object.fromEntries(priorities.map(({ id, label }) => [id, label]));
const columnLabels = Object.fromEntries(columns.map(({ id, label }) => [id, label]));

function initials(name) {
  return String(name || "?").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function displayDate(value) {
  if (!value) return "No date";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat([], { month: "short", day: "numeric" }).format(date);
}

function dateTone(value, status) {
  if (status === "done" || !value) return "date-neutral";
  const due = new Date(`${value}T23:59:59`);
  return due < new Date() ? "date-overdue" : "date-neutral";
}

function Avatar({ member, size = "normal" }) {
  return <span className={`avatar avatar-${size}`} style={{ "--avatar-color": member?.color || "#9caa9d" }} title={member?.name || "Unassigned"}>{member?.initials || <span className="avatar-empty">?</span>}</span>;
}

function TaskCard({ task, members, onOpen, onDragStart, onDragEnd, dragging }) {
  const assignee = members.find((member) => member.id === task.assigneeId);
  return (
    <article
      className={`task-card ${dragging ? "is-dragging" : ""}`}
      draggable
      onDragStart={(event) => onDragStart(event, task)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task)}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(task); } }}
      role="button"
      tabIndex={0}
      aria-label={`${task.title}, ${priorityLabels[task.priority]} priority, ${columnLabels[task.status]}`}
    >
      <div className="task-card-top"><span className={`priority-mark priority-${task.priority}`}><i />{priorityLabels[task.priority]}</span><button className="task-more icon-quiet" type="button" title="Edit task" aria-label={`Edit ${task.title}`} onClick={(event) => { event.stopPropagation(); onOpen(task); }}><MoreHorizontal size={17} /></button></div>
      <h3>{task.title}</h3>
      {task.description && <p className="task-description">{task.description}</p>}
      {task.tags?.length > 0 && <div className="task-tags">{task.tags.map((tag) => <span className="task-tag" key={tag}>{tag}</span>)}</div>}
      <div className="task-card-bottom"><span className={`task-due ${dateTone(task.dueDate, task.status)}`}><CalendarDays size={13} />{displayDate(task.dueDate)}</span><div className="task-card-meta"><span className="task-comments" title="No comments yet"><MessageSquareText size={13} /><span>0</span></span><Avatar member={assignee} size="small" /></div></div>
    </article>
  );
}

function TaskDialog({ task, members, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => ({
    title: task?.title || "",
    description: task?.description || "",
    status: task?.status || "backlog",
    priority: task?.priority || "normal",
    assigneeId: task?.assigneeId || "",
    dueDate: task?.dueDate || "",
    tags: task?.tags?.join(", ") || "",
  }));
  const titleRef = useRef(null);
  const isNew = !task?.id;

  useEffect(() => {
    titleRef.current?.focus();
    function onKeyDown(event) { if (event.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    if (!form.title.trim()) return;
    onSave({
      title: form.title.trim(),
      description: form.description.trim(),
      status: form.status,
      priority: form.priority,
      assigneeId: form.assigneeId || null,
      dueDate: form.dueDate,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 4),
    });
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="task-dialog" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title">
        <div className="dialog-header"><div><span className="dialog-kicker">PRODUCT LAUNCH / {isNew ? "NEW TASK" : "TASK DETAILS"}</span><h2 id="task-dialog-title">{isNew ? "Create a task" : "Edit task"}</h2></div><button className="icon-button" type="button" aria-label="Close task editor" onClick={onClose}><X size={18} /></button></div>
        <form className="task-form" onSubmit={submit}>
          <label className="field-label" htmlFor="task-title">Task name <span>Required</span></label>
          <input ref={titleRef} id="task-title" className="field-input task-title-input" maxLength={100} placeholder="What needs to get done?" value={form.title} onChange={(event) => update("title", event.target.value)} required />
          <label className="field-label" htmlFor="task-description">Description</label>
          <textarea id="task-description" className="field-input task-textarea" maxLength={1000} rows={4} placeholder="Add context, acceptance criteria, or a useful link..." value={form.description} onChange={(event) => update("description", event.target.value)} />
          <div className="field-grid">
            <div><label className="field-label" htmlFor="task-status">Status</label><select id="task-status" className="field-input" value={form.status} onChange={(event) => update("status", event.target.value)}>{columns.map((column) => <option key={column.id} value={column.id}>{column.label}</option>)}</select></div>
            <div><label className="field-label" htmlFor="task-priority">Priority</label><select id="task-priority" className="field-input" value={form.priority} onChange={(event) => update("priority", event.target.value)}>{priorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.label}</option>)}</select></div>
            <div><label className="field-label" htmlFor="task-assignee">Assignee</label><select id="task-assignee" className="field-input" value={form.assigneeId} onChange={(event) => update("assigneeId", event.target.value)}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
            <div><label className="field-label" htmlFor="task-date">Due date</label><input id="task-date" className="field-input" type="date" value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} /></div>
          </div>
          <label className="field-label" htmlFor="task-tags">Labels <span>Separate with commas</span></label>
          <input id="task-tags" className="field-input" maxLength={90} placeholder="Design, Launch" value={form.tags} onChange={(event) => update("tags", event.target.value)} />
          <div className="dialog-footer">{!isNew && <button className="delete-task-button" type="button" onClick={() => { if (window.confirm("Delete this task? This cannot be undone.")) onDelete(task.id); }}>Delete task</button>}<div className="dialog-footer-actions"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Check size={15} />{isNew ? "Create task" : "Save changes"}</button></div></div>
        </form>
      </section>
    </div>
  );
}

function ProfileDialog({ name, onClose, onSave }) {
  const [value, setValue] = useState(name);
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div className="dialog-header"><div><span className="dialog-kicker">WORKSPACE PROFILE</span><h2 id="profile-title">How teammates see you</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={onClose}><X size={18} /></button></div><form onSubmit={(event) => { event.preventDefault(); if (value.trim()) onSave(value.trim()); }}><label className="field-label" htmlFor="profile-name">Display name</label><input id="profile-name" className="field-input" maxLength={24} autoFocus value={value} onChange={(event) => setValue(event.target.value)} /><div className="profile-dialog-footer"><button className="secondary-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Check size={15} />Save name</button></div></form></section></div>;
}

export default function App() {
  const [name, setName] = useState(localStorage.getItem("kanban-name") || "Alex Morgan");
  const [board, setBoard] = useState(null);
  const [onlineMembers, setOnlineMembers] = useState([]);
  const [socketState, setSocketState] = useState("connecting");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("updated");
  const [view, setView] = useState("board");
  const [activeTask, setActiveTask] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io({ autoConnect: false });
    socketRef.current = socket;
    socket.on("connect", () => {
      setSocketState("online");
      socket.emit("board:join", { name });
    });
    socket.on("disconnect", () => setSocketState("offline"));
    socket.on("connect_error", () => setSocketState("offline"));
    socket.on("board:error", (message) => setError(message));
    socket.on("board:state", (nextBoard) => { setBoard(nextBoard); setError(""); });
    socket.on("board:presence", setOnlineMembers);
    socket.connect();
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [name]);

  useEffect(() => {
    function handleShortcut(event) {
      const target = event.target;
      const isTyping = target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"));
      if (event.key === "/" && !isTyping && !document.querySelector('[role="dialog"]')) {
        event.preventDefault();
        document.querySelector(".search-control input")?.focus();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...(board?.tasks || [])]
      .filter((task) => !query || [task.title, task.description, ...task.tags].join(" ").toLowerCase().includes(query))
      .filter((task) => assigneeFilter === "all" || task.assigneeId === assigneeFilter)
      .filter((task) => priorityFilter === "all" || task.priority === priorityFilter)
      .sort((first, second) => {
        if (sortOrder === "priority") return priorities.findIndex((priority) => priority.id === first.priority) - priorities.findIndex((priority) => priority.id === second.priority);
        if (sortOrder === "due") return (first.dueDate || "9999").localeCompare(second.dueDate || "9999");
        return second.updatedAt.localeCompare(first.updatedAt);
      });
  }, [board?.tasks, search, assigneeFilter, priorityFilter, sortOrder]);

  const activeCount = board?.tasks.filter((task) => task.status !== "done").length || 0;
  const completedCount = board?.tasks.filter((task) => task.status === "done").length || 0;

  function send(event, payload) {
    socketRef.current?.emit(event, payload);
  }

  function openNewTask(status = "backlog") {
    setActiveTask({ status });
  }

  function saveTask(values) {
    if (activeTask?.id) send("task:update", { id: activeTask.id, patch: values });
    else send("task:create", values);
    setActiveTask(null);
  }

  function deleteTask(taskId) {
    send("task:delete", taskId);
    setActiveTask(null);
  }

  function moveTask(taskId, status) {
    send("task:move", { id: taskId, status });
    setDraggedTaskId(null);
    setDragOverColumn(null);
  }

  function startDrag(event, task) {
    setDraggedTaskId(task.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
  }

  function saveProfile(nextName) {
    localStorage.setItem("kanban-name", nextName);
    setName(nextName);
    setProfileOpen(false);
  }

  function renderTask(task) {
    return <TaskCard key={task.id} task={task} members={board.members} onOpen={setActiveTask} onDragStart={startDrag} onDragEnd={() => { setDraggedTaskId(null); setDragOverColumn(null); }} dragging={draggedTaskId === task.id} />;
  }

  return (
    <div className="workspace-shell">
      <aside className={`sidebar ${mobileSidebarOpen ? "sidebar-open" : ""}`}>
        <div className="workspace-brand"><span className="brand-mark"><FolderKanban size={18} /></span><span>fieldwork</span><button className="sidebar-close icon-button" type="button" aria-label="Close navigation" onClick={() => setMobileSidebarOpen(false)}><X size={17} /></button></div>
        <button className="workspace-switcher" type="button" onClick={() => setMobileSidebarOpen((open) => !open)}><span className="workspace-icon">FL</span><span className="workspace-switcher-copy"><strong>Fieldwork Studio</strong><small>Free workspace</small></span><ChevronDown size={14} /></button>
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          <span className="nav-section-label">WORKSPACE</span>
          <button className="nav-item" type="button"><Activity size={16} /><span>Overview</span></button>
          <button className="nav-item" type="button"><SquareCheckBig size={16} /><span>My tasks</span><span className="nav-count">4</span></button>
          <button className="nav-item" type="button"><Bell size={16} /><span>Inbox</span><span className="nav-unread" /> </button>
          <div className="nav-heading"><span className="nav-section-label">YOUR BOARDS</span><button type="button" title="Add board" aria-label="Add board"><Plus size={15} /></button></div>
          <button className="nav-item nav-item-active" type="button"><span className="board-nav-dot" /><span>Product launch</span><span className="nav-count">{activeCount}</span></button>
          <button className="nav-item" type="button"><span className="board-nav-dot dot-lilac" /><span>Website refresh</span></button>
          <button className="nav-item" type="button"><span className="board-nav-dot dot-coral" /><span>Research sprint</span></button>
          <button className="nav-item nav-add-board" type="button"><Plus size={14} /><span>Add a board</span></button>
          <div className="sidebar-section-separator" />
          <button className="nav-item" type="button"><FileText size={16} /><span>Notes & docs</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-upgrade"><div className="upgrade-icon"><Sparkles size={14} /></div><strong>Make good work visible.</strong><p>Invite your team and keep the moving parts in one place.</p><button type="button" onClick={() => setProfileOpen(true)}>Invite teammates <ArrowUpRight size={13} /></button></div>
          <button className="sidebar-help" type="button"><CircleHelp size={15} /><span>Help & shortcuts</span><Command size={12} /><span>K</span></button>
        </div>
      </aside>
      {mobileSidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" type="button" onClick={() => setMobileSidebarOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu icon-button" type="button" aria-label="Open navigation" onClick={() => setMobileSidebarOpen(true)}><Menu size={18} /></button>
          <div className="breadcrumbs"><span>Boards</span><ChevronRight size={13} /><strong>Product launch</strong></div>
          <div className="topbar-actions"><span className={`sync-indicator ${socketState}`}><i />{socketState === "online" ? "Synced" : "Reconnecting"}</span><button className="topbar-icon icon-button" type="button" title="Notifications" aria-label="Notifications"><Bell size={17} /><i /></button><span className="topbar-separator" /><button className="profile-button" type="button" onClick={() => setProfileOpen(true)} aria-label={`Edit profile for ${name}`}><Avatar member={{ name, initials: initials(name), color: "#c49b50" }} /><span>{name.split(" ")[0]}</span><ChevronDown size={13} /></button></div>
        </header>

        <div className="content-wrap">
          <div className="board-title-row"><div><div className="board-eyebrow"><span className="board-eyebrow-square" /> CUSTOMER EXPERIENCE <span className="eyebrow-divider">/</span> Q4 2026</div><div className="board-title-line"><h1>Product launch</h1><button className="title-more icon-quiet" type="button" title="Board options" aria-label="Board options" onClick={() => { setSearch(""); setAssigneeFilter("all"); setPriorityFilter("all"); setSortOrder("updated"); }}><MoreHorizontal size={20} /></button></div><p className="board-summary">One clear view of the work between idea and shipped.</p></div><div className="board-title-actions"><div className="collaborator-stack" aria-label={`${onlineMembers.length} people online`}>{onlineMembers.slice(0, 4).map((member) => <Avatar key={member.id} member={member} size="stack" />)}{onlineMembers.length > 4 && <span className="avatar-overflow">+{onlineMembers.length - 4}</span>}</div><button className="share-button" type="button" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setError("Board link copied. Share it with a teammate to collaborate."); } catch { setError("Share this board at " + window.location.href); } }}><Plus size={15} />Invite</button><button className="board-add-button" type="button" onClick={() => openNewTask()}><Plus size={16} />Add task</button></div></div>

          <section className="board-metrics" aria-label="Board summary"><div className="metric-item"><span className="metric-label">OPEN TASKS</span><strong>{activeCount}</strong></div><div className="metric-item"><span className="metric-label">COMPLETED</span><strong>{completedCount}</strong></div><div className="metric-item metric-progress"><span className="metric-label">SPRINT PROGRESS</span><strong>{board ? Math.round(completedCount / Math.max(board.tasks.length, 1) * 100) : 0}<small>%</small></strong><div className="progress-track"><i style={{ width: `${board ? completedCount / Math.max(board.tasks.length, 1) * 100 : 0}%` }} /></div></div><div className="metric-activity"><span className="activity-pulse" /><span>{onlineMembers.length} teammates in this board</span></div></section>

          {error && <div className="error-banner" role="alert"><span>{error}</span><button type="button" aria-label="Dismiss" onClick={() => setError("")}><X size={15} /></button></div>}

          <div className="board-toolbar"><div className="toolbar-left"><label className="search-control"><Search size={16} /><input aria-label="Search tasks" placeholder="Find a task..." value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>/</kbd></label><label className="filter-control"><Filter size={14} /><span>Assignee</span><select aria-label="Filter by assignee" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}><option value="all">All</option>{board?.members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select><ChevronDown size={12} /></label><label className="filter-control priority-filter"><ListFilter size={14} /><span>Priority</span><select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">All</option>{priorities.map((priority) => <option key={priority.id} value={priority.id}>{priority.label}</option>)}</select><ChevronDown size={12} /></label></div><div className="toolbar-right"><label className="sort-control"><ArrowDownWideNarrow size={15} /><select aria-label="Sort tasks" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}><option value="updated">Last updated</option><option value="due">Due date</option><option value="priority">Priority</option></select><ChevronDown size={12} /></label><span className="toolbar-separator" /><div className="view-switch" role="group" aria-label="Board view"><button className={view === "board" ? "selected" : ""} type="button" aria-label="Board view" aria-pressed={view === "board"} onClick={() => setView("board")}><LayoutGrid size={16} /></button><button className={view === "list" ? "selected" : ""} type="button" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><AlignJustify size={16} /></button></div><button className="toolbar-settings icon-quiet" type="button" title="Board settings" aria-label="Board settings"><Settings2 size={17} /></button></div></div>

          {!board ? <div className="loading-board"><span className="loading-mark"><LoaderCircle /></span><span>Opening the board...</span></div> : view === "board" ? <div className="kanban-board" aria-label="Product launch task board">{columns.map((column) => {
            const columnTasks = filteredTasks.filter((task) => task.status === column.id);
            return <section key={column.id} className={`kanban-column column-${column.tone} ${dragOverColumn === column.id ? "drop-active" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragOverColumn(column.id); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragOverColumn(null); }} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain") || draggedTaskId; if (id) moveTask(id, column.id); }} aria-label={`${column.label}, ${columnTasks.length} tasks`}>
              <div className="column-header"><div className="column-title"><span className="column-indicator" /><h2>{column.label}</h2><span className="column-count">{columnTasks.length}</span></div><button className="column-more icon-quiet" type="button" title={`${column.label} options`} aria-label={`${column.label} options`}><MoreHorizontal size={18} /></button></div>
              <div className="column-cards">{columnTasks.map(renderTask)}{columnTasks.length === 0 && <button className="empty-column" type="button" onClick={() => openNewTask(column.id)}><Plus size={15} />Add a task</button>}</div>
              <button className="column-add" type="button" onClick={() => openNewTask(column.id)}><Plus size={15} />Add task</button>
            </section>;
          })}</div> : <div className="list-view"><table><thead><tr><th>TASK</th><th>STATUS</th><th>PRIORITY</th><th>ASSIGNEE</th><th>DUE DATE</th><th aria-label="Actions" /></tr></thead><tbody>{filteredTasks.map((task) => { const assignee = board.members.find((member) => member.id === task.assigneeId); return <tr key={task.id} onClick={() => setActiveTask(task)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") setActiveTask(task); }}><td><strong>{task.title}</strong><small>{task.tags.join(" · ")}</small></td><td><span className={`table-status status-${task.status}`}><i />{columnLabels[task.status]}</span></td><td><span className={`priority-mark priority-${task.priority}`}><i />{priorityLabels[task.priority]}</span></td><td><span className="table-assignee"><Avatar member={assignee} size="tiny" />{assignee?.name || "Unassigned"}</span></td><td><span className={`task-due ${dateTone(task.dueDate, task.status)}`}><CalendarDays size={13} />{displayDate(task.dueDate)}</span></td><td><button className="icon-quiet" type="button" aria-label={`Edit ${task.title}`} onClick={(event) => { event.stopPropagation(); setActiveTask(task); }}><ChevronRight size={16} /></button></td></tr>; })}</tbody></table></div>}
          {board && filteredTasks.length === 0 && <div className="no-results"><Search size={20} /><strong>No matching tasks</strong><span>Try adjusting your search or filters.</span><button type="button" onClick={() => { setSearch(""); setAssigneeFilter("all"); setPriorityFilter("all"); }}>Clear filters</button></div>}
          <footer className="board-footer"><span><GripVertical size={13} /> Drag tasks to update their status</span><span>LAST UPDATED JUST NOW <i /> <CheckCircle2 size={13} /> ALL CHANGES SYNCED</span></footer>
        </div>
      </main>

      {activeTask && board && <TaskDialog key={activeTask.id || `new-${activeTask.status}`} task={activeTask.id ? board.tasks.find((task) => task.id === activeTask.id) || activeTask : activeTask} members={board.members} onClose={() => setActiveTask(null)} onSave={saveTask} onDelete={deleteTask} />}
      {profileOpen && <ProfileDialog name={name} onClose={() => setProfileOpen(false)} onSave={saveProfile} />}
    </div>
  );
}