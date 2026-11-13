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
        return { ...bag, status }
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
  const lines = []
  for (const line of model.lines) {
    if (!known.has(line.itemId)) continue
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

export function createDeparture(db, name, modelId, kind, start, end, weekday) {
  const trimmed = name.trim()
  if (!trimmed) return { db, error: "Le nom est vide." }
  if (!db.departureModels.some((model) => model.id === modelId)) {
    return { db, error: "Le modèle n'existe pas." }
  }
  if (kind === "once" && (!start || !end || end < start)) {
    return { db, error: "Il faut un début et une fin." }
  }
  if (kind === "recurring" && weekday === "") {
    return { db, error: "Il faut un jour." }
  }
  const departure = {
    id: id(),
    name: trimmed,
    modelId,
    kind,
    start: kind === "once" ? start : null,
    end: kind === "once" ? end : null,
    weekday: kind === "recurring" ? Number(weekday) : null,
    done: {},
    emptiedOn: null,
  }
  return { db: { ...db, departures: [...db.departures, departure] }, departure }
}

export function toggleDepartureAction(db, departureId, actionId) {
  return {
    db: {
      ...db,
      departures: db.departures.map((departure) => {
        if (departure.id !== departureId) return departure
        const done = { ...departure.done }
        if (done[actionId]) delete done[actionId]
        else done[actionId] = true
        return { ...departure, done }
      }),
    },
  }
}

export function actionDate(departure, action, today) {
  const base = departure.kind === "once" ? departure.start : nextWeekday(today, departure.weekday)
  if (!base) return ""
  return addDays(base, action.offsetDays)
}

function outingDate(departure, today) {
  if (departure.kind === "once") return departure.end
  if (departure.kind === "recurring") return passedWeekday(today, departure.weekday)
  return null
}

export function applyOutings(db, today) {
  let bags = db.bags
  const departures = db.departures.map((departure) => {
    const when = outingDate(departure, today)
    if (!when || today <= when || departure.emptiedOn === when) return departure
    const model = db.departureModels.find((entry) => entry.id === departure.modelId)
    if (!model) return departure
    const ids = new Set(model.bagIds)
    bags = bags.map((bag) => {
      if (!ids.has(bag.id) || bag.status !== "ready") return bag
      const recipe = db.bagModels.find((entry) => entry.id === bag.modelId)
      if (!recipe || recipe.afterUse === "stay") return bag
      return { ...bag, status: "emptying" }
    })
    return { ...departure, emptiedOn: when }
  })
  return { ...db, bags, departures }
}
