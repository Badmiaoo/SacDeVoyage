import test from "node:test"
import assert from "node:assert/strict"
import { save, emptyDb, renameItem } from "./store.js"
import { PERSONAL_SEED, personalDb, openDb } from "./personal.js"

function memory() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

function lines(db, name) {
  const model = db.bagModels.find((entry) => entry.name === name)
  return model.lines.map((line) => db.items.find((item) => item.id === line.itemId).name)
}

test("les trois listes sont là, sans les anciennes données", () => {
  const db = personalDb()
  assert.equal(db.seed, PERSONAL_SEED)
  assert.deepEqual(lines(db, "Départ maison"), [
    "Vider frigo / boite a pain / placard / fruit",
    "Vider poubelle",
    "Fermer fenêtre",
    "Laisser portes ouvertes",
    "Laver et vider la machine à café",
    "Faire le lit",
    "Tirer la chasse (lol)",
    "Vider compost",
    "Débrancher noopy",
    "Couper le chauffage ou le mettre en mode absence",
  ])
  assert.equal(lines(db, "Trousse de secours").length, 16)
  assert.equal(lines(db, "Trousse de secours")[0], "Ibuprofene")
  assert.equal(lines(db, "Trousse de secours").at(-1), "Anti histaminique")
  assert.equal(lines(db, "Voyage").includes("cadenas TSA"), true)
  assert.equal(lines(db, "Voyage").includes("Airtag (chipolo)"), true)
  assert.equal(lines(db, "Voyage").includes("Doliprane"), false)
  assert.equal(lines(db, "Absence chat").length, 8)
  assert.deepEqual(lines(db, "Shaé part"), [
    "Désactivé machine à croquettes",
    "Débrancher et vider la fontaine",
    "Nettoyer la litière",
  ])
  assert.equal(db.items.filter((item) => item.name === "Nettoyer la litière").length, 1)
  assert.equal(db.bags.every((bag) => Object.keys(bag.checks).length === 0), true)
  assert.equal(db.departures.length, 6)
  const voyage = db.departureModels.find((model) => model.name === "Voyage")
  const names = voyage.bagIds.map((id) => db.bags.find((bag) => bag.id === id).name)
  assert.deepEqual(names, ["Trousse de secours", "Trousse longue", "Voyage"])
  assert.equal(db.departureModels.find((model) => model.name === "Départ maison").actions.length, 1)
})

test("ouvrir remplace un ancien fichier, puis garde les changements", () => {
  const storage = memory()
  save({ ...emptyDb(), items: [{ id: "x", name: "Ancien" }] }, storage)
  const fresh = openDb(storage)
  assert.equal(fresh.items.some((item) => item.name === "Ancien"), false)
  assert.equal(fresh.items.some((item) => item.name === "Doliprane"), true)
  const doliprane = fresh.items.find((item) => item.name === "Doliprane")
  save(renameItem(fresh, doliprane.id, "Doliprane 1000").db, storage)
  assert.equal(openDb(storage).items.some((item) => item.name === "Doliprane 1000"), true)
})
