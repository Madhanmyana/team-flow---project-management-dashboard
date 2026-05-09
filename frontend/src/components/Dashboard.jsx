import { useState, useEffect } from "react";
import { api } from "../api";
import { IconProjects, IconTasks, IconClock, IconAlert, IconTrending } from "./Icons";
import StatusBadge from "./StatusBadge";

const AVATAR_COLORS = ["#171717", "#404040", "#525252", "#262626", "#737373", "#171717", "#404040"];
function getAvatarColor(id) {
  const sum = String(id).split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function Dashboard({ onNavigate, isActive }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalProjects: 0, totalTasks: 0, inProgress: 0, overdue: 0, todo: 0, review: 0, done: 0 });
  const [recentTasks, setRecentTasks] = useState([]);
  const [overdueTasksList, setOverdueTasksList] = useState([]);
  const [activity, setActivity] = useState([]);
  const [projects, setProjects] = useState([]);
  const [allTasks, setAllTasks] = useState([]);

  useEffect(() => {
    if (isActive) {
      loadDashboard();
    }
  }, [isActive]);

  const loadDashboard = async () => {
    try {
      // Only show hard loading state if we have no data
      if (projects.length === 0) setLoading(true);
      const { projects: projectsData, tasks, activity: activityData } = await api.getDashboardSummary();
      
      setProjects(projectsData);
      setAllTasks(tasks);
      setActivity(activityData);

      const today = new Date().toISOString().split("T")[0];

      setStats({
        totalProjects: projectsData.length,
        totalTasks: tasks.length,
        inProgress: tasks.filter(t => t.status === "In Progress").length,
        overdue: tasks.filter(t => t.status !== "Done" && t.due_date && t.due_date.split("T")[0] < today).length,
        todo: tasks.filter(t => t.status === "To Do").length,
        review: tasks.filter(t => t.status === "Review").length,
        done: tasks.filter(t => t.status === "Done").length,
      });

      const sortedTasks = [...tasks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setRecentTasks(sortedTasks.slice(0, 5));

      setOverdueTasksList(tasks.filter(t => t.status !== "Done" && t.due_date && t.due_date.split("T")[0] < today));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Compute project health — only for projects with deadlines
  const projectHealth = projects
    .filter(p => p.deadline)
    .map((p) => {
      const projectTasks = allTasks.filter(t => t.project_id === p.id);
      const total = projectTasks.length;
      const done = projectTasks.filter(t => t.status === "Done").length;
      const score = total > 0 ? Math.round((done / total) * 100) : 0;
      const daysLeft = Math.ceil((new Date(p.deadline) - Date.now()) / 86400000);
      return { name: p.name, score, total, done, daysLeft };
    });

  // Compute weekly productivity (tasks created/completed per day of week)
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyData = weekDays.map((day, i) => {
    const created = allTasks.filter(t => {
      const d = new Date(t.created_at);
      return ((d.getDay() + 6) % 7) === i; // Mon=0
    }).length;
    const completed = allTasks.filter(t => {
      if (t.status !== "Done" || !t.updated_at) return false;
      const d = new Date(t.updated_at);
      return ((d.getDay() + 6) % 7) === i;
    }).length;
    return { day, created, completed };
  });
  const maxBar = Math.max(1, ...weeklyData.map(d => Math.max(d.created, d.completed)));

  const statCards = [
    { label: "Total Projects", value: stats.totalProjects, icon: <IconProjects />, variant: "accent", trend: "All active" },
    { label: "Total Tasks", value: stats.totalTasks, icon: <IconTasks />, variant: "success", trend: `${stats.done} completed` },
    { label: "In Progress", value: stats.inProgress, icon: <IconClock />, variant: "warning", trend: "Active now" },
    { label: "Overdue", value: stats.overdue, icon: <IconAlert />, variant: "danger", trend: "Needs attention" },
  ];

  const statusData = [
    { label: "To Do", count: stats.todo, color: "#d4d4d4" },
    { label: "In Progress", count: stats.inProgress, color: "#737373" },
    { label: "Review", count: stats.review, color: "#404040" },
    { label: "Done", count: stats.done, color: "#171717" },
  ];
  const totalForChart = stats.totalTasks || 1;

  // Activity action labels
  const actionLabels = {
    project_created: "created project",
    task_created: "created task",
    status_changed: "updated status on",
    task_deleted: "deleted task",
    member_added: "added member",
    invitation_sent: "invited",
    member_joined: "joined project",
  };

  if (loading) return <div className="empty-state">Loading dashboard...</div>;

  return (
    <div className="animate-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Dashboard</h1>
          <p>Overview of your projects and tasks</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        {statCards.map((card) => (
          <div className={`stat-card ${card.variant}`} key={card.label}>
            <div className="stat-card-icon">{card.icon}</div>
            <div className="stat-card-value">{card.value}</div>
            <div className="stat-card-label">{card.label}</div>
            <div className="stat-card-trend">
              <IconTrending style={{ width: 12, height: 12 }} />
              {card.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Full-width Task Distribution */}
      <div className="table-container" style={{ marginBottom: 20 }}>
        <div className="table-header">
          <h3>Task Distribution</h3>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 30 }}>
          <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", background: "#e5e5e5", flex: 1 }}>
            {statusData.map((s) => (
              <div
                key={s.label}
                style={{
                  width: `${(s.count / totalForChart) * 100}%`,
                  background: s.color,
                  transition: "width 0.5s ease",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 24, flexShrink: 0, flexWrap: "wrap" }}>
            {statusData.map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                <span style={{ fontSize: "0.82rem", color: "#737373" }}>{s.label}</span>
                <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3-column: Weekly Productivity | Project Health | Task Activity */}
      <div className="content-grid-3">
        {/* Weekly Productivity */}
        <div className="table-container" style={{ display: "flex", flexDirection: "column" }}>
          <div className="table-header">
            <h3>Weekly Productivity</h3>
          </div>
          <div style={{ padding: "14px", flex: 1, display: "flex", flexDirection: "column" }}>
            <div className="bar-chart-wrapper" style={{ flex: 1 }}>
              <div className="bar-chart">
                {weeklyData.map((d) => (
                  <div key={d.day} className="bar-chart-col">
                    <div className="bar-group">
                      <div
                        className="bar"
                        style={{ height: `${(d.created / maxBar) * 80}px`, background: "#d4d4d4" }}
                        title={`Created: ${d.created}`}
                      />
                      <div
                        className="bar"
                        style={{ height: `${(d.completed / maxBar) * 80}px`, background: "#171717" }}
                        title={`Completed: ${d.completed}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="bar-chart-labels">
                {weekDays.map((day) => (
                  <span key={day} className="bar-label">{day}</span>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.72rem", color: "#737373" }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: "#d4d4d4" }} /> Created
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.72rem", color: "#737373" }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: "#171717" }} /> Done
              </div>
            </div>
          </div>
        </div>

        {/* Project Health */}
        <div className="table-container">
          <div className="table-header">
            <h3>Project Health</h3>
          </div>
          <div className="health-list">
            {projectHealth.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>
                <p>No projects with deadlines</p>
              </div>
            ) : (
              projectHealth.map((p) => (
                <div key={p.name} className="health-item">
                  <span className="health-name">{p.name}</span>
                  <div className="health-bar-wrap">
                    <div className="health-bar-fill" style={{ width: `${p.score}%` }} />
                  </div>
                  <span className="health-score" style={{ color: p.daysLeft < 0 ? "var(--danger)" : undefined }}>
                    {p.daysLeft < 0 ? "Overdue" : `${p.daysLeft}d left`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Task Activity */}
        <div className="table-container">
          <div className="table-header">
            <h3>Task Activity</h3>
          </div>
          <div className="activity-feed">
            {activity.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>
                <p>No activity yet</p>
              </div>
            ) : (
              activity.slice(0, 8).map((a) => (
                <div key={a.id} className="activity-item">
                  <div className="activity-dot" />
                  <div className="activity-body">
                    <div className="activity-text">
                      <strong>{a.user?.full_name || "Someone"}</strong>{" "}
                      {actionLabels[a.action_type] || a.action_type}{" "}
                      <strong>{a.target}</strong>
                      {a.detail && <span style={{ color: "var(--gray-400)" }}> — {a.detail}</span>}
                    </div>
                    <div className="activity-meta">
                      <span>{timeAgo(a.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="content-grid">
        {/* Overdue Tasks */}
        <div className="table-container" style={{ display: "flex", flexDirection: "column" }}>
          <div className="table-header">
            <h3>⚠ Overdue Tasks</h3>
            <span className="badge badge-overdue">{overdueTasksList.length} tasks</span>
          </div>
          {overdueTasksList.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <p>No overdue tasks! 🎉</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Due Date</th>
                  <th>Assignee</th>
                </tr>
              </thead>
              <tbody>
                {overdueTasksList.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{task.title}</div>
                    </td>
                    <td style={{ fontWeight: 700, fontSize: "0.82rem" }}>{task.due_date ? task.due_date.split("T")[0] : "-"}</td>
                    <td>
                      {task.assignee ? (
                        <div className="table-user">
                          <div className="table-avatar" style={{ background: getAvatarColor(task.assignee_id) }}>
                            {task.assignee.full_name.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <span style={{ fontSize: "0.82rem" }}>{task.assignee.full_name}</span>
                        </div>
                      ) : <span style={{ fontSize: "0.82rem", color: "var(--gray-400)" }}>Unassigned</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Tasks */}
        <div className="table-container" style={{ display: "flex", flexDirection: "column" }}>
          <div className="table-header">
            <h3>Recent Tasks</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate("projects")}>
              View All
            </button>
          </div>
          {recentTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <p>No tasks yet — create a project to get started!</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Assignee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((task) => (
                  <tr key={task.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{task.title}</div>
                    </td>
                    <td>
                      {task.assignee ? (
                        <div className="table-user">
                          <div className="table-avatar" style={{ background: getAvatarColor(task.assignee_id) }}>
                            {task.assignee.full_name.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <span style={{ fontSize: "0.82rem" }}>{task.assignee.full_name}</span>
                        </div>
                      ) : <span style={{ fontSize: "0.82rem", color: "var(--gray-400)" }}>Unassigned</span>}
                    </td>
                    <td><StatusBadge status={task.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
