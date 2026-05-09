import { useState, useEffect } from "react";
import { api } from "../api";
import { IconPlus, IconUsers, IconTasks, IconCalendar } from "./Icons";
import Modal from "./Modal";

export default function Projects({ onSelectProject, isActive }) {
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [hasDeadline, setHasDeadline] = useState(false);
  const [formError, setFormError] = useState("");
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isActive) {
      loadProjects();
    }
  }, [isActive]);

  const loadProjects = async () => {
    try {
      if (projects.length === 0) setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      setFormError("Project name is required");
      return;
    }
    // Check duplicate name
    if (projects.some(p => p.name.toLowerCase() === newName.trim().toLowerCase())) {
      setFormError("A project with this name already exists");
      return;
    }
    try {
      await api.createProject({
        name: newName.trim(),
        description: newDesc,
        deadline: hasDeadline && newDeadline ? newDeadline : null
      });
      setShowModal(false);
      setNewName("");
      setNewDesc("");
      setNewDeadline("");
      setHasDeadline(false);
      setFormError("");
      loadProjects();
    } catch (err) {
      setFormError(err.message);
    }
  };

  if (loading) return <div className="empty-state">Loading projects...</div>;

  return (
    <div className="animate-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Projects</h1>
          <p>Manage and track all your team projects</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <IconPlus style={{ width: 16, height: 16 }} /> New Project
        </button>
      </div>

      <div className="projects-grid">
        {projects.map((project) => {
          return (
            <div className="project-card" key={project.id} onClick={() => onSelectProject(project.id)}>
              <div className="project-card-header">
                <div className="project-card-title">{project.name}</div>
                <span className={`badge ${project.role === "admin" ? "badge-review" : "badge-todo"}`}>
                  {project.role === "admin" ? "Admin" : "Member"}
                </span>
              </div>
              <div className="project-card-desc">{project.description}</div>
              <div style={{ fontSize: "0.75rem", color: project.deadline ? "var(--danger)" : "var(--gray-400)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                <IconCalendar style={{ width: 12, height: 12 }} />
                {project.deadline ? `Due: ${project.deadline.split("T")[0]}` : "No deadline"}
              </div>
              <div className="project-card-meta">
                <span><IconTasks style={{ width: 14, height: 14 }} /> Open</span>
              </div>
            </div>
          );
        })}
        {projects.length === 0 && <div className="empty-state" style={{ gridColumn: "1 / -1" }}>No projects yet.</div>}
      </div>

      {showModal && (
        <Modal title="Create New Project" onClose={() => setShowModal(false)}>
          <div className="form-group">
            <label>Project Name</label>
            <input className="input-field" placeholder="e.g. Website Redesign" value={newName} onChange={(e) => { setNewName(e.target.value); setFormError(""); }} />
            {formError && <p style={{ color: "#dc2626", fontSize: "0.75rem", marginTop: 4 }}>{formError}</p>}
          </div>
          <div className="form-group">
            <label>Description</label>
            <input className="input-field" placeholder="Brief project description..." value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          </div>
          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <input 
              type="checkbox" 
              id="hasDeadline" 
              checked={hasDeadline} 
              onChange={(e) => setHasDeadline(e.target.checked)} 
              style={{ width: 16, height: 16 }}
            />
            <label htmlFor="hasDeadline" style={{ marginBottom: 0, cursor: "pointer" }}>Set Project Deadline</label>
          </div>
          {hasDeadline && (
            <div className="form-group animate-in">
              <label>Deadline Date</label>
              <input type="date" className="input-field" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
            </div>
          )}
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={handleCreate} disabled={!newName.trim()}>
            Create Project
          </button>
        </Modal>
      )}
    </div>
  );
}
