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
  resolveLines,
  setBagQty,
  renameItem,
  deleteItem,
  addDays,
  createDepartureModel,
  toggleDepartureBag,
  addDepartureAction,
  createDeparture,
  actionDate,
  applyOutings,
  departureFields,
  departureBagIds,
  markEmptied,
  visibleLines,
} from "./store.js"

test("refuse un objet du même nom", () => {
  let db = emptyDb()
  db = createItem(db, "Masque").db
  const again = createItem(db, " masque ")
  assert.equal(again.error, "Ce nom existe déjà.")
  assert.equal(again.db.items.length, 1)
})

test("un enfant ne copie pas le modèle", () => {
  let db = emptyDb()
  const masque = createItem(db, "Masque")
  db = masque.db
  const stab = createItem(db, "Stab")
  db = stab.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, masque.item.id, 1).db
  const bag = createBag(db, "Plongée du mardi", model.model.id)
  db = bag.db
  db = setModelLine(db, model.model.id, stab.item.id, 1).db
  const lines = resolveLines(db, db.bags[0])
  assert.deepEqual(lines.map((line) => line.itemId), [masque.item.id, stab.item.id])
  assert.deepEqual(db.bags[0].added, [])
})

test("renommer et supprimer se propagent", () => {
  let db = emptyDb()
  const item = createItem(db, "Stab")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  db = createBag(db, "Mardi", model.model.id).db
  db = renameItem(db, item.item.id, "Gilet").db
  assert.equal(db.items[0].name, "Gilet")
  db = deleteItem(db, item.item.id).db
  assert.equal(resolveLines(db, db.bags[0]).length, 0)
  assert.equal(db.bagModels[0].lines.length, 0)
})

test("cocher puis décocher", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, item.item.id, 2).db
  db = createBag(db, "Mardi", model.model.id).db
  db = toggleCheck(db, db.bags[0].id, item.item.id).db
  assert.equal(db.bags[0].checks[item.item.id], true)
  db = toggleCheck(db, db.bags[0].id, item.item.id).db
  assert.equal(db.bags[0].checks[item.item.id], undefined)
})

test("le nombre d'un enfant ne change pas le modèle", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  db = createBag(db, "Mardi", model.model.id).db
  db = setBagQty(db, db.bags[0].id, item.item.id, 3).db
  assert.equal(db.bagModels[0].lines[0].qty, 1)
  assert.equal(resolveLines(db, db.bags[0])[0].qty, 3)
  db = setModelLine(db, model.model.id, item.item.id, 4).db
  assert.equal(resolveLines(db, db.bags[0])[0].qty, 3)
})

test("J-30 part du début", () => {
  let db = emptyDb()
  const model = createDepartureModel(db, "Avec avion")
  db = model.db
  db = addDepartureAction(db, model.model.id, "Papiers", 30).db
  const departure = createDeparture(db, "CSE juin", model.model.id, "once", "2026-08-12", "2026-08-20", "")
  db = departure.db
  assert.equal(actionDate(db.departures[0], db.departureModels[0].actions[0], "2026-06-01"), "2026-07-13")
  assert.equal(addDays("2026-08-12", -1), "2026-08-11")
})

test("après la fin, seul le sac concerné passe à vider", () => {
  let db = emptyDb()
  const item = createItem(db, "Stab")
  db = item.db
  const wet = createBagModel(db, "Plongée")
  db = wet.db
  db = setAfterUse(db, wet.model.id, "marked").db
  db = setModelLine(db, wet.model.id, item.item.id, 1).db
  const calm = createBagModel(db, "Cabine")
  db = calm.db
  const bag = createBag(db, "Plongée du mardi", wet.model.id)
  db = bag.db
  const other = createBag(db, "Cabine", calm.model.id)
  db = other.db
  const trip = createDepartureModel(db, "Club")
  db = trip.db
  db = toggleDepartureBag(db, trip.model.id, bag.bag.id).db
  db = createDeparture(db, "Sortie", trip.model.id, "once", "2026-11-01", "2026-11-10", "").db
  db = applyOutings(db, "2026-11-11")
  assert.equal(db.bags.find((entry) => entry.id === bag.bag.id).status, "emptying")
  assert.equal(db.bags.find((entry) => entry.id === other.bag.id).status, "ready")
  const again = applyOutings(db, "2026-11-12")
  assert.equal(again.bags.find((entry) => entry.id === bag.bag.id).status, "emptying")
  db = markEmptied(db, bag.bag.id).db
  assert.equal(db.bags.find((entry) => entry.id === bag.bag.id).status, "filling")
  assert.equal(visibleLines(db, db.bags.find((entry) => entry.id === bag.bag.id)).length, resolveLines(db, db.bags[0]).length)
})

test("une seule fois ne demande pas le jour de la semaine", () => {
  assert.deepEqual(departureFields("once"), ["start", "end"])
  assert.deepEqual(departureFields("recurring"), ["weekday"])
})

test("un sac ajouté au modèle après le départ y apparaît", () => {
  let db = emptyDb()
  const first = createBagModel(db, "Cabine")
  db = first.db
  const second = createBagModel(db, "Soute")
  db = second.db
  const cabin = createBag(db, "Cabine du mercredi", first.model.id)
  db = cabin.db
  const hold = createBag(db, "Soute", second.model.id)
  db = hold.db
  const model = createDepartureModel(db, "Avec avion")
  db = model.db
  db = toggleDepartureBag(db, model.model.id, cabin.bag.id).db
  db = createDeparture(db, "CSE juin", model.model.id, "once", "2026-08-12", "2026-08-20", "").db
  db = toggleDepartureBag(db, model.model.id, hold.bag.id).db
  const ids = departureBagIds(db, db.departures[0])
  assert.deepEqual(ids, [cabin.bag.id, hold.bag.id])
})

test("un objet ajouté au sac après le départ est dans le sac", () => {
  let db = emptyDb()
  const masque = createItem(db, "Masque")
  db = masque.db
  const palmes = createItem(db, "Palmes")
  db = palmes.db
  const recipe = createBagModel(db, "Plongée")
  db = recipe.db
  db = setModelLine(db, recipe.model.id, masque.item.id, 1).db
  const bag = createBag(db, "Plongée du mardi", recipe.model.id)
  db = bag.db
  const model = createDepartureModel(db, "Club")
  db = model.db
  db = toggleDepartureBag(db, model.model.id, bag.bag.id).db
  db = createDeparture(db, "Sortie", model.model.id, "once", "2026-11-01", "2026-11-02", "").db
  db = setModelLine(db, recipe.model.id, palmes.item.id, 1).db
  const names = resolveLines(db, db.bags[0]).map((line) => line.itemId)
  assert.deepEqual(names, [masque.item.id, palmes.item.id])
  assert.deepEqual(departureBagIds(db, db.departures[0]), [bag.bag.id])
})
