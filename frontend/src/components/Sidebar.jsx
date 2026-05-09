import { useState, useEffect } from "react";
import { api } from "../api";
import { IconDashboard, IconProjects, IconLogout } from "./Icons";
import Logo from "./Logo";

const AVATAR_COLORS = ["#171717", "#404040", "#525252", "#262626", "#737373", "#171717", "#404040"];
function getAvatarColor(id) {
  const sum = String(id).split("").reduce((a, b) => a + b.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

// Inline mail icon for Invitations
function IconMail(props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

export default function Sidebar({ currentPage, onNavigate, onLogout }) {
  const [inviteCount, setInviteCount] = useState(0);

  useEffect(() => {
    const loadCount = async () => {
      try {
        const invites = await api.getMyInvitations();
        setInviteCount(invites.length);
      } catch { setInviteCount(0); }
    };
    loadCount();
    // Poll every 30s for new invitations
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: <IconDashboard /> },
    { id: "projects", label: "Projects", icon: <IconProjects /> },
    { id: "invitations", label: "Invitations", icon: <IconMail />, badge: inviteCount },
  ];

  const email = localStorage.getItem("userEmail") || "User";
  const name = email.split("@")[0];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Logo size={32} />
        <span className="sidebar-logo-text">TeamFlow</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-link ${currentPage === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon}
            {item.label}
            {item.badge > 0 && (
              <span className="invite-badge">{item.badge}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-avatar" style={{ background: getAvatarColor(email) }}>
          {name.substring(0, 1).toUpperCase()}
        </div>
        <div className="sidebar-user-info" style={{ flex: 1, minWidth: 0 }}>
          <div className="sidebar-user-name">{name}</div>
          <div className="sidebar-user-email">{email}</div>
        </div>
      </div>
      <button className="sidebar-link" style={{ color: "var(--gray-500)", marginBottom: 4 }} onClick={() => {
        localStorage.clear();
        window.location.href = "/";
      }}>
        <IconLogout />
        Log out
      </button>
    </aside>
  );
}
