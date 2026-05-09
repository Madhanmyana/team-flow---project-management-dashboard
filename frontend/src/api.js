const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse(response) {
  if (!response.ok) {
    if (response.status === 401) {
      // Don't reload on auth pages — only if already logged in
      if (localStorage.getItem("token")) {
        localStorage.removeItem("token");
        window.location.reload();
      }
    }
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Something went wrong");
  }
  return response.json();
}

export const api = {
  // --- Auth ---
  signup: async (full_name, email, password) => {
    const response = await fetch(`${API_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name, email, password }),
    });
    return handleResponse(response);
  },

  signin: async (email, password) => {
    const response = await fetch(`${API_URL}/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
  },

  getMe: async () => {
    const response = await fetch(`${API_URL}/auth/me`, { headers: getHeaders() });
    return handleResponse(response);
  },

  // --- Projects ---
  getProjects: async () => {
    const response = await fetch(`${API_URL}/projects`, { headers: getHeaders() });
    return handleResponse(response);
  },

  getProject: async (projectId) => {
    const response = await fetch(`${API_URL}/projects/${projectId}`, { headers: getHeaders() });
    return handleResponse(response);
  },

  getProjectMembers: async (projectId) => {
    const response = await fetch(`${API_URL}/projects/${projectId}/members`, { headers: getHeaders() });
    return handleResponse(response);
  },

  createProject: async (projectData) => {
    const response = await fetch(`${API_URL}/projects`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(projectData),
    });
    return handleResponse(response);
  },

  // --- Tasks ---
  getTasks: async (projectId) => {
    const response = await fetch(`${API_URL}/projects/${projectId}/tasks`, { headers: getHeaders() });
    return handleResponse(response);
  },

  createTask: async (projectId, taskData) => {
    const response = await fetch(`${API_URL}/projects/${projectId}/tasks`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(taskData),
    });
    return handleResponse(response);
  },

  updateTask: async (projectId, taskId, updates) => {
    const response = await fetch(`${API_URL}/projects/${projectId}/tasks/${taskId}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
  },

  deleteTask: async (projectId, taskId) => {
    const response = await fetch(`${API_URL}/projects/${projectId}/tasks/${taskId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  // --- Members ---
  addProjectMember: async (projectId, memberData) => {
    const response = await fetch(`${API_URL}/projects/${projectId}/members`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(memberData),
    });
    return handleResponse(response);
  },

  removeProjectMember: async (projectId, userId) => {
    const response = await fetch(`${API_URL}/projects/${projectId}/members/${userId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  // --- Activity ---
  getRecentActivity: async () => {
    const response = await fetch(`${API_URL}/activity`, { headers: getHeaders() });
    return handleResponse(response);
  },

  getProjectActivity: async (projectId) => {
    const response = await fetch(`${API_URL}/projects/${projectId}/activity`, { headers: getHeaders() });
    return handleResponse(response);
  },

  getDashboardSummary: async () => {
    const response = await fetch(`${API_URL}/dashboard/summary`, { headers: getHeaders() });
    return handleResponse(response);
  },

  // --- Invitations ---
  getMyInvitations: async () => {
    const response = await fetch(`${API_URL}/invitations`, { headers: getHeaders() });
    return handleResponse(response);
  },

  getProjectInvitations: async (projectId) => {
    const response = await fetch(`${API_URL}/projects/${projectId}/invitations`, { headers: getHeaders() });
    return handleResponse(response);
  },

  acceptInvitation: async (invitationId) => {
    const response = await fetch(`${API_URL}/invitations/${invitationId}/accept`, {
      method: "POST",
      headers: getHeaders(),
    });
    return handleResponse(response);
  },

  declineInvitation: async (invitationId) => {
    const response = await fetch(`${API_URL}/invitations/${invitationId}/decline`, {
      method: "POST",
      headers: getHeaders(),
    });
    return handleResponse(response);
  },
};
