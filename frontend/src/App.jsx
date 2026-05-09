import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import Projects from "./components/Projects";
import ProjectDetail from "./components/ProjectDetail";
import Invitations from "./components/Invitations";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem("token"));
  const [page, setPage] = useState("dashboard");
  const [selectedProject, setSelectedProject] = useState(null);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    setLoggedIn(false);
    window.location.reload();
  };

  if (!loggedIn) {
    return <Auth onLogin={() => setLoggedIn(true)} />;
  }

  const handleNavigate = (p) => {
    setPage(p);
    setSelectedProject(null);
  };

  const handleSelectProject = (projectId) => {
    setSelectedProject(projectId);
    setPage("project-detail");
  };

  return (
    <div className="app-layout">
      <Sidebar currentPage={page} onNavigate={handleNavigate} onLogout={handleLogout} />
      <main className="main-content">
        <div style={{ display: page === "dashboard" ? "block" : "none", height: "100%" }}>
          <Dashboard onNavigate={handleNavigate} isActive={page === "dashboard"} />
        </div>
        <div style={{ display: page === "projects" ? "block" : "none", height: "100%" }}>
          <Projects onSelectProject={handleSelectProject} isActive={page === "projects"} />
        </div>
        <div style={{ display: page === "invitations" ? "block" : "none", height: "100%" }}>
          <Invitations onNavigate={handleNavigate} isActive={page === "invitations"} />
        </div>
        {selectedProject && (
          <div style={{ display: page === "project-detail" ? "block" : "none", height: "100%" }}>
            <ProjectDetail projectId={selectedProject} onBack={() => handleNavigate("projects")} isActive={page === "project-detail"} />
          </div>
        )}
      </main>
    </div>
  );
}
