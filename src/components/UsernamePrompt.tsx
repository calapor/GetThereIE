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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[var(--background)] to-[var(--primary)]/5 px-6 animate-fade-in">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl mb-2">🚌</div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Bus Tracker</h1>
          <p className="text-sm text-[var(--muted)] leading-relaxed">Join the community and track your progress on the leaderboard</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose your username"
              maxLength={20}
              className="w-full border border-[var(--border)] bg-[var(--card)] rounded-lg px-4 py-3.5 text-base text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
              autoFocus
            />
            <p className="text-xs text-[var(--muted)]">{username.length}/20 characters</p>
          </div>
          
          {error && (
            <div className="p-3 bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 rounded-lg">
              <p className="text-sm text-[var(--destructive)]">{error}</p>
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="w-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white rounded-lg py-3.5 font-semibold text-base transition-colors disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
          >
            {loading ? "Setting up…" : "Get Started"}
          </button>
        </form>
      </div>
    </div>
  );
}
