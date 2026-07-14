// Shared ranking helpers so admin + results never drift out of sync.

// Firestore Timestamp -> millis (0 if missing / not yet resolved).
export const tsToMillis = (t) =>
  t && typeof t.toMillis === 'function' ? t.toMillis() : 0;

// More votes first; on a tie, the entry created earlier wins.
// Deterministic, so the same ranking shows everywhere.
export const rankSort = (a, b) => {
  const dv = (b.votes || 0) - (a.votes || 0);
  if (dv !== 0) return dv;
  return tsToMillis(a.createdAt) - tsToMillis(b.createdAt);
};
