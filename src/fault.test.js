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

