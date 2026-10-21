export function todayString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export type DueState = "overdue" | "today" | "upcoming";

export function dueState(dueDate: string | null, done: boolean): DueState | null {
  if (!dueDate) return null;
  if (done) return "upcoming";
  const due = dueDate.slice(0, 10);
  const today = todayString();
  if (due < today) return "overdue";
  if (due === today) return "today";
  return "upcoming";
}

export function formatDue(dueDate: string) {
  return new Date(`${dueDate.slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}