"use client";

import { useState } from "react";
import { registerUser } from "@/lib/user";

interface Props {
  onDone: () => void;
}

export default function UsernamePrompt({ onDone }: Props) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError("");
    try {
      await registerUser(username.trim());
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-50 px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">Bus Tracker</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Choose a username to track points &amp; compete on the leaderboard</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your username"
            maxLength={20}
            className="border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="bg-blue-600 text-white rounded-lg py-3 font-semibold text-base disabled:opacity-50"
          >
            {loading ? "Setting up…" : "Get Started"}
          </button>
        </form>
      </div>
    </div>
  );
}
