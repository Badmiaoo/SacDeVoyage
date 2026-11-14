import test from "node:test"
import assert from "node:assert/strict"
import {
  emptyDb,
  createItem,
  createBagModel,
  createBag,
  createDepartureModel,
  createDeparture,
  addDepartureAction,
  setModelLine,
  excludeBagLine,
  agendaEvents,
  importData,
  deleteItem,
} from "./store.js"

test("un modèle ou un sac du même nom est refusé", () => {
  let db = emptyDb()
  const model = createBagModel(db, "Plongée", "marked")
  db = model.db
  assert.equal(db.bagModels[0].afterUse, "marked")
  assert.equal(createBagModel(db, "plongée").error, "Ce nom existe déjà.")
  const bag = createBag(db, "Mardi", model.model.id)
  db = bag.db
  assert.equal(createBag(db, "mardi", model.model.id).error, "Ce nom existe déjà.")
})

test("un départ du même nom est refusé", () => {
  let db = emptyDb()
  const trip = createDepartureModel(db, "Paris")
  db = trip.db
  assert.equal(createDepartureModel(db, "paris").error, "Ce nom existe déjà.")
  db = createDeparture(db, "Mercredi", trip.model.id, "recurring", "", "", "3", "2026-11-11").db
  assert.equal(createDeparture(db, "mercredi", trip.model.id, "recurring", "", "", "3").error, "Ce nom existe déjà.")
})

test("les jours et les nombres sont des entiers plafonnés", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, item.item.id, 1.8).db
  assert.equal(db.bagModels[0].lines[0].qty, 1)
  const trip = createDepartureModel(db, "Club")
  db = trip.db
  db = addDepartureAction(db, trip.model.id, "Badge", 1.5).db
  assert.equal(db.departureModels[0].actions[0].offsetDays, -1)
  db = addDepartureAction(db, trip.model.id, "Loin", 9999).db
  assert.equal(db.departureModels[0].actions[1].offsetDays, -365)
})

test("remettre une ligne exclue la fait revenir", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const bag = createBag(db, "Mardi", model.model.id)
  db = bag.db
  db = excludeBagLine(db, bag.bag.id, item.item.id).db
  db = setModelLine(db, model.model.id, item.item.id, 2).db
  assert.equal(db.bags[0].excluded.includes(item.item.id), false)
})

test("l'agenda nomme le départ", () => {
  let db = emptyDb()
  const trip = createDepartureModel(db, "Paris")
  db = trip.db
  db = addDepartureAction(db, trip.model.id, "Badge", 0).db
  db = createDeparture(db, "Mercredi", trip.model.id, "recurring", "", "", "3", "2026-11-11").db
  const titles = agendaEvents(db, "2026-11-11").map((event) => event.title)
  assert.equal(titles[0], "Mercredi · Badge")
})

test("une copie sans added ne plante pas", () => {
  const raw = importData(JSON.stringify({ ...emptyDb(), bags: [{ id: "b", name: "X", modelId: "m" }] }))
  assert.equal(Array.isArray(raw.db.bags[0].added), true)
})

test("supprimer un objet retire aussi l'exclusion", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const bag = createBag(db, "Mardi", model.model.id)
  db = bag.db
  db = excludeBagLine(db, bag.bag.id, item.item.id).db
  db = deleteItem(db, item.item.id).db
  assert.equal(db.bags[0].excluded.length, 0)
})
