import { useState, useEffect } from "react";
import { api } from "../api";

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

export default function Invitations({ onNavigate, isActive }) {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isActive) {
      loadInvitations();
    }
  }, [isActive]);

  const loadInvitations = async () => {
    try {
      if (invitations.length === 0) setLoading(true);
      const data = await api.getMyInvitations();
      setInvitations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id) => {
    try {
      const result = await api.acceptInvitation(id);
      alert(`Joined project "${result.project_name}" successfully!`);
      loadInvitations();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDecline = async (id) => {
    if (!window.confirm("Decline this invitation?")) return;
    try {
      await api.declineInvitation(id);
      loadInvitations();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="empty-state">Loading invitations...</div>;

  return (
    <div className="animate-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>Invitations</h1>
          <p>Pending project invitations</p>
        </div>
      </div>

      {invitations.length === 0 ? (
        <div className="table-container">
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-state-icon">✉️</div>
            <h3>No pending invitations</h3>
            <p>When someone invites you to a project, it will appear here.</p>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Invited By</th>
                <th>When</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inv.project?.name || "Unknown"}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--gray-400)" }}>
                      {inv.project?.description || ""}
                    </div>
                  </td>
                  <td style={{ fontSize: "0.82rem" }}>
                    {inv.invited_by?.full_name || "Unknown"}
                    <div style={{ fontSize: "0.72rem", color: "var(--gray-400)" }}>
                      {inv.invited_by?.email}
                    </div>
                  </td>
                  <td style={{ fontSize: "0.82rem", color: "var(--gray-500)" }}>
                    {timeAgo(inv.created_at)}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleAccept(inv.id)}
                      >
                        Accept
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDecline(inv.id)}
                      >
                        Decline
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
