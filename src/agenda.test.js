import test from "node:test"
import assert from "node:assert/strict"
import { planCalendar, applyPlan } from "./agenda.js"
import {
  emptyDb,
  createItem,
  createBagModel,
  setAfterUse,
  setModelLine,
  createBag,
  createDepartureModel,
  toggleDepartureBag,
  addDepartureAction,
  createDeparture,
  toggleDepartureAction,
  applyOutings,
  agendaEvents,
} from "./store.js"

test("un événement nouveau part du jour prévu et couvre aujourd'hui", () => {
  const desired = [{ key: "action:1:a:2026-11-11", title: "Badge", since: "2026-11-10" }]
  const plan = planCalendar(desired, [], "2026-11-12")
  assert.equal(plan.creates.length, 1)
  assert.equal(plan.updates.length, 0)
  assert.equal(plan.deletes.length, 0)
  assert.deepEqual(plan.creates[0], {
    key: "action:1:a:2026-11-11",
    summary: "Badge",
    description: "",
    start: "2026-11-10",
    end: "2026-11-13",
  })
})

test("le lendemain allonge le même événement", () => {
  const desired = [{ key: "action:1:a:2026-11-11", title: "Badge", since: "2026-11-10" }]
  const existing = [{ id: "g1", key: "action:1:a:2026-11-11", summary: "Badge", description: "", start: "2026-11-10", end: "2026-11-13" }]
  const plan = planCalendar(desired, existing, "2026-11-13")
  assert.equal(plan.creates.length, 0)
  assert.equal(plan.deletes.length, 0)
  assert.equal(plan.updates.length, 1)
  assert.equal(plan.updates[0].id, "g1")
  assert.equal(plan.updates[0].start, "2026-11-10")
  assert.equal(plan.updates[0].end, "2026-11-14")
})

test("cocher supprime, et un autre agenda n'est pas touché", () => {
  const existing = [
    { id: "g1", key: "action:1:a:2026-11-11", summary: "Badge", description: "", start: "2026-11-10", end: "2026-11-13" },
    { id: "perso", summary: "Dentiste", start: "2026-11-12", end: "2026-11-13" },
  ]
  const plan = planCalendar([], existing, "2026-11-13")
  assert.deepEqual(plan.deletes.map((event) => event.id), ["g1"])
  assert.equal(plan.creates.length, 0)
})

test("le rappel du sac garde son premier jour", () => {
  const desired = [{ key: "bag:1:emptying", title: "Plongée du mardi, à vider", since: "2026-11-13" }]
  const existing = [{ id: "g2", key: "bag:1:emptying", summary: "Plongée du mardi, à vider", description: "", start: "2026-11-12", end: "2026-11-13" }]
  const plan = planCalendar(desired, existing, "2026-11-13")
  assert.equal(plan.creates.length, 0)
  assert.equal(plan.updates[0].start, "2026-11-12")
  assert.equal(plan.updates[0].end, "2026-11-14")
  assert.equal(plan.updates[0].summary.includes("Masque"), false)
})

test("vider le sac remplace à vider par à remplir", () => {
  const desired = [{ key: "bag:1:filling", title: "Plongée du mardi, à remplir", since: "2026-11-14" }]
  const existing = [{ id: "g2", key: "bag:1:emptying", summary: "Plongée du mardi, à vider", description: "", start: "2026-11-12", end: "2026-11-14" }]
  const plan = planCalendar(desired, existing, "2026-11-14")
  assert.deepEqual(plan.deletes.map((event) => event.id), ["g2"])
  assert.equal(plan.creates[0].summary, "Plongée du mardi, à remplir")
  assert.equal(plan.creates[0].description, "")
})

test("la fois suivante est un autre événement, sans le contenu du sac", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setAfterUse(db, model.model.id, "all").db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const bag = createBag(db, "Plongée du mardi", model.model.id)
  db = bag.db
  const trip = createDepartureModel(db, "Paris")
  db = trip.db
  db = addDepartureAction(db, trip.model.id, "Badge", 1).db
  db = toggleDepartureBag(db, trip.model.id, bag.bag.id).db
  db = createDeparture(db, "Mercredi", trip.model.id, "recurring", "", "", "3", "2026-11-11").db
  const action = db.departureModels[0].actions[0]
  let desired = agendaEvents(db, "2026-11-12")
  assert.equal(desired[0].key.includes(action.id), true)
  assert.equal(JSON.stringify(desired).includes("Masque"), false)
  let plan = planCalendar(desired, [], "2026-11-12")
  const created = { ...plan.creates[0], id: "g1" }
  db = toggleDepartureAction(db, db.departures[0].id, action.id, "2026-11-12").db
  desired = agendaEvents(db, "2026-11-12")
  plan = planCalendar(desired, [created], "2026-11-12")
  assert.deepEqual(plan.deletes.map((event) => event.id), ["g1"])
  desired = agendaEvents(db, "2026-11-17")
  plan = planCalendar(desired, [], "2026-11-17")
  assert.equal(plan.creates.length, 1)
  assert.notEqual(plan.creates[0].key, created.key)
  db = applyOutings(db, "2026-11-12")
  desired = agendaEvents(db, "2026-11-12")
  assert.equal(desired.some((event) => event.title === "Plongée du mardi, à vider"), true)
  assert.equal(JSON.stringify(desired).includes("Masque"), false)
})

test("appliquer parle au calendrier dans l'ordre", async () => {
  const calls = []
  const api = {
    remove: async (id) => calls.push(`remove:${id}`),
    create: async (event) => calls.push(`create:${event.summary}`),
    update: async (event) => calls.push(`update:${event.id}`),
  }
  await applyPlan({
    deletes: [{ id: "g2" }],
    creates: [{ summary: "Badge" }],
    updates: [{ id: "g1" }],
  }, api)
  assert.deepEqual(calls, ["remove:g2", "create:Badge", "update:g1"])
})
