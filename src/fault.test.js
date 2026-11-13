import test from "node:test"
import assert from "node:assert/strict"
import {
  emptyDb,
  createItem,
  createBagModel,
  setModelLine,
  setAfterUse,
  createBag,
  toggleCheck,
  missingChecks,
  agendaEvents,
  createDepartureModel,
  toggleDepartureBag,
  createDeparture,
  applyOutings,
  attention,
  markEmptied,
  markFilled,
  setRemoveAfter,
} from "./store.js"

test("un sac pas entièrement coché n'est pas rempli", () => {
  let db = emptyDb()
  const masque = createItem(db, "Masque")
  db = masque.db
  const stab = createItem(db, "Stab")
  db = stab.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, masque.item.id, 1).db
  db = setModelLine(db, model.model.id, stab.item.id, 1).db
  const bag = createBag(db, "Mardi", model.model.id)
  db = bag.db
  db = toggleCheck(db, bag.bag.id, masque.item.id).db
  const child = db.bags[0]
  assert.equal(child.status, "ready")
  assert.deepEqual(missingChecks(db, child), [stab.item.id])
  db = toggleCheck(db, bag.bag.id, stab.item.id).db
  assert.deepEqual(missingChecks(db, db.bags[0]), [])
  db = toggleCheck(db, bag.bag.id, stab.item.id).db
  assert.deepEqual(missingChecks(db, db.bags[0]), [stab.item.id])
})

test("à vider n'est pas une alerte de sac incomplet", () => {
  let db = emptyDb()
  const item = createItem(db, "Stab")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setAfterUse(db, model.model.id, "all").db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const bag = createBag(db, "Mardi", model.model.id)
  db = bag.db
  const trip = createDepartureModel(db, "Club")
  db = trip.db
  db = toggleDepartureBag(db, trip.model.id, bag.bag.id).db
  db = createDeparture(db, "Sortie", trip.model.id, "once", "2026-11-01", "2026-11-02", "", "2026-11-01").db
  db = applyOutings(db, "2026-11-03")
  assert.equal(db.bags[0].status, "emptying")
  assert.deepEqual(missingChecks(db, db.bags[0]), [])
  const titles = agendaEvents(db, "2026-11-03").map((event) => event.title)
  assert.deepEqual(titles, ["Mardi, à vider"])
  assert.equal(titles.join(" ").includes("En défaut"), false)
})

test("le sac en défaut passe avant les autres", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const open = createBag(db, "Ouvert", model.model.id)
  db = open.db
  const done = createBag(db, "Prêt", model.model.id)
  db = done.db
  db = toggleCheck(db, done.bag.id, item.item.id).db
  const order = [...db.bags].sort((a, b) => attention(db, a) - attention(db, b)).map((bag) => bag.name)
  assert.deepEqual(order, ["Ouvert", "Prêt"])
})

test("un sac vide n'est pas en défaut", () => {
  let db = emptyDb()
  const model = createBagModel(db, "Cabine")
  db = model.db
  db = createBag(db, "Cabine", model.model.id).db
  assert.deepEqual(missingChecks(db, db.bags[0]), [])
})

test("les coches d'avant la sortie ne font pas un sac rempli", () => {
  let db = emptyDb()
  const masque = createItem(db, "Masque")
  db = masque.db
  const stab = createItem(db, "Stab")
  db = stab.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setAfterUse(db, model.model.id, "marked").db
  db = setModelLine(db, model.model.id, masque.item.id, 1).db
  db = setModelLine(db, model.model.id, stab.item.id, 1).db
  db = setRemoveAfter(db, model.model.id, stab.item.id, true).db
  const bag = createBag(db, "Mardi", model.model.id)
  db = bag.db
  const other = createBag(db, "Cabine", model.model.id)
  db = other.db
  db = toggleCheck(db, bag.bag.id, masque.item.id).db
  db = toggleCheck(db, bag.bag.id, stab.item.id).db
  db = toggleCheck(db, other.bag.id, masque.item.id).db
  const trip = createDepartureModel(db, "Club")
  db = trip.db
  db = toggleDepartureBag(db, trip.model.id, bag.bag.id).db
  db = createDeparture(db, "Sortie", trip.model.id, "once", "2026-11-01", "2026-11-02", "", "2026-11-01").db
  db = applyOutings(db, "2026-11-03")
  const wet = db.bags.find((entry) => entry.id === bag.bag.id)
  assert.equal(wet.status, "emptying")
  assert.deepEqual(wet.checks, {})
  assert.equal(db.bags.find((entry) => entry.id === other.bag.id).checks[masque.item.id], true)
  db = toggleCheck(db, bag.bag.id, stab.item.id).db
  db = markEmptied(db, bag.bag.id).db
  const drying = db.bags.find((entry) => entry.id === bag.bag.id)
  assert.equal(drying.status, "filling")
  assert.deepEqual(drying.checks, {})
  db = toggleCheck(db, bag.bag.id, masque.item.id).db
  db = markFilled(db, bag.bag.id).db
  const back = db.bags.find((entry) => entry.id === bag.bag.id)
  assert.equal(back.status, "ready")
  assert.deepEqual(missingChecks(db, back), [stab.item.id])
})

test("tout sortir ne garde pas les anciennes coches", () => {
  let db = emptyDb()
  const item = createItem(db, "T-shirt")
  db = item.db
  const model = createBagModel(db, "Valise")
  db = model.db
  db = setAfterUse(db, model.model.id, "all").db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const bag = createBag(db, "CSE", model.model.id)
  db = bag.db
  db = toggleCheck(db, bag.bag.id, item.item.id).db
  const trip = createDepartureModel(db, "Juin")
  db = trip.db
  db = toggleDepartureBag(db, trip.model.id, bag.bag.id).db
  db = createDeparture(db, "CSE juin", trip.model.id, "once", "2026-08-12", "2026-08-20", "", "2026-08-01").db
  db = applyOutings(db, "2026-08-21")
  db = markEmptied(db, bag.bag.id).db
  const back = db.bags[0]
  assert.equal(back.status, "ready")
  assert.deepEqual(missingChecks(db, back), [item.item.id])
})


