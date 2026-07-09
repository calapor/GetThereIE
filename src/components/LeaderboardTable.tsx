"use client";

interface User {
  id: string;
  position: number;
  username: string;
  points: number;
}

interface Props {
  users: User[];
  myId: string | null;
}

export default function LeaderboardTable({ users, myId }: Props) {
  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--background)]">
            <th className="py-2.5 px-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Position</th>
            <th className="py-2.5 px-3 text-left text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Username</th>
            <th className="py-2.5 px-3 text-right text-xs font-semibold text-[var(--muted)] uppercase tracking-wider">Points</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isMe = user.id === myId;
            const medal = user.position === 1 ? "🥇" : user.position === 2 ? "🥈" : user.position === 3 ? "🥉" : null;
            return (
              <tr
                key={user.id}
                className={`border-b border-[var(--border)] last:border-0 transition-colors ${
                  isMe ? "bg-[var(--primary-tint)] font-semibold" : "hover:bg-[var(--background)]"
                }`}
              >
                <td className="py-3 px-3 text-sm tabular-nums text-[var(--foreground)]">
                  {medal ?? user.position}
                </td>
                <td className="py-3 px-3 text-sm text-[var(--foreground)]">{user.username}</td>
                <td className="py-3 px-3 text-sm text-right font-semibold tabular-nums text-[var(--foreground)]">{user.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
