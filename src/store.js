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

export function itemName(db, itemId) {
  return db.items.find((item) => item.id === itemId)?.name ?? ""
}
