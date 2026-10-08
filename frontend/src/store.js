// "My roadmaps": every roadmap you create is saved in this browser (never on a server).
const LIBRARY_KEY = 'careermap.library.v1'
const OLD_KEY = 'careermap.v1'
const MAX_SAVED = 20

export function loadLibrary() {
  try {
    const list = JSON.parse(localStorage.getItem(LIBRARY_KEY))
    if (Array.isArray(list)) return list.filter((e) => e?.id && e.roadmap?.nodes?.length)
  } catch { /* blocked or damaged storage: start empty */ }
  // Bring over a roadmap saved by the first version of the app.
  try {
    const old = JSON.parse(localStorage.getItem(OLD_KEY))
    if (old?.roadmap?.nodes?.length) {
      return [{ id: newId(), title: old.roadmap.title || old.goal, goal: old.goal, skills: old.skills ?? '', roadmap: old.roadmap,
        known: old.known ?? [], hours: old.hours ?? 8, budget: old.budget ?? '', summary: null, updatedAt: Date.now() }]
    }
  } catch { /* ignore */ }
  return []
}

export function saveLibrary(list) {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(list.slice(0, MAX_SAVED)))
    localStorage.removeItem(OLD_KEY)
  } catch { /* storage full or blocked: the app still works for this visit */ }
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

// Put (or update) an entry at the top of the list.
export function upsert(list, entry) {
  return [entry, ...list.filter((e) => e.id !== entry.id)].slice(0, MAX_SAVED)
}
