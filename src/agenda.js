import { addDays } from "./store.js?v=14"

export function planCalendar(desired, existing, today) {
  const end = addDays(today, 1)
  const ours = existing.filter((event) => event.key)
  const byKey = new Map(ours.map((event) => [event.key, event]))
  const creates = []
  const updates = []
  const wanted = new Set()
  for (const event of desired) {
    wanted.add(event.key)
    const found = byKey.get(event.key)
    const next = {
      key: event.key,
      summary: event.title,
      description: "",
      start: found?.start || event.since,
      end,
    }
    if (!found) {
      creates.push(next)
      continue
    }
    if (found.summary !== next.summary || found.start !== next.start || found.end !== next.end || found.description) {
      updates.push({ ...next, id: found.id })
    }
  }
  const deletes = ours.filter((event) => !wanted.has(event.key))
  return { creates, updates, deletes }
}

export async function applyPlan(plan, api) {
  for (const event of plan.deletes) await api.remove(event.id)
  for (const event of plan.creates) await api.create(event)
  for (const event of plan.updates) await api.update(event)
}
