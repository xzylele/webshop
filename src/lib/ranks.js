export const RANKS = [
  { name: 'Member', minSpent: 0, discountPercent: 0, color: 'text-zinc-400 border-zinc-700 bg-zinc-800/40', badge: 'MEMBER' },
  { name: 'Bronze VIP', minSpent: 1000, discountPercent: 1.5, color: 'text-amber-600 border-amber-600/30 bg-amber-500/10', badge: 'BRONZE VIP' },
  { name: 'Silver VIP', minSpent: 5000, discountPercent: 3.0, color: 'text-teal-400 border-teal-500/20 bg-teal-500/10', badge: 'SILVER VIP' },
  { name: 'Gold VIP', minSpent: 15000, discountPercent: 5.0, color: 'text-yellow-400 border-yellow-500/20 bg-yellow-500/10', badge: 'GOLD VIP' },
  { name: 'Platinum VIP', minSpent: 50000, discountPercent: 7.5, color: 'text-purple-400 border-purple-500/20 bg-purple-500/10 font-bold', badge: 'PLATINUM VIP' },
];

export function getUserRank(totalSpent) {
  const spentVal = Number(totalSpent) || 0;
  let activeRank = RANKS[0];
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (spentVal >= RANKS[i].minSpent) {
      activeRank = RANKS[i];
      break;
    }
  }
  return activeRank;
}
