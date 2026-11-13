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
  addBagLine,
  removeBagLine,
  resolveLines,
  createDepartureModel,
  addDepartureAction,
  createDeparture,
  toggleDepartureAction,
  updateDepartureAction,
  updateDeparture,
  exportData,
  importData,
  gapNames,
  actionDate,
  save,
  load,
} from "./store.js"
import { clearSession, saveSession } from "./google.js"

test("modifier une action garde la coche et change le jour", () => {
  let db = emptyDb()
  const model = createDepartureModel(db, "Paris")
  db = model.db
  db = addDepartureAction(db, model.model.id, "Badge", 1).db
  const action = db.departureModels[0].actions[0]
  db = createDeparture(db, "Mercredi", model.model.id, "recurring", "", "", "3", "2026-11-11").db
  db = toggleDepartureAction(db, db.departures[0].id, action.id, "2026-11-12").db
  const edited = updateDepartureAction(db, model.model.id, action.id, "  Carte  ", 0)
  assert.equal(edited.error, undefined)
  db = edited.db
  const next = db.departureModels[0].actions[0]
  assert.equal(next.label, "Carte")
  assert.equal(next.id, action.id)
  assert.equal(db.departures[0].done[action.id], "2026-11-11")
  assert.equal(actionDate(db.departures[0], next, "2026-11-18"), "2026-11-18")
  assert.equal(updateDepartureAction(db, model.model.id, action.id, "  ", 1).error, "Le nom est vide.")
  assert.equal(db.departureModels[0].actions[0].label, "Carte")
})

test("modifier les dates ne perd pas les coches", () => {
  let db = emptyDb()
  const model = createDepartureModel(db, "CSE")
  db = model.db
  db = addDepartureAction(db, model.model.id, "Papiers", 30).db
  const action = db.departureModels[0].actions[0]
  const trip = createDeparture(db, "Juin", model.model.id, "once", "2026-08-12", "2026-08-20", "", "2026-06-01")
  db = trip.db
  db = toggleDepartureAction(db, trip.departure.id, action.id, "2026-07-13").db
  const bad = updateDeparture(db, trip.departure.id, "once", "2026-08-20", "2026-08-12", "")
  assert.equal(bad.error, "Il faut un début et une fin.")
  assert.equal(bad.db.departures[0].start, "2026-08-12")
  db = updateDeparture(db, trip.departure.id, "once", "2026-08-10", "2026-08-22", "").db
  assert.equal(db.departures[0].start, "2026-08-10")
  assert.equal(db.departures[0].end, "2026-08-22")
  assert.equal(db.departures[0].done[action.id], "2026-08-10")
  db = updateDeparture(db, trip.departure.id, "recurring", "", "", "2").db
  assert.equal(db.departures[0].kind, "recurring")
  assert.equal(db.departures[0].weekday, 2)
  assert.equal(db.departures[0].start, null)
  assert.equal(updateDeparture(db, trip.departure.id, "recurring", "", "", "9").error, "Il faut un jour.")
})

test("une copie revient identique, un fichier cassé est refusé", () => {
  let db = emptyDb()
  db = createItem(db, "Masque").db
  const copy = exportData(db)
  const back = importData(copy)
  assert.equal(back.error, undefined)
  assert.deepEqual(back.db.items.map((item) => item.name), ["Masque"])
  assert.equal(importData("{").error, "Ce fichier n'est pas lisible.")
  assert.equal(importData("{\"items\":[]}").error, "Ce fichier n'est pas une sauvegarde.")
  const storage = { value: "", getItem: () => storage.value, setItem: (_key, value) => { storage.value = value } }
  save(back.db, storage)
  assert.deepEqual(load(storage).items.map((item) => item.name), ["Masque"])
})

test("à remplir nomme ce qui manque, à vider non", () => {
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
  db = { ...db, bags: db.bags.map((entry) => ({ ...entry, status: "filling", checks: { [masque.item.id]: true } })) }
  assert.deepEqual(gapNames(db, db.bags[0]), ["Stab"])
  db = { ...db, bags: db.bags.map((entry) => ({ ...entry, status: "emptying" })) }
  assert.deepEqual(gapNames(db, db.bags[0]), [])
})

test("une affaire ajoutée au modèle rouvre un sac qui était complet", () => {
  let db = emptyDb()
  const masque = createItem(db, "Masque")
  db = masque.db
  const palmes = createItem(db, "Palmes")
  db = palmes.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, masque.item.id, 1).db
  const bag = createBag(db, "Mardi", model.model.id)
  db = bag.db
  db = toggleCheck(db, bag.bag.id, masque.item.id).db
  assert.deepEqual(gapNames(db, db.bags[0]), [])
  db = setModelLine(db, model.model.id, palmes.item.id, 1).db
  assert.deepEqual(gapNames(db, db.bags[0]), ["Palmes"])
})

test("oublier la connexion retire le jeton", () => {
  const storage = new Map()
  const box = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  }
  saveSession({ accessToken: "a", expiresAt: Date.now() + 999999 }, box)
  clearSession(box)
  assert.equal(box.getItem("sac-google-session"), null)
})

test("retirer un ajout ne retire pas la ligne du modèle", () => {
  let db = emptyDb()
  const masque = createItem(db, "Masque")
  db = masque.db
  const lampe = createItem(db, "Lampe")
  db = lampe.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, masque.item.id, 1).db
  const first = createBag(db, "Mardi", model.model.id)
  db = first.db
  const second = createBag(db, "Jeudi", model.model.id)
  db = second.db
  db = addBagLine(db, first.bag.id, lampe.item.id, 1).db
  db = addBagLine(db, second.bag.id, lampe.item.id, 1).db
  const refused = removeBagLine(db, first.bag.id, masque.item.id)
  assert.equal(refused.error, "Ça vient du modèle.")
  assert.equal(resolveLines(refused.db, refused.db.bags[0]).some((line) => line.itemId === masque.item.id), true)
  db = removeBagLine(db, first.bag.id, lampe.item.id).db
  const tuesday = db.bags.find((bag) => bag.id === first.bag.id)
  const thursday = db.bags.find((bag) => bag.id === second.bag.id)
  assert.equal(resolveLines(db, tuesday).some((line) => line.itemId === lampe.item.id), false)
  assert.equal(resolveLines(db, thursday).some((line) => line.itemId === lampe.item.id), true)
  assert.equal(db.bagModels[0].lines.some((line) => line.itemId === lampe.item.id), false)
})

