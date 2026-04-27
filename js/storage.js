const KEY = 'packraft-expedition-v2';

export const storage = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || null;
    } catch {
      return null;
    }
  },
  save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  },
};

export const defaultState = () => ({
  trips: [{ id: crypto.randomUUID(), name: 'Main trip', route: { points: [], segments: [] }, gear: [], notes: [], weather: null }],
  activeTripId: null,
});

export function getActiveTrip(state) {
  return state.trips.find((t) => t.id === state.activeTripId) || state.trips[0];
}
