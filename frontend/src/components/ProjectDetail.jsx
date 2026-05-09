import { useState, useEffect } from "react";
import { api } from "../api";
import { IconBack, IconPlus, IconUsers, IconCalendar } from "./Icons";
import StatusBadge from "./StatusBadge";
import Modal from "./Modal";

const STATUS_OPTIONS = ["To Do", "In Progress", "Review", "Done"];
const STATUS_FLOW = ["To Do", "In Progress", "Review", "Done"];
const PRIORITY_OPTIONS = ["High", "Medium", "Low"];

const AVATAR_COLORS = ["#171717", "#404040", "#525252", "#262626", "#737373", "#171717", "#404040"];
function getAvatarColor(id) {
  const sum = String(id).split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export default function ProjectDetail({ projectId, onBack, isActive }) {
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("tasks");
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState("Medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [pendingInvites, setPendingInvites] = useState([]);

  const userEmail = localStorage.getItem("userEmail");

  useEffect(() => {
    if (isActive && projectId) {
      loadData();
    }
  }, [projectId, isActive]);

  const loadData = async () => {
    try {
      if (!project || project.id !== projectId) {
        setLoading(true);
      }
      const [projData, tasksData, membersData] = await Promise.all([
        api.getProject(projectId),
        api.getTasks(projectId),
        api.getProjectMembers(projectId)
      ]);
      setProject(projData);
      setTasks(tasksData);
      setMembers(membersData);
      // Load pending invitations (admin only — will 403 for members, handled gracefully)
      try {
        const invites = await api.getProjectInvitations(projectId);
        setPendingInvites(invites);
      } catch { setPendingInvites([]); }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const currentUserMember = members.find((m) => m.user.email === userEmail);
  const role = currentUserMember ? currentUserMember.role : null;
  const isAdmin = role === "admin";

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await api.updateTask(projectId, taskId, { status: newStatus });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateTask = async () => {
    try {
      const taskData = {
        title: newTitle,
        description: newDesc || null,
        priority: newPriority,
        due_date: newDueDate || null,
      };
      // Assign: Members self-assign, Admins pick from members
      if (newAssignee) {
        taskData.assignee_id = newAssignee;
      }
      await api.createTask(projectId, taskData);
      setShowTaskModal(false);
      setNewTitle("");
      setNewDesc("");
      setNewPriority("Medium");
      setNewDueDate("");
      setNewAssignee("");
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading || !project) return <div className="empty-state">Loading...</div>;

  return (
    <div className="animate-in">
      <div className="project-detail-header">
        <div className="project-detail-info">
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <button className="btn-icon" onClick={onBack}><IconBack style={{ width: 16, height: 16 }} /></button>
            <h1>{project.name}</h1>
            <span className={`badge ${isAdmin ? "badge-review" : "badge-todo"}`}>{role}</span>
          </div>
          <p>{project.description}</p>
          <div className="project-detail-meta">
            <span><IconUsers style={{ width: 14, height: 14 }} /> {members.length} members</span>
          </div>
        </div>
        <div className="project-detail-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setShowTaskModal(true)}>
            <IconPlus style={{ width: 14, height: 14 }} /> Add Task
          </button>
          {isAdmin && (
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={() => setShowInviteModal(true)}>
              <IconUsers style={{ width: 14, height: 14 }} /> Invite Member
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === "tasks" ? "active" : ""}`} onClick={() => setTab("tasks")}>Tasks ({tasks.length})</button>
        <button className={`tab ${tab === "team" ? "active" : ""}`} onClick={() => setTab("team")}>Team ({members.length})</button>
      </div>

      {tab === "tasks" && (
        <div className="table-container">
          {tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <h3>No tasks yet</h3>
              <p>Create your first task to get started</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Assignee</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const today = new Date().toISOString().split("T")[0];
                  const isOverdue = task.status !== "Done" && task.due_date && task.due_date.split("T")[0] < today;
                  return (
                    <tr key={task.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{task.title}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--gray-400)" }}>{task.description}</div>
                      </td>
                      <td>
                        {task.assignee ? (
                          <div className="table-user">
                            <div className="table-avatar" style={{ background: getAvatarColor(task.assignee_id) }}>
                              {task.assignee.full_name.split(" ").map((n) => n[0]).join("")}
                            </div>
                            <span style={{ fontSize: "0.82rem" }}>{task.assignee.full_name}</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.82rem", color: "var(--gray-400)" }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        <span className={`priority-${task.priority.toLowerCase()}`} style={{ fontSize: "0.82rem", fontWeight: 500 }}>
                          {task.priority}
                        </span>
                      </td>
                      <td>
                        <select
                          className="select-field"
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option
                              key={s}
                              value={s}
                              disabled={
                                !isAdmin &&
                                STATUS_FLOW.indexOf(s) !== STATUS_FLOW.indexOf(task.status) + 1 &&
                                s !== task.status
                              }
                            >
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ fontSize: "0.82rem", color: isOverdue ? "var(--danger)" : "var(--gray-500)" }}>
                        {isOverdue && "⚠ "}{task.due_date ? task.due_date.split("T")[0] : "-"}
                        {isAdmin && (
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ marginLeft: 8, padding: "2px 6px", fontSize: "0.7rem" }}
                            onClick={async () => {
                              if (window.confirm("Delete this task?")) {
                                try {
                                  await api.deleteTask(projectId, task.id);
                                  loadData();
                                } catch (err) {
                                  alert(err.message);
                                }
                              }
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "team" && (
        <div className="table-container">
          <table>
            <thead>
              <tr><th>Member</th><th>Email</th><th>Role</th><th>Action</th></tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td>
                    <div className="table-user">
                      <div className="table-avatar" style={{ background: getAvatarColor(m.user_id) }}>{m.user.full_name.split(" ").map((n) => n[0]).join("")}</div>
                      <span style={{ fontWeight: 500 }}>{m.user.full_name}</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--gray-500)", fontSize: "0.82rem" }}>{m.user.email}</td>
                  <td><span className={`badge ${m.role === "admin" ? "badge-review" : "badge-todo"}`}>{m.role}</span></td>
                  <td>
                    {isAdmin && m.user.email !== userEmail && (
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={async () => {
                          if (window.confirm(`Kick ${m.user.full_name} from project?`)) {
                            try {
                              await api.removeProjectMember(projectId, m.user_id);
                              loadData();
                            } catch (err) {
                              alert(err.message);
                            }
                          }
                        }}
                      >
                        Kick
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pending Invitations */}
          {isAdmin && pendingInvites.length > 0 && (
            <div style={{ borderTop: "1px solid var(--gray-200)", padding: "16px 20px" }}>
              <h4 style={{ fontSize: "0.85rem", marginBottom: 10, color: "var(--gray-600)" }}>Pending Invitations</h4>
              {pendingInvites.map((inv) => (
                <div key={inv.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", fontSize: "0.82rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--gray-400)" }}>⏳</span>
                    <span>{inv.invited_user?.email || "Unknown"}</span>
                  </div>
                  <span className="badge" style={{ background: "#fef3c7", color: "#92400e", fontSize: "0.7rem" }}>Pending</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    {/* Add Task Modal */}
      {showTaskModal && (
        <Modal title="Create New Task" onClose={() => setShowTaskModal(false)}>
          <div className="form-group">
            <label>Task Title</label>
            <input className="input-field" placeholder="e.g. Build login page" value={newTitle} onChange={(e) => { setNewTitle(e.target.value); const el = document.getElementById('taskTitleError'); if (el) el.style.display = 'none'; }} />
            <p id="taskTitleError" style={{ display: "none", color: "#dc2626", fontSize: "0.75rem", marginTop: 4 }}>Task title is required</p>
          </div>
          <div className="form-group">
            <label>Description</label>
            <input className="input-field" placeholder="Brief description..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Priority</label>
            <select className="select-field" style={{ width: "100%" }} value={newPriority} onChange={(e) => setNewPriority(e.target.value)}>
              {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Assign To</label>
            <select className="select-field" style={{ width: "100%" }} value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)}>
              <option value="">Unassigned</option>
              {isAdmin ? (
                members.map((m) => <option key={m.user_id} value={m.user_id}>{m.user.full_name}</option>)
              ) : (
                currentUserMember && <option value={currentUserMember.user_id}>{currentUserMember.user.full_name} (me)</option>
              )}
            </select>
          </div>
          <div className="form-group">
            <label>Due Date</label>
            <input type="date" className="input-field" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => { if (!newTitle.trim()) { document.getElementById('taskTitleError').style.display = 'block'; return; } handleCreateTask(); }} >
            Create Task
          </button>
        </Modal>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <Modal title="Invite Member" onClose={() => setShowInviteModal(false)}>
          <div className="form-group">
            <label>Email</label>
            <input
              className="input-field"
              placeholder="user@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <p style={{ fontSize: "0.72rem", color: "var(--gray-400)", marginTop: 4 }}>User must have a TeamFlow account</p>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={async () => {
              try {
                await api.addProjectMember(projectId, { email: inviteEmail, role: "member" });
                setShowInviteModal(false);
                setInviteEmail("");
                loadData();
              } catch (err) {
                alert(err.message);
              }
            }}
          >
            Send Invitation
          </button>
        </Modal>
      )}

    </div>
  );
}
