// Which Luas arrivals board to render. Two styles were built so the look can be
// chosen by eye — set this, then delete the unused component + branch:
//   "dedicated" → LuasBoard.tsx (Inbound / Outbound columns, like platform signs)
//   "reuse"     → the shared bus RouteCard board with a tram icon + line colour
export const LUAS_BOARD_STYLE: "dedicated" | "reuse" = "dedicated";
