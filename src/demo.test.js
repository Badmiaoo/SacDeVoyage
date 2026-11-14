import test from "node:test"
import assert from "node:assert/strict"
import { personalDb } from "./personal.js"
import { applyOutings, resolveLines, agendaEvents, listedActions } from "./store.js"

test("la maquette couvre les cas", () => {
  const db = personalDb()
  const names = db.bags.map((bag) => bag.name)
  assert.equal(names.includes("Plongée du mardi"), true)
  assert.equal(names.includes("Trousse courte"), true)
  assert.equal(names.includes("Trousse longue"), true)
  assert.equal(names.includes("Sac à dos"), true)
  const brush = db.items.find((item) => item.name === "Brosse à dents")
  const withBrush = ["Trousse courte", "Trousse longue", "Voyage"].every((name) =>
    resolveLines(db, db.bags.find((bag) => bag.name === name)).some((line) => line.itemId === brush.id),
  )
  assert.equal(withBrush, true)
  const voyage = db.bags.find((bag) => bag.name === "Voyage")
  assert.equal(resolveLines(db, voyage).find((line) => line.itemId === db.items.find((item) => item.name === "Chaussettes").id).qty, 5)
  const pack = db.bags.find((bag) => bag.name === "Sac à dos")
  assert.equal(resolveLines(db, pack).some((line) => db.items.find((item) => item.id === line.itemId).name === "cadenas TSA"), false)
  const dive = db.bagModels.find((model) => model.name === "Plongée")
  assert.equal(dive.afterUse, "marked")
  assert.equal(dive.lines.filter((line) => line.removeAfter).length, 4)
  assert.equal(db.bagModels.find((model) => model.name === "Voyage").lines.some((line) => line.group === "Tech"), true)
  assert.equal(db.departures.find((entry) => entry.name === "CSE décembre").end, "2026-12-27")
  assert.equal(db.departures.find((entry) => entry.name === "Paris mercredi").weekday, 3)
  const live = applyOutings(db, "2026-11-14")
  assert.equal(live.bags.find((bag) => bag.name === "Plongée du mardi").status, "emptying")
  assert.equal(live.bags.find((bag) => bag.name === "Week-end").status, "emptying")
  assert.equal(live.bags.find((bag) => bag.name === "Voyage").status, "ready")
  const due = listedActions(live, "2026-11-14").filter((row) => row.due)
  assert.equal(due.some((row) => row.label === "Gonfler le stab"), true)
  assert.equal(agendaEvents(live, "2026-11-14").some((event) => event.title.includes("à vider")), true)
})
