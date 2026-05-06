const API_BASE = import.meta.env.VITE_API_URL;

export async function fetchEmails() {
  const response = await fetch(`${API_BASE}/emails`);

  if (!response.ok) {
    throw new Error("Failed to fetch emails");
  }

  return response.json();
}
