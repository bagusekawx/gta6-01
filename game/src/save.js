// Save / load through localStorage. The save holds the player's progress
// (money, missions, position) so Continue on the title screen picks up
// where the last session left off. Nothing here touches the network.
const KEY = 'solmar-bay-save-v1';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function saveGame(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
