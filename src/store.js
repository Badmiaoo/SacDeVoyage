const KEY = "sac-de-voyage"

export function emptyDb() {
  return {
    version: 1,
    items: [],
    bagModels: [],
    bags: [],
    departureModels: [],
    departures: [],
  }
}

export function load(storage = localStorage) {
  const raw = storage.getItem(KEY)
  if (!raw) return emptyDb()
  const data = JSON.parse(raw)
  return { ...emptyDb(), ...data, version: 1 }
}

export function save(db, storage = localStorage) {
  storage.setItem(KEY, JSON.stringify(db))
}

function id() {
  return crypto.randomUUID()
}

function sameName(a, b) {
  return a.trim().toLocaleLowerCase("fr") === b.trim().toLocaleLowerCase("fr")
}

export function todayIso(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function parseIso(iso) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function addDays(iso, days) {
  const date = parseIso(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function weekdayOf(iso) {
  return parseIso(iso).getUTCDay()
}

export function passedWeekday(today, weekday) {
  const delta = (weekdayOf(today) - weekday + 7) % 7
  return addDays(today, delta === 0 ? -7 : -delta)
}

export function nextWeekday(today, weekday) {
  const delta = (weekday - weekdayOf(today) + 7) % 7
  return addDays(today, delta)
}

export function createItem(db, name) {
  const trimmed = name.trim()
  if (!trimmed) return { db, error: "Le nom est vide." }
  if (db.items.some((item) => sameName(item.name, trimmed))) {
    return { db, error: "Ce nom existe déjà." }
  }
  const item = { id: id(), name: trimmed }
  return { db: { ...db, items: [...db.items, item] }, item }
}

export function renameItem(db, itemId, name) {
  const trimmed = name.trim()
  if (!trimmed) return { db, error: "Le nom est vide." }
  if (db.items.some((item) => item.id !== itemId && sameName(item.name, trimmed))) {
    return { db, error: "Ce nom existe déjà." }
  }
  return {
    db: {
      ...db,
      items: db.items.map((item) => (item.id === itemId ? { ...item, name: trimmed } : item)),
    },
  }
}

export function deleteItem(db, itemId) {
  return {
    db: {
      ...db,
      items: db.items.filter((item) => item.id !== itemId),
      bagModels: db.bagModels.map((model) => ({
        ...model,
        lines: model.lines.filter((line) => line.itemId !== itemId),
      })),
      bags: db.bags.map((bag) => ({
        ...bag,
        added: bag.added.filter((line) => line.itemId !== itemId),
        qty: Object.fromEntries(Object.entries(bag.qty).filter(([key]) => key !== itemId)),
        checks: Object.fromEntries(Object.entries(bag.checks).filter(([key]) => key !== itemId)),
      })),
    },
  }
}

export function createBagModel(db, name) {
  const trimmed = name.trim()
  if (!trimmed) return { db, error: "Le nom est vide." }
  const model = { id: id(), name: trimmed, afterUse: "stay", lines: [] }
  return { db: { ...db, bagModels: [...db.bagModels, model] }, model }
}

export function setAfterUse(db, modelId, afterUse) {
  if (!["stay", "all", "marked"].includes(afterUse)) return { db }
  return {
    db: {
      ...db,
      bagModels: db.bagModels.map((model) => (model.id === modelId ? { ...model, afterUse } : model)),
    },
  }
}

export function setModelLine(db, modelId, itemId, qty) {
  if (!db.items.some((item) => item.id === itemId)) return { db }
  const count = Math.max(1, Number(qty) || 1)
  return {
    db: {
      ...db,
      bagModels: db.bagModels.map((model) => {
        if (model.id !== modelId) return model
        const existing = model.lines.find((line) => line.itemId === itemId)
        const lines = existing
          ? model.lines.map((line) => (line.itemId === itemId ? { ...line, qty: count } : line))
          : [...model.lines, { itemId, qty: count, removeAfter: false }]
        return { ...model, lines }
      }),
    },
  }
}

export function setRemoveAfter(db, modelId, itemId, removeAfter) {
  return {
    db: {
      ...db,
      bagModels: db.bagModels.map((model) =>
        model.id === modelId
          ? {
              ...model,
              lines: model.lines.map((line) => (line.itemId === itemId ? { ...line, removeAfter } : line)),
            }
          : model,
      ),
    },
  }
}

export function removeModelLine(db, modelId, itemId) {
  return {
    db: {
      ...db,
      bagModels: db.bagModels.map((model) =>
        model.id === modelId
          ? { ...model, lines: model.lines.filter((line) => line.itemId !== itemId) }
          : model,
      ),
      bags: db.bags.map((bag) => {
        if (bag.modelId !== modelId || bag.added.some((line) => line.itemId === itemId)) return bag
        const qty = { ...bag.qty }
        const checks = { ...bag.checks }
        delete qty[itemId]
        delete checks[itemId]
        return { ...bag, qty, checks }
      }),
    },
  }
}

export function createBag(db, name, modelId) {
  const trimmed = name.trim()
  if (!trimmed) return { db, error: "Le nom est vide." }
  if (!db.bagModels.some((model) => model.id === modelId)) {
    return { db, error: "Le modèle n'existe pas." }
  }
  const bag = {
    id: id(),
    name: trimmed,
    modelId,
    added: [],
    qty: {},
    status: "ready",
    checks: {},
  }
  return { db: { ...db, bags: [...db.bags, bag] }, bag }
}

function renameNamed(list, id, name) {
  const trimmed = String(name || "").trim()
  if (!trimmed) return { error: "Le nom est vide." }
  if (!list.some((entry) => entry.id === id)) return { error: "Introuvable." }
  if (list.some((entry) => entry.id !== id && sameName(entry.name, trimmed))) {
    return { error: "Ce nom existe déjà." }
  }
  return { list: list.map((entry) => (entry.id === id ? { ...entry, name: trimmed } : entry)) }
}

export function renameBag(db, bagId, name) {
  const result = renameNamed(db.bags, bagId, name)
  if (result.error) return { db, error: result.error }
  return { db: { ...db, bags: result.list } }
}

export function renameBagModel(db, modelId, name) {
  const result = renameNamed(db.bagModels, modelId, name)
  if (result.error) return { db, error: result.error }
  return { db: { ...db, bagModels: result.list } }
}

export function renameDeparture(db, departureId, name) {
  const result = renameNamed(db.departures, departureId, name)
  if (result.error) return { db, error: result.error }
  return { db: { ...db, departures: result.list } }
}

export function renameDepartureModel(db, modelId, name) {
  const result = renameNamed(db.departureModels, modelId, name)
  if (result.error) return { db, error: result.error }
  return { db: { ...db, departureModels: result.list } }
}

export function addBagLine(db, bagId, itemId, qty) {
  if (!db.items.some((item) => item.id === itemId)) return { db, error: "L'objet n'existe pas." }
  const count = Math.max(1, Number(qty) || 1)
  return {
    db: {
      ...db,
      bags: db.bags.map((bag) => {
        if (bag.id !== bagId) return bag
        const model = db.bagModels.find((entry) => entry.id === bag.modelId)
        if (model?.lines.some((line) => line.itemId === itemId)) return bag
        if (bag.added.some((line) => line.itemId === itemId)) {
          return {
            ...bag,
            added: bag.added.map((line) => (line.itemId === itemId ? { ...line, qty: count } : line)),
          }
        }
        return { ...bag, added: [...bag.added, { itemId, qty: count, removeAfter: false }] }
      }),
    },
  }
}

export function removeBagLine(db, bagId, itemId) {
  const bag = db.bags.find((entry) => entry.id === bagId)
  if (!bag) return { db, error: "Introuvable." }
  const model = db.bagModels.find((entry) => entry.id === bag.modelId)
  if (model?.lines.some((line) => line.itemId === itemId)) return { db, error: "Ça vient du modèle." }
  if (!bag.added.some((line) => line.itemId === itemId)) return { db }
  return {
    db: {
      ...db,
      bags: db.bags.map((entry) => {
        if (entry.id !== bagId) return entry
        const qty = { ...entry.qty }
        const checks = { ...entry.checks }
        delete qty[itemId]
        delete checks[itemId]
        return {
          ...entry,
          added: entry.added.filter((line) => line.itemId !== itemId),
          qty,
          checks,
        }
      }),
    },
  }
}

export function excludeBagLine(db, bagId, itemId) {
  const bag = db.bags.find((entry) => entry.id === bagId)
  if (!bag) return { db, error: "Introuvable." }
  const model = db.bagModels.find((entry) => entry.id === bag.modelId)
  if (!model?.lines.some((line) => line.itemId === itemId)) return { db, error: "Ça ne vient pas du modèle." }
  const excluded = bag.excluded || []
  if (excluded.includes(itemId)) return { db }
  return {
    db: {
      ...db,
      bags: db.bags.map((entry) => {
        if (entry.id !== bagId) return entry
        const checks = { ...entry.checks }
        delete checks[itemId]
        return { ...entry, excluded: [...excluded, itemId], checks }
      }),
    },
  }
}

export function includeBagLine(db, bagId, itemId) {
  return {
    db: {
      ...db,
      bags: db.bags.map((entry) =>
        entry.id === bagId ? { ...entry, excluded: (entry.excluded || []).filter((id) => id !== itemId) } : entry,
      ),
    },
  }
}

export function resetBag(db, bagId) {
  return {
    db: {
      ...db,
      bags: db.bags.map((bag) => (bag.id === bagId ? { ...bag, status: "ready", checks: {} } : bag)),
    },
  }
}

export function toggleCheck(db, bagId, itemId) {
  return {
    db: {
      ...db,
      bags: db.bags.map((bag) => {
        if (bag.id !== bagId) return bag
        const checks = { ...bag.checks }
        if (checks[itemId]) delete checks[itemId]
        else checks[itemId] = true
        return { ...bag, checks }
      }),
    },
  }
}

export function setBagQty(db, bagId, itemId, qty) {
  const count = Math.max(1, Number(qty) || 1)
  return {
    db: {
      ...db,
      bags: db.bags.map((bag) => {
        if (bag.id !== bagId) return bag
        const model = db.bagModels.find((entry) => entry.id === bag.modelId)
        const base = model?.lines.find((line) => line.itemId === itemId)?.qty
          ?? bag.added.find((line) => line.itemId === itemId)?.qty
        const next = { ...bag.qty }
        if (base === count) delete next[itemId]
        else next[itemId] = count
        return { ...bag, qty: next }
      }),
    },
  }
}

export function markEmptied(db, bagId) {
  return {
    db: {
      ...db,
      bags: db.bags.map((bag) => {
        if (bag.id !== bagId || bag.status !== "emptying") return bag
        const model = db.bagModels.find((entry) => entry.id === bag.modelId)
        const status = model?.afterUse === "marked" ? "filling" : "ready"
        return { ...bag, status, checks: {} }
      }),
    },
  }
}

export function markFilled(db, bagId) {
  return {
    db: {
      ...db,
      bags: db.bags.map((bag) => (bag.id === bagId && bag.status === "filling" ? { ...bag, status: "ready" } : bag)),
    },
  }
}

export function resolveLines(db, bag) {
  const model = db.bagModels.find((entry) => entry.id === bag.modelId)
  if (!model) return []
  const known = new Set(db.items.map((item) => item.id))
  const excluded = new Set(bag.excluded || [])
  const lines = []
  for (const line of model.lines) {
    if (!known.has(line.itemId) || excluded.has(line.itemId)) continue
    lines.push({
      itemId: line.itemId,
      qty: bag.qty[line.itemId] ?? line.qty,
      removeAfter: line.removeAfter,
    })
  }
  for (const extra of bag.added) {
    if (!known.has(extra.itemId)) continue
    if (lines.some((line) => line.itemId === extra.itemId)) continue
    lines.push({
      itemId: extra.itemId,
      qty: bag.qty[extra.itemId] ?? extra.qty,
      removeAfter: extra.removeAfter,
    })
  }
  return lines
}

export function visibleLines(db, bag) {
  const lines = resolveLines(db, bag)
  if (bag.status !== "emptying") return lines
  const model = db.bagModels.find((entry) => entry.id === bag.modelId)
  if (model?.afterUse === "marked") return lines.filter((line) => line.removeAfter)
  return lines
}

export function gapNames(db, bag) {
  if (bag.status === "emptying") return []
  return resolveLines(db, bag).filter((line) => !bag.checks[line.itemId]).map((line) => itemName(db, line.itemId))
}

export function missingChecks(db, bag) {
  if (bag.status !== "ready") return []
  return resolveLines(db, bag).filter((line) => !bag.checks[line.itemId]).map((line) => line.itemId)
}

export function attention(db, bag) {
  if (missingChecks(db, bag).length) return 0
  if (bag.status === "emptying") return 1
  if (bag.status === "filling") return 2
  return 3
}

export function itemName(db, itemId) {
  return db.items.find((item) => item.id === itemId)?.name ?? ""
}

export function bagName(db, bagId) {
  return db.bags.find((bag) => bag.id === bagId)?.name ?? ""
}

export function createDepartureModel(db, name) {
  const trimmed = name.trim()
  if (!trimmed) return { db, error: "Le nom est vide." }
  const model = { id: id(), name: trimmed, bagIds: [], actions: [] }
  return { db: { ...db, departureModels: [...db.departureModels, model] }, model }
}

export function toggleDepartureBag(db, modelId, bagId) {
  if (!db.bags.some((bag) => bag.id === bagId)) return { db }
  return {
    db: {
      ...db,
      departureModels: db.departureModels.map((model) => {
        if (model.id !== modelId) return model
        const bagIds = model.bagIds.includes(bagId)
          ? model.bagIds.filter((id) => id !== bagId)
          : [...model.bagIds, bagId]
        return { ...model, bagIds }
      }),
    },
  }
}

export function addDepartureAction(db, modelId, label, daysBefore) {
  const trimmed = label.trim()
  if (!trimmed) return { db, error: "Le nom est vide." }
  const offsetDays = -Math.max(0, Number(daysBefore) || 0)
  const action = { id: id(), label: trimmed, offsetDays }
  return {
    db: {
      ...db,
      departureModels: db.departureModels.map((model) =>
        model.id === modelId ? { ...model, actions: [...model.actions, action] } : model,
      ),
    },
  }
}

export function updateDepartureAction(db, modelId, actionId, label, daysBefore) {
  const trimmed = String(label || "").trim()
  if (!trimmed) return { db, error: "Le nom est vide." }
  const offsetDays = -Math.max(0, Number(daysBefore) || 0)
  let found = false
  const departureModels = db.departureModels.map((model) => {
    if (model.id !== modelId) return model
    return {
      ...model,
      actions: model.actions.map((action) => {
        if (action.id !== actionId) return action
        found = true
        return { ...action, label: trimmed, offsetDays }
      }),
    }
  })
  if (!found) return { db, error: "Introuvable." }
  return { db: { ...db, departureModels } }
}

export function updateDeparture(db, departureId, kind, start, end, weekday, today = null) {
  if (!db.departures.some((entry) => entry.id === departureId)) return { db, error: "Introuvable." }
  if (kind !== "once" && kind !== "recurring") return { db, error: "Le type n'existe pas." }
  if (kind === "once" && (!start || !end || end < start)) return { db, error: "Il faut un début et une fin." }
  const day = Number(weekday)
  if (kind === "recurring" && (weekday === "" || !Number.isInteger(day) || day < 0 || day > 6)) {
    return { db, error: "Il faut un jour." }
  }
  const next = {
    db: {
      ...db,
      departures: db.departures.map((entry) => {
        if (entry.id !== departureId) return entry
        const done = kind === "once"
          ? Object.fromEntries(Object.entries(entry.done).map(([key, value]) => [key, value === entry.start ? start : value]))
          : entry.done
        return {
          ...entry,
          kind,
          start: kind === "once" ? start : null,
          end: kind === "once" ? end : null,
          weekday: kind === "recurring" ? day : null,
          done,
          emptiedOn: today && kind === "once" && end >= today ? null : entry.emptiedOn,
        }
      }),
    },
  }
  return today ? releaseUnusedEmptying(next.db, today) : next
}

export function exportData(db) {
  return JSON.stringify(db)
}

export function importData(raw) {
  let data
  try {
    data = JSON.parse(raw)
  } catch {
    return { error: "Ce fichier n'est pas lisible." }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { error: "Ce fichier n'est pas lisible." }
  for (const key of ["items", "bagModels", "bags", "departureModels", "departures"]) {
    if (!Array.isArray(data[key])) return { error: "Ce fichier n'est pas une sauvegarde." }
  }
  if (!data.seed) data = { ...data, seed: "imported" }
  return { db: { ...emptyDb(), ...data, version: 1 } }
}

export function createDeparture(db, name, modelId, kind, start, end, weekday, createdOn = null) {
  const trimmed = name.trim()
  if (!trimmed) return { db, error: "Le nom est vide." }
  if (!db.departureModels.some((model) => model.id === modelId)) {
    return { db, error: "Le modèle n'existe pas." }
  }
  if (kind !== "once" && kind !== "recurring") return { db, error: "Le type n'existe pas." }
  if (kind === "once" && (!start || !end || end < start)) {
    return { db, error: "Il faut un début et une fin." }
  }
  const day = Number(weekday)
  if (kind === "recurring" && (weekday === "" || !Number.isInteger(day) || day < 0 || day > 6)) {
    return { db, error: "Il faut un jour." }
  }
  const departure = {
    id: id(),
    name: trimmed,
    modelId,
    kind,
    start: kind === "once" ? start : null,
    end: kind === "once" ? end : null,
    weekday: kind === "recurring" ? day : null,
    done: {},
    emptiedOn: null,
    createdOn,
  }
  return { db: { ...db, departures: [...db.departures, departure] }, departure }
}

function firstOnOrAfter(iso, weekday) {
  const delta = (weekday - weekdayOf(iso) + 7) % 7
  return addDays(iso, delta)
}

export function currentOccurrence(departure, action, today) {
  if (departure.kind === "once") {
    if (!departure.start) return null
    if (departure.done[action.id] === departure.start) return null
    return departure.start
  }
  if (departure.weekday == null) return null
  const created = departure.createdOn || today
  let day = firstOnOrAfter(created, departure.weekday)
  const done = departure.done[action.id]
  if (typeof done === "string") {
    while (day <= done) day = addDays(day, 7)
  }
  return day
}

export function actionChecked(departure, action) {
  return departure.kind === "once" && departure.done[action.id] === departure.start
}

export function toggleDepartureAction(db, departureId, actionId, today) {
  return {
    db: {
      ...db,
      departures: db.departures.map((departure) => {
        if (departure.id !== departureId) return departure
        const model = db.departureModels.find((entry) => entry.id === departure.modelId)
        const action = model?.actions.find((entry) => entry.id === actionId)
        if (!action) return departure
        const done = { ...departure.done }
        const day = currentOccurrence(departure, action, today)
        if (!day) {
          delete done[actionId]
          return { ...departure, done }
        }
        if (addDays(day, action.offsetDays) > today) {
          if (departure.kind === "recurring" && done[actionId]) {
            delete done[actionId]
            return { ...departure, done }
          }
          return departure
        }
        done[actionId] = day
        return { ...departure, done }
      }),
    },
  }
}


export function departureFields(kind) {
  return kind === "recurring" ? ["weekday"] : ["start", "end"]
}

export function departureBagIds(db, departure) {
  const model = db.departureModels.find((entry) => entry.id === departure.modelId)
  return model ? model.bagIds : []
}

export function actionDate(departure, action, today) {
  const day = currentOccurrence(departure, action, today) ?? (departure.kind === "once" ? departure.start : null)
  if (!day) return ""
  return addDays(day, action.offsetDays)
}

function outingDate(departure, today) {
  if (departure.kind === "once") return departure.end
  if (departure.kind !== "recurring" || departure.weekday == null) return null
  const created = departure.createdOn || today
  let day = firstOnOrAfter(created, departure.weekday)
  if (day >= today) return null
  let last = day
  while (addDays(last, 7) < today) last = addDays(last, 7)
  return last
}

export function agendaEvents(db, today) {
  const events = []
  for (const departure of db.departures) {
    const model = db.departureModels.find((entry) => entry.id === departure.modelId)
    if (!model) continue
    for (const action of model.actions) {
      const day = currentOccurrence(departure, action, today)
      if (!day) continue
      const since = addDays(day, action.offsetDays)
      if (since > today) continue
      events.push({ kind: "action", key: `action:${departure.id}:${action.id}:${day}`, title: action.label, since })
    }
  }
  for (const bag of db.bags) {
    if (bag.status === "emptying") events.push({ kind: "bag", key: `bag:${bag.id}:emptying`, title: `${bag.name}, à vider`, since: today })
    if (bag.status === "filling") events.push({ kind: "bag", key: `bag:${bag.id}:filling`, title: `${bag.name}, à remplir`, since: today })
  }
  return events
}

export function dueActions(db, today) {
  const rows = []
  for (const departure of db.departures) {
    const model = db.departureModels.find((entry) => entry.id === departure.modelId)
    if (!model) continue
    for (const action of model.actions) {
      const day = currentOccurrence(departure, action, today)
      if (!day) continue
      const since = addDays(day, action.offsetDays)
      if (since > today) continue
      rows.push({ departureId: departure.id, departureName: departure.name, label: action.label, since })
    }
  }
  return rows
}

export function listedActions(db, today) {
  const rows = dueActions(db, today).map((row) => ({ ...row, due: true }))
  for (const departure of db.departures) {
    const model = db.departureModels.find((entry) => entry.id === departure.modelId)
    if (!model) continue
    for (const action of model.actions) {
      const day = currentOccurrence(departure, action, today)
      if (!day) continue
      const since = addDays(day, action.offsetDays)
      if (since <= today) continue
      rows.push({ departureId: departure.id, departureName: departure.name, label: action.label, since, due: false })
    }
  }
  return rows.sort((a, b) => (a.since < b.since ? -1 : a.since > b.since ? 1 : 0))
}

export function deleteBag(db, bagId) {
  return {
    db: {
      ...db,
      bags: db.bags.filter((bag) => bag.id !== bagId),
      departureModels: db.departureModels.map((model) => ({
        ...model,
        bagIds: model.bagIds.filter((id) => id !== bagId),
      })),
    },
  }
}

export function deleteBagModel(db, modelId) {
  const gone = new Set(db.bags.filter((bag) => bag.modelId === modelId).map((bag) => bag.id))
  return {
    db: {
      ...db,
      bagModels: db.bagModels.filter((model) => model.id !== modelId),
      bags: db.bags.filter((bag) => bag.modelId !== modelId),
      departureModels: db.departureModels.map((model) => ({
        ...model,
        bagIds: model.bagIds.filter((id) => !gone.has(id)),
      })),
    },
  }
}

export function deleteDeparture(db, departureId, today = null) {
  const next = { ...db, departures: db.departures.filter((entry) => entry.id !== departureId) }
  return today ? releaseUnusedEmptying(next, today) : { db: next }
}

export function deleteDepartureModel(db, modelId) {
  return {
    db: {
      ...db,
      departureModels: db.departureModels.filter((model) => model.id !== modelId),
      departures: db.departures.filter((entry) => entry.modelId !== modelId),
    },
  }
}

export function removeDepartureAction(db, modelId, actionId) {
  return {
    db: {
      ...db,
      departureModels: db.departureModels.map((model) =>
        model.id === modelId
          ? { ...model, actions: model.actions.filter((action) => action.id !== actionId) }
          : model,
      ),
      departures: db.departures.map((departure) => {
        if (departure.modelId !== modelId) return departure
        const done = { ...departure.done }
        delete done[actionId]
        return { ...departure, done }
      }),
    },
  }
}

export function applyOutings(db, today) {
  let bags = db.bags
  const departures = db.departures.map((raw) => {
    const departure = raw.createdOn ? raw : { ...raw, createdOn: today }
    const when = outingDate(departure, today)
    if (!when || today <= when || departure.emptiedOn === when) return departure
    const model = db.departureModels.find((entry) => entry.id === departure.modelId)
    if (!model) return departure
    const ids = new Set(model.bagIds)
    const blocked = bags.some((bag) => {
      if (!ids.has(bag.id)) return false
      const recipe = db.bagModels.find((entry) => entry.id === bag.modelId)
      return recipe && recipe.afterUse !== "stay" && bag.status !== "ready"
    })
    if (blocked) return departure
    bags = bags.map((bag) => {
      if (!ids.has(bag.id)) return bag
      const recipe = db.bagModels.find((entry) => entry.id === bag.modelId)
      if (!recipe || recipe.afterUse === "stay" || bag.status !== "ready") return bag
      return { ...bag, status: "emptying", checks: {} }
    })
    return { ...departure, emptiedOn: when }
  })
  return { ...db, bags, departures }
}

export function releaseUnusedEmptying(db, today) {
  const stillNeeded = new Set()
  for (const departure of db.departures) {
    const when = outingDate(departure, today)
    if (!when || today <= when) continue
    const model = db.departureModels.find((entry) => entry.id === departure.modelId)
    if (!model) continue
    for (const id of model.bagIds) stillNeeded.add(id)
  }
  return {
    db: {
      ...db,
      bags: db.bags.map((bag) => {
        if (bag.status !== "emptying" || stillNeeded.has(bag.id)) return bag
        return { ...bag, status: "ready" }
      }),
    },
  }
}
