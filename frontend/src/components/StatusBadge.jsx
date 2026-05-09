const CLASS_MAP = {
  "To Do": "badge-todo",
  "In Progress": "badge-progress",
  "Review": "badge-review",
  "Done": "badge-done",
  "Overdue": "badge-overdue",
};

export default function StatusBadge({ status }) {
  return <span className={`badge ${CLASS_MAP[status] || "badge-todo"}`}>{status}</span>;
}
