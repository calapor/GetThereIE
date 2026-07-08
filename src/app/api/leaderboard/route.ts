import { NextRequest, NextResponse } from "next/server";

// Dummy leaderboard data
const dummyLeaderboard = [
  { id: "user_1", username: "BusNinja", points: 2450 },
  { id: "user_2", username: "RouteExplorer", points: 2320 },
  { id: "user_3", username: "StopWatcher", points: 2180 },
  { id: "user_4", username: "FastTracker", points: 1950 },
  { id: "user_5", username: "DailyCommuter", points: 1840 },
  { id: "user_6", username: "IrelandRider", points: 1720 },
  { id: "user_7", username: "TransitPro", points: 1650 },
  { id: "user_8", username: "BusCollector", points: 1520 },
  { id: "user_9", username: "JourneyTracker", points: 1430 },
  { id: "user_10", username: "UrbanExplorer", points: 1290 },
];

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");

  const ranked = dummyLeaderboard.map((u, i) => ({ position: i + 1, ...u }));

  let myRank: number | null = null;
  if (userId) {
    const userIndex = dummyLeaderboard.findIndex((u) => u.id === userId);
    myRank = userIndex >= 0 ? userIndex + 1 : Math.floor(Math.random() * 500) + 11;
  }

  const total = 1500; // Dummy total user count

  return NextResponse.json({ users: ranked, myRank, total });
}
