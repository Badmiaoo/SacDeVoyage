import test from "node:test"
import assert from "node:assert/strict"
import {
  emptyDb,
  createItem,
  createBagModel,
  setAfterUse,
  setModelLine,
  createBag,
  createDepartureModel,
  toggleDepartureBag,
  createDeparture,
  applyOutings,
  renameBag,
  renameBagModel,
  renameDeparture,
  renameDepartureModel,
  agendaEvents,
} from "./store.js"

test("renommer un sac ne change pas le modèle ni l'autre sac", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const first = createBag(db, "Mardi", model.model.id)
  db = first.db
  const second = createBag(db, "Jeudi", model.model.id)
  db = second.db
  const renamed = renameBag(db, first.bag.id, "  Plongée du mardi  ")
  assert.equal(renamed.error, undefined)
  db = renamed.db
  assert.equal(db.bags.find((bag) => bag.id === first.bag.id).name, "Plongée du mardi")
  assert.equal(db.bags.find((bag) => bag.id === second.bag.id).name, "Jeudi")
  assert.equal(db.bagModels[0].name, "Plongée")
  assert.equal(renameBag(db, first.bag.id, "   ").error, "Le nom est vide.")
  assert.equal(renameBag(db, first.bag.id, "jeudi").error, "Ce nom existe déjà.")
})

test("renommer le modèle ne renomme pas les sacs", () => {
  let db = emptyDb()
  const model = createBagModel(db, "Plongée")
  db = model.db
  const other = createBagModel(db, "Valise")
  db = other.db
  db = createBag(db, "Mardi", model.model.id).db
  const renamed = renameBagModel(db, model.model.id, "Club")
  db = renamed.db
  assert.equal(db.bagModels.find((entry) => entry.id === model.model.id).name, "Club")
  assert.equal(db.bags[0].name, "Mardi")
  assert.equal(renameBagModel(db, model.model.id, "valise").error, "Ce nom existe déjà.")
})

test("renommer un départ ne change pas son modèle, et l'agenda suit le sac", () => {
  let db = emptyDb()
  const item = createItem(db, "Stab")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setAfterUse(db, model.model.id, "all").db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const bag = createBag(db, "Mardi", model.model.id)
  db = bag.db
  const recipe = createDepartureModel(db, "Club")
  db = recipe.db
  const other = createDepartureModel(db, "Paris")
  db = other.db
  db = toggleDepartureBag(db, recipe.model.id, bag.bag.id).db
  const trip = createDeparture(db, "Sortie", recipe.model.id, "once", "2026-11-01", "2026-11-02", "", "2026-11-01")
  db = trip.db
  db = applyOutings(db, "2026-11-03")
  db = renameDeparture(db, trip.departure.id, "Sortie de mardi").db
  db = renameDepartureModel(db, recipe.model.id, "Club du soir").db
  assert.equal(db.departures[0].name, "Sortie de mardi")
  assert.equal(db.departureModels.find((entry) => entry.id === recipe.model.id).name, "Club du soir")
  assert.equal(renameDepartureModel(db, recipe.model.id, "paris").error, "Ce nom existe déjà.")
  const before = agendaEvents(db, "2026-11-03")[0]
  db = renameBag(db, bag.bag.id, "Plongée du mardi").db
  const after = agendaEvents(db, "2026-11-03")[0]
  assert.equal(after.title, "Plongée du mardi, à vider")
  assert.equal(after.key, before.key)
  assert.equal(JSON.stringify(after).includes("Stab"), false)
})
