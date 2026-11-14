import test from "node:test"
import assert from "node:assert/strict"
import {
  emptyDb,
  createItem,
  createBagModel,
  setAfterUse,
  setModelLine,
  createBag,
  toggleCheck,
  resolveLines,
  excludeBagLine,
  includeBagLine,
  resetBag,
  createDepartureModel,
  toggleDepartureBag,
  createDeparture,
  applyOutings,
  updateDeparture,
  deleteDeparture,
  addDepartureAction,
  toggleDepartureAction,
  agendaEvents,
  importData,
} from "./store.js"
import { planCalendar } from "./agenda.js"
import { personalDb, openDb, PERSONAL_SEED } from "./personal.js"
import { save } from "./store.js"

function memory() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  }
}

test("retirer une ligne du modèle dans un seul sac", () => {
  let db = emptyDb()
  const masque = createItem(db, "Masque")
  db = masque.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, masque.item.id, 1).db
  const first = createBag(db, "Mardi", model.model.id)
  db = first.db
  const second = createBag(db, "Jeudi", model.model.id)
  db = second.db
  db = excludeBagLine(db, first.bag.id, masque.item.id).db
  assert.equal(resolveLines(db, db.bags[0]).some((line) => line.itemId === masque.item.id), false)
  assert.equal(resolveLines(db, db.bags[1]).some((line) => line.itemId === masque.item.id), true)
  assert.equal(db.bagModels[0].lines.length, 1)
  db = includeBagLine(db, first.bag.id, masque.item.id).db
  assert.equal(resolveLines(db, db.bags[0]).length, 1)
})

test("remettre à zéro oublie les coches et revient à prêt", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const bag = createBag(db, "Mardi", model.model.id)
  db = bag.db
  db = toggleCheck(db, bag.bag.id, item.item.id).db
  db = { ...db, bags: db.bags.map((entry) => ({ ...entry, status: "emptying" })) }
  db = resetBag(db, bag.bag.id).db
  assert.equal(db.bags[0].status, "ready")
  assert.deepEqual(db.bags[0].checks, {})
})

test("repousser la fin annule le à vider", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Valise")
  db = model.db
  db = setAfterUse(db, model.model.id, "all").db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const bag = createBag(db, "Valise", model.model.id)
  db = bag.db
  const trip = createDepartureModel(db, "CSE")
  db = trip.db
  db = toggleDepartureBag(db, trip.model.id, bag.bag.id).db
  db = createDeparture(db, "Juin", trip.model.id, "once", "2026-08-12", "2026-08-20", "", "2026-06-01").db
  db = applyOutings(db, "2026-08-21")
  assert.equal(db.bags[0].status, "emptying")
  db = updateDeparture(db, db.departures[0].id, "once", "2026-08-12", "2026-08-28", "", "2026-08-21").db
  assert.equal(db.bags[0].status, "ready")
  assert.equal(db.departures[0].emptiedOn, null)
})

test("deux sorties le même jour ne consomment pas la seconde", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Valise")
  db = model.db
  db = setAfterUse(db, model.model.id, "all").db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const bag = createBag(db, "Valise", model.model.id)
  db = bag.db
  const first = createDepartureModel(db, "Lundi")
  db = first.db
  const second = createDepartureModel(db, "Mardi")
  db = second.db
  db = toggleDepartureBag(db, first.model.id, bag.bag.id).db
  db = toggleDepartureBag(db, second.model.id, bag.bag.id).db
  db = createDeparture(db, "Un", first.model.id, "once", "2026-11-01", "2026-11-02", "", "2026-11-01").db
  db = createDeparture(db, "Deux", second.model.id, "once", "2026-11-01", "2026-11-02", "", "2026-11-01").db
  db = applyOutings(db, "2026-11-03")
  assert.equal(db.bags[0].status, "emptying")
  assert.equal(db.departures.filter((entry) => entry.emptiedOn).length, 2)
  db = resetBag(db, bag.bag.id).db
  db = applyOutings(db, "2026-11-03")
  assert.equal(db.bags[0].status, "emptying")
  assert.equal(db.bags[0].emptiedOn, "2026-11-02")
})

test("supprimer le départ remet un sac encore à vider", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Valise")
  db = model.db
  db = setAfterUse(db, model.model.id, "all").db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const bag = createBag(db, "Valise", model.model.id)
  db = bag.db
  const trip = createDepartureModel(db, "CSE")
  db = trip.db
  db = toggleDepartureBag(db, trip.model.id, bag.bag.id).db
  db = createDeparture(db, "Juin", trip.model.id, "once", "2026-08-12", "2026-08-20", "", "2026-06-01").db
  db = applyOutings(db, "2026-08-21")
  db = deleteDeparture(db, db.departures[0].id, "2026-08-21").db
  assert.equal(db.bags[0].status, "emptying")
})

test("un clic trop tôt ne défait pas la coche", () => {
  let db = emptyDb()
  const trip = createDepartureModel(db, "Paris")
  db = trip.db
  db = addDepartureAction(db, trip.model.id, "Badge", 0).db
  db = createDeparture(db, "Mercredi", trip.model.id, "recurring", "", "", "3", "2026-11-11").db
  const action = db.departureModels[0].actions[0]
  db = toggleDepartureAction(db, db.departures[0].id, action.id, "2026-11-11").db
  assert.equal(db.departures[0].done[action.id], "2026-11-11")
  const early = toggleDepartureAction(db, db.departures[0].id, action.id, "2026-11-12")
  assert.equal(early.early, true)
  assert.equal(early.db.departures[0].done[action.id], "2026-11-11")
})

test("remettre à zéro un sac ne revide pas l'autre", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Valise")
  db = model.db
  db = setAfterUse(db, model.model.id, "all").db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const first = createBag(db, "A", model.model.id)
  db = first.db
  const second = createBag(db, "B", model.model.id)
  db = second.db
  const trip = createDepartureModel(db, "CSE")
  db = trip.db
  db = toggleDepartureBag(db, trip.model.id, first.bag.id).db
  db = toggleDepartureBag(db, trip.model.id, second.bag.id).db
  db = createDeparture(db, "Juin", trip.model.id, "once", "2026-08-12", "2026-08-20", "", "2026-06-01").db
  db = applyOutings(db, "2026-08-21")
  db = resetBag(db, first.bag.id).db
  db = applyOutings(db, "2026-08-21")
  assert.equal(db.bags.find((bag) => bag.id === first.bag.id).status, "emptying")
  assert.equal(db.bags.find((bag) => bag.id === second.bag.id).status, "emptying")
  assert.equal(db.bags.find((bag) => bag.id === second.bag.id).emptiedOn, "2026-08-20")
})

test("remettre à zéro redemande le vidage", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Valise")
  db = model.db
  db = setAfterUse(db, model.model.id, "all").db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const bag = createBag(db, "Valise", model.model.id)
  db = bag.db
  const trip = createDepartureModel(db, "CSE")
  db = trip.db
  db = toggleDepartureBag(db, trip.model.id, bag.bag.id).db
  db = createDeparture(db, "Juin", trip.model.id, "once", "2026-08-12", "2026-08-20", "", "2026-06-01").db
  db = applyOutings(db, "2026-08-21")
  db = resetBag(db, bag.bag.id).db
  db = applyOutings(db, "2026-08-21")
  assert.equal(db.bags[0].status, "emptying")
})

test("un doublon de clé est supprimé", () => {
  const existing = [
    { id: "a", key: "bag:1:emptying", summary: "Valise, à vider", description: "", start: "2026-11-12", end: "2026-11-13" },
    { id: "b", key: "bag:1:emptying", summary: "Valise, à vider", description: "", start: "2026-11-12", end: "2026-11-13" },
  ]
  const desired = [{ key: "bag:1:emptying", title: "Valise, à vider", since: "2026-11-12" }]
  const plan = planCalendar(desired, existing, "2026-11-12")
  assert.deepEqual(plan.deletes.map((event) => event.id), ["b"])
  assert.equal(plan.creates.length, 0)
})

test("les choses à faire ne sont plus dans le sac voyage", () => {
  const db = personalDb()
  const voyage = db.bagModels.find((model) => model.name === "Voyage")
  const names = voyage.lines.map((line) => db.items.find((item) => item.id === line.itemId).name)
  assert.equal(names.includes("Prévenir la banque"), false)
  assert.equal(names.includes("Inscription fil d'Ariane"), false)
  assert.equal(names.includes("Photocopie passeport"), false)
  const model = db.departureModels.find((entry) => entry.name === "Voyage")
  assert.deepEqual(model.actions.map((action) => action.label), [
    "Vérifier les papiers",
    "Prévenir la banque",
    "Inscription fil d'Ariane",
    "Photocopie passeport",
  ])
  assert.equal(db.departureModels.find((entry) => entry.name === "Départ maison").actions.length, 10)
})

test("une copie sans marque n'est pas réécrasée", () => {
  const storage = memory()
  const raw = importData(JSON.stringify({ ...emptyDb(), items: [{ id: "x", name: "Ancien" }] }))
  save(raw.db, storage)
  assert.equal(openDb(storage).items.some((item) => item.name === "Ancien"), true)
  assert.equal(openDb(storage).seed, "imported")
})

test("la marque perso actuelle est gardée", () => {
  const storage = memory()
  save(personalDb(), storage)
  assert.equal(openDb(storage).seed, PERSONAL_SEED)
})
