// Server/src/sockets/rooms.util.ts
export function auctionRoomName(id: number | string): string {
  const n = Number(id);
  const isPositive = Number.isFinite(n) && n > 0;

  let key = String(id).trim();
  if (isPositive) {
    key = String(n);
  }

  return `auction:${key}`;
}
