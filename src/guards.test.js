import test from "node:test"
import assert from "node:assert/strict"
import {
  emptyDb,
  load,
  save,
  createItem,
  createBagModel,
  setModelLine,
  setAfterUse,
  setRemoveAfter,
  removeModelLine,
  createBag,
  addBagLine,
  setBagQty,
  toggleCheck,
  resolveLines,
  visibleLines,
  markEmptied,
  markFilled,
  createDepartureModel,
  toggleDepartureBag,
  addDepartureAction,
  removeDepartureAction,
  createDeparture,
  toggleDepartureAction,
  actionDate,
  applyOutings,
  agendaEvents,
  deleteBag,
  deleteBagModel,
  deleteDepartureModel,
  departureBagIds,
} from "./store.js"

function ids(db, bag) {
  return resolveLines(db, bag).map((line) => line.itemId)
}

test("un nom vide est refusé partout", () => {
  let db = emptyDb()
  assert.equal(createItem(db, "  ").error, "Le nom est vide.")
  assert.equal(createBagModel(db, "").error, "Le nom est vide.")
  assert.equal(createDepartureModel(db, " ").error, "Le nom est vide.")
  const model = createBagModel(db, "Plongée")
  db = model.db
  assert.equal(createBag(db, " ", model.model.id).error, "Le nom est vide.")
  const trip = createDepartureModel(db, "Club")
  db = trip.db
  assert.equal(addDepartureAction(db, trip.model.id, "  ", 1).error, "Le nom est vide.")
  assert.equal(createDeparture(db, "", trip.model.id, "once", "2026-11-01", "2026-11-02", "").error, "Le nom est vide.")
})

test("deux sacs du même modèle restent indépendants", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const mardi = createBag(db, "Mardi", model.model.id)
  db = mardi.db
  const jeudi = createBag(db, "Jeudi", model.model.id)
  db = jeudi.db
  db = setBagQty(db, mardi.bag.id, item.item.id, 3).db
  db = toggleCheck(db, mardi.bag.id, item.item.id).db
  const other = db.bags.find((bag) => bag.id === jeudi.bag.id)
  assert.equal(resolveLines(db, other)[0].qty, 1)
  assert.equal(other.checks[item.item.id], undefined)
  assert.equal(db.bagModels[0].lines[0].qty, 1)
})

test("lampe reste dans l'enfant et palmes arrive du modèle", () => {
  let db = emptyDb()
  const masque = createItem(db, "Masque")
  db = masque.db
  const lampe = createItem(db, "Lampe")
  db = lampe.db
  const palmes = createItem(db, "Palmes")
  db = palmes.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, masque.item.id, 1).db
  const bag = createBag(db, "Mardi", model.model.id)
  db = bag.db
  db = setBagQty(db, bag.bag.id, masque.item.id, 2).db
  db = addBagLine(db, bag.bag.id, lampe.item.id, 1).db
  db = setModelLine(db, model.model.id, palmes.item.id, 1).db
  assert.deepEqual(db.bagModels[0].lines.map((line) => line.itemId), [masque.item.id, palmes.item.id])
  assert.equal(db.bagModels[0].lines[0].qty, 1)
  const child = db.bags.find((entry) => entry.id === bag.bag.id)
  assert.deepEqual(ids(db, child), [masque.item.id, palmes.item.id, lampe.item.id])
  assert.equal(resolveLines(db, child).find((line) => line.itemId === masque.item.id).qty, 2)
})

test("une ligne retirée puis remise reprend le nombre du modèle", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  db = createBag(db, "Mardi", model.model.id).db
  db = setBagQty(db, db.bags[0].id, item.item.id, 4).db
  db = removeModelLine(db, model.model.id, item.item.id).db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  assert.equal(resolveLines(db, db.bags[0])[0].qty, 1)
})

test("un nombre nul devient un", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, item.item.id, 0).db
  assert.equal(db.bagModels[0].lines[0].qty, 1)
})

test("un objet inconnu n'entre pas", () => {
  let db = emptyDb()
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, "absent", 1).db
  assert.equal(db.bagModels[0].lines.length, 0)
  const bag = createBag(db, "Mardi", model.model.id)
  db = bag.db
  const added = addBagLine(db, bag.bag.id, "absent", 1)
  assert.equal(added.error, "L'objet n'existe pas.")
  const trip = createDepartureModel(db, "Club")
  db = trip.db
  db = toggleDepartureBag(db, trip.model.id, "absent").db
  assert.deepEqual(db.departureModels[0].bagIds, [])
})

test("à vider ne montre que ce qui est marqué", () => {
  let db = emptyDb()
  const stab = createItem(db, "Stab")
  db = stab.db
  const masque = createItem(db, "Masque")
  db = masque.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setAfterUse(db, model.model.id, "marked").db
  db = setModelLine(db, model.model.id, stab.item.id, 1).db
  db = setModelLine(db, model.model.id, masque.item.id, 1).db
  db = setRemoveAfter(db, model.model.id, stab.item.id, true).db
  const bag = createBag(db, "Mardi", model.model.id)
  db = bag.db
  const trip = createDepartureModel(db, "Club")
  db = trip.db
  db = toggleDepartureBag(db, trip.model.id, bag.bag.id).db
  db = createDeparture(db, "Sortie", trip.model.id, "once", "2026-11-10", "2026-11-11", "", "2026-11-01").db
  assert.equal(applyOutings(db, "2026-11-11").bags[0].status, "ready")
  db = applyOutings(db, "2026-11-12")
  const child = db.bags[0]
  assert.equal(child.status, "emptying")
  assert.deepEqual(visibleLines(db, child).map((line) => line.itemId), [stab.item.id])
  db = markEmptied(db, child.id).db
  assert.equal(db.bags[0].status, "filling")
  db = markFilled(db, child.id).db
  assert.equal(db.bags[0].status, "ready")
  assert.equal(markFilled(applyOutings(db, "2026-11-12"), child.id).db.bags[0].status, "ready")
})

test("tout sortir ne passe pas par à remplir", () => {
  let db = emptyDb()
  const item = createItem(db, "T-shirt")
  db = item.db
  const model = createBagModel(db, "Valise")
  db = model.db
  db = setAfterUse(db, model.model.id, "all").db
  db = setModelLine(db, model.model.id, item.item.id, 2).db
  const bag = createBag(db, "CSE", model.model.id)
  db = bag.db
  const trip = createDepartureModel(db, "Avion")
  db = trip.db
  db = toggleDepartureBag(db, trip.model.id, bag.bag.id).db
  db = createDeparture(db, "Juin", trip.model.id, "once", "2026-08-12", "2026-08-20", "", "2026-06-01").db
  db = applyOutings(db, "2026-08-21")
  assert.equal(db.bags[0].status, "emptying")
  assert.equal(visibleLines(db, db.bags[0]).length, 1)
  db = markEmptied(db, bag.bag.id).db
  assert.equal(db.bags[0].status, "ready")
  assert.equal(agendaEvents(db, "2026-08-22").some((event) => event.kind === "bag"), false)
})

test("un sac qui reste prêt ne change pas d'état", () => {
  let db = emptyDb()
  const model = createBagModel(db, "Cabine")
  db = model.db
  const bag = createBag(db, "Cabine", model.model.id)
  db = bag.db
  const wet = createBagModel(db, "Plongée")
  db = wet.db
  db = setAfterUse(db, wet.model.id, "all").db
  const gear = createBag(db, "Matos", wet.model.id)
  db = gear.db
  const trip = createDepartureModel(db, "Club")
  db = trip.db
  db = toggleDepartureBag(db, trip.model.id, bag.bag.id).db
  db = toggleDepartureBag(db, trip.model.id, gear.bag.id).db
  db = createDeparture(db, "Sortie", trip.model.id, "once", "2026-11-01", "2026-11-02", "", "2026-11-01").db
  db = applyOutings(db, "2026-11-03")
  assert.equal(db.bags.find((entry) => entry.id === bag.bag.id).status, "ready")
  assert.equal(db.bags.find((entry) => entry.id === gear.bag.id).status, "emptying")
})

test("le récurrent attend le lendemain du jour, puis la semaine suivante", () => {
  let db = emptyDb()
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setAfterUse(db, model.model.id, "all").db
  const bag = createBag(db, "Mardi", model.model.id)
  db = bag.db
  const trip = createDepartureModel(db, "Club")
  db = trip.db
  db = toggleDepartureBag(db, trip.model.id, bag.bag.id).db
  db = createDeparture(db, "Semaine", trip.model.id, "recurring", "", "", "3", "2026-11-11").db
  assert.equal(db.departures[0].start, null)
  assert.equal(db.departures[0].end, null)
  db = applyOutings(db, "2026-11-11")
  assert.equal(db.bags[0].status, "ready")
  db = applyOutings(db, "2026-11-12")
  assert.equal(db.bags[0].status, "emptying")
  db = markEmptied(db, bag.bag.id).db
  db = applyOutings(db, "2026-11-18")
  assert.equal(db.bags[0].status, "ready")
  db = applyOutings(db, "2026-11-19")
  assert.equal(db.bags[0].status, "emptying")
})

test("une date impossible est refusée", () => {
  let db = emptyDb()
  const trip = createDepartureModel(db, "Club")
  db = trip.db
  assert.ok(createDeparture(db, "X", trip.model.id, "once", "2026-11-10", "2026-11-01", "").error)
  assert.ok(createDeparture(db, "X", trip.model.id, "once", "", "", "").error)
  assert.ok(createDeparture(db, "X", trip.model.id, "recurring", "", "", "").error)
  assert.ok(createDeparture(db, "X", trip.model.id, "recurring", "", "", "9").error)
  assert.ok(createDeparture(db, "X", "absent", "once", "2026-11-01", "2026-11-02", "").error)
})

test("la fois suivante n'existe pas tant que la précédente n'est pas cochée", () => {
  let db = emptyDb()
  const trip = createDepartureModel(db, "Paris")
  db = trip.db
  db = addDepartureAction(db, trip.model.id, "Badge", 1).db
  db = createDeparture(db, "Mercredi", trip.model.id, "recurring", "", "", "3", "2026-11-11").db
  const action = db.departureModels[0].actions[0]
  const departure = db.departures[0]
  assert.equal(actionDate(departure, action, "2026-11-12"), "2026-11-10")
  let events = agendaEvents(db, "2026-11-12")
  assert.equal(events.filter((event) => event.kind === "action").length, 1)
  db = toggleDepartureAction(db, departure.id, action.id, "2026-11-12").db
  events = agendaEvents(db, "2026-11-12")
  assert.equal(events.filter((event) => event.kind === "action").length, 0)
  assert.equal(actionDate(db.departures[0], action, "2026-11-16"), "2026-11-17")
  assert.equal(agendaEvents(db, "2026-11-16").some((event) => event.kind === "action"), false)
  assert.equal(agendaEvents(db, "2026-11-17").some((event) => event.title === "Badge"), true)
  db = toggleDepartureAction(db, departure.id, action.id, "2026-11-17").db
  assert.equal(agendaEvents(db, "2026-11-20").some((event) => event.title === "Badge"), false)
  assert.equal(agendaEvents(db, "2026-11-24").some((event) => event.title === "Badge"), true)
})

test("passer le jour ne retire pas une action non cochée", () => {
  let db = emptyDb()
  const trip = createDepartureModel(db, "Avion")
  db = trip.db
  db = addDepartureAction(db, trip.model.id, "Papiers", 30).db
  db = createDeparture(db, "CSE", trip.model.id, "once", "2026-08-12", "2026-08-20", "", "2026-06-01").db
  const action = db.departureModels[0].actions[0]
  assert.equal(agendaEvents(db, "2026-07-13").some((event) => event.title === "Papiers"), true)
  assert.equal(agendaEvents(db, "2026-08-01").some((event) => event.title === "Papiers"), true)
  db = toggleDepartureAction(db, db.departures[0].id, action.id, "2026-08-01").db
  assert.equal(agendaEvents(db, "2026-08-02").some((event) => event.title === "Papiers"), false)
})

test("l'agenda dit l'état du sac et jamais son contenu", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setAfterUse(db, model.model.id, "marked").db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const bag = createBag(db, "Plongée du mardi", model.model.id)
  db = bag.db
  const trip = createDepartureModel(db, "Club")
  db = trip.db
  db = toggleDepartureBag(db, trip.model.id, bag.bag.id).db
  db = createDeparture(db, "Sortie", trip.model.id, "once", "2026-11-01", "2026-11-02", "", "2026-11-01").db
  db = applyOutings(db, "2026-11-03")
  const titles = agendaEvents(db, "2026-11-04").map((event) => event.title)
  assert.deepEqual(titles, ["Plongée du mardi, à vider"])
  assert.equal(titles.join(" ").includes("Masque"), false)
  db = markEmptied(db, bag.bag.id).db
  assert.deepEqual(agendaEvents(db, "2026-11-05").map((event) => event.title), ["Plongée du mardi, à remplir"])
  db = markFilled(db, bag.bag.id).db
  assert.deepEqual(agendaEvents(db, "2026-11-06"), [])
})

test("vider depuis rempli ne fait rien, et remplir depuis à vider non plus", () => {
  let db = emptyDb()
  const model = createBagModel(db, "Valise")
  db = model.db
  db = setAfterUse(db, model.model.id, "all").db
  const bag = createBag(db, "CSE", model.model.id)
  db = bag.db
  assert.equal(markEmptied(db, bag.bag.id).db.bags[0].status, "ready")
  db.bags[0] = { ...db.bags[0], status: "emptying" }
  assert.equal(markFilled(db, bag.bag.id).db.bags[0].status, "emptying")
})

test("supprimer retire les liens", () => {
  let db = emptyDb()
  const model = createBagModel(db, "Cabine")
  db = model.db
  const bag = createBag(db, "Cabine", model.model.id)
  db = bag.db
  const trip = createDepartureModel(db, "Avion")
  db = trip.db
  db = addDepartureAction(db, trip.model.id, "Papiers", 1).db
  db = toggleDepartureBag(db, trip.model.id, bag.bag.id).db
  db = createDeparture(db, "Juin", trip.model.id, "once", "2026-08-12", "2026-08-20", "", "2026-06-01").db
  db = toggleDepartureAction(db, db.departures[0].id, db.departureModels[0].actions[0].id, "2026-08-11").db
  db = removeDepartureAction(db, trip.model.id, db.departureModels[0].actions[0].id).db
  assert.equal(db.departureModels[0].actions.length, 0)
  assert.deepEqual(db.departures[0].done, {})
  db = deleteBag(db, bag.bag.id).db
  assert.deepEqual(departureBagIds(db, db.departures[0]), [])
  const other = createBagModel(db, "Soute")
  db = other.db
  const hold = createBag(db, "Soute", other.model.id)
  db = hold.db
  db = toggleDepartureBag(db, trip.model.id, hold.bag.id).db
  db = deleteBagModel(db, other.model.id).db
  assert.equal(db.bags.some((entry) => entry.id === hold.bag.id), false)
  assert.deepEqual(db.departureModels[0].bagIds, [])
  db = deleteDepartureModel(db, trip.model.id).db
  assert.equal(db.departures.length, 0)
  assert.equal(db.departureModels.length, 0)
})

test("la sauvegarde revient identique", () => {
  const storage = { value: null, getItem() { return this.value }, setItem(_key, value) { this.value = value } }
  let db = emptyDb()
  db = createItem(db, "Masque").db
  save(db, storage)
  const loaded = load(storage)
  assert.equal(loaded.items[0].name, "Masque")
  assert.deepEqual(loaded.departures, [])
})
