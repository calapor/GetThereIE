"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/user";
import LeaderboardTable from "@/components/LeaderboardTable";

interface LeaderboardUser {
  id: string;
  position: number;
  username: string;
  points: number;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getStoredUser();
    if (user) setMyId(user.id);

    const url = user ? `/api/leaderboard?userId=${user.id}` : "/api/leaderboard";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users ?? []);
        setMyRank(data.myRank);
        setTotal(data.total);
      })
      .finally(() => setLoading(false));
  }, []);

  const myPoints = users.find((u) => u.id === myId)?.points;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-blue-600 text-sm font-medium">
          ← Back
        </button>
        <div className="text-sm font-semibold text-blue-600">
          {myPoints !== undefined && myRank !== null && total !== null ? (
            <>
              {myPoints} Points — {myRank}{ordinal(myRank)} out of {total}
            </>
          ) : null}
        </div>
        <div className="w-10" />
      </header>

      <div className="px-4 py-4">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Leaderboard</h2>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <LeaderboardTable users={users} myId={myId} />
        )}
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
