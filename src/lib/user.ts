"use client";

export interface StoredUser {
  id: string;
  username: string;
  points: number;
}

const KEY = "busTrackerUser";

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser): void {
  localStorage.setItem(KEY, JSON.stringify(user));
}

export function updateStoredPoints(points: number): void {
  const user = getStoredUser();
  if (user) setStoredUser({ ...user, points });
}

export async function registerUser(username: string): Promise<StoredUser> {
  const res = await fetch("/api/user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Failed to register");
  }
  const user = await res.json();
  setStoredUser(user);
  return user;
}
