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
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500">Position</th>
            <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500">Username</th>
            <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500">Points</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isMe = user.id === myId;
            return (
              <tr
                key={user.id}
                className={`border-b border-gray-100 last:border-0 ${
                  isMe ? "bg-blue-100 font-semibold" : ""
                }`}
              >
                <td className="py-2.5 px-3 text-sm">{user.position}</td>
                <td className="py-2.5 px-3 text-sm">{user.username}</td>
                <td className="py-2.5 px-3 text-sm text-right">{user.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
