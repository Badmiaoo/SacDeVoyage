import test from "node:test"
import assert from "node:assert/strict"
import { calendarBody, readEvent, syncDedicated, googleApi, authUrl, exchangeCode } from "./google.js"
import {
  emptyDb,
  createItem,
  createBagModel,
  setAfterUse,
  setModelLine,
  createBag,
  createDepartureModel,
  addDepartureAction,
  toggleDepartureBag,
  createDeparture,
  toggleDepartureAction,
  applyOutings,
} from "./store.js"

test("le corps envoyé ne contient pas le sac", () => {
  const body = calendarBody({
    key: "action:1:a:2026-11-11",
    summary: "Badge",
    description: "Masque, Stab",
    start: "2026-11-10",
    end: "2026-11-13",
  })
  assert.equal(body.summary, "Badge")
  assert.equal(body.description, "")
  assert.deepEqual(body.start, { date: "2026-11-10" })
  assert.deepEqual(body.end, { date: "2026-11-13" })
  assert.equal(body.extendedProperties.private.app, "sac-de-voyage")
  assert.equal(body.extendedProperties.private.key, "action:1:a:2026-11-11")
  assert.equal(JSON.stringify(body).includes("Masque"), false)
})

test("un événement sans notre clé est ignoré", () => {
  assert.equal(readEvent({ id: "dent", summary: "Dentiste", start: { date: "2026-11-12" }, end: { date: "2026-11-13" } }), null)
  assert.equal(readEvent({
    id: "g1",
    summary: "Badge",
    description: "",
    start: { date: "2026-11-10" },
    end: { date: "2026-11-13" },
    extendedProperties: { private: { app: "sac-de-voyage", key: "action:1" } },
  }).key, "action:1")
})

function memoryGoogle() {
  const state = {
    calendars: [{ id: "perso", summary: "Personnel" }],
    events: { perso: [{ id: "dent", summary: "Dentiste", start: { date: "2026-11-12" }, end: { date: "2026-11-13" } }] },
  }
  return {
    state,
    async listCalendars() {
      return state.calendars
    },
    async createCalendar(name) {
      const calendar = { id: "sac", summary: name }
      state.calendars.push(calendar)
      state.events.sac = []
      return calendar
    },
    async listEvents(id) {
      return state.events[id] || []
    },
    async insertEvent(id, body) {
      const event = { id: `e${state.events[id].length + 1}`, ...body }
      state.events[id].push(event)
      return event
    },
    async patchEvent(id, eventId, body) {
      const index = state.events[id].findIndex((event) => event.id === eventId)
      state.events[id][index] = { ...state.events[id][index], ...body }
    },
    async deleteEvent(id, eventId) {
      state.events[id] = state.events[id].filter((event) => event.id !== eventId)
    },
  }
}

function trip() {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setAfterUse(db, model.model.id, "all").db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  const bag = createBag(db, "Plongée du mardi", model.model.id)
  db = bag.db
  const recipe = createDepartureModel(db, "Paris")
  db = recipe.db
  db = addDepartureAction(db, recipe.model.id, "Badge", 1).db
  db = toggleDepartureBag(db, recipe.model.id, bag.bag.id).db
  db = createDeparture(db, "Mercredi", recipe.model.id, "recurring", "", "", "3", "2026-11-11").db
  return db
}

test("le calendrier dédié est créé, l'autre reste intact", async () => {
  const api = memoryGoogle()
  const db = trip()
  const calendarId = await syncDedicated(db, "2026-11-12", api)
  assert.equal(calendarId, "sac")
  assert.equal(api.state.calendars.filter((calendar) => calendar.summary === "Sac de voyage").length, 1)
  assert.equal(api.state.events.perso.length, 1)
  assert.equal(api.state.events.perso[0].summary, "Dentiste")
  assert.equal(api.state.events.sac.length, 1)
  assert.equal(api.state.events.sac[0].summary, "Badge")
  assert.equal(api.state.events.sac[0].description, "")
  assert.equal(JSON.stringify(api.state.events.sac).includes("Masque"), false)
  await syncDedicated(db, "2026-11-12", api)
  assert.equal(api.state.calendars.filter((calendar) => calendar.summary === "Sac de voyage").length, 1)
  assert.equal(api.state.events.sac.length, 1)
})

test("le lendemain allonge, cocher retire, le sac à vider n'a pas son contenu", async () => {
  const api = memoryGoogle()
  let db = trip()
  await syncDedicated(db, "2026-11-12", api)
  await syncDedicated(db, "2026-11-13", api)
  assert.equal(api.state.events.sac.length, 1)
  assert.deepEqual(api.state.events.sac[0].start, { date: "2026-11-10" })
  assert.deepEqual(api.state.events.sac[0].end, { date: "2026-11-14" })
  const action = db.departureModels[0].actions[0]
  db = toggleDepartureAction(db, db.departures[0].id, action.id, "2026-11-12").db
  db = applyOutings(db, "2026-11-12")
  await syncDedicated(db, "2026-11-12", api)
  const titles = api.state.events.sac.map((event) => event.summary)
  assert.deepEqual(titles, ["Plongée du mardi, à vider"])
  assert.equal(JSON.stringify(api.state.events.sac).includes("Masque"), false)
  assert.equal(api.state.events.perso[0].summary, "Dentiste")
})

test("l'appel Google demande le calendrier dédié et la clé privée", async () => {
  const calls = []
  const fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || "GET", body: options.body, auth: options.headers.Authorization })
    if (String(url).includes("pageToken=p2")) {
      return { json: async () => ({ items: [] }) }
    }
    if (String(url).includes("calendarList")) {
      return { json: async () => ({ items: [{ id: "sac", summary: "Sac de voyage" }], nextPageToken: "p2" }) }
    }
    if (String(url).includes("pageToken=p2")) {
      return { json: async () => ({ items: [] }) }
    }
    if (String(url).includes("calendarList")) {
      return { json: async () => ({ items: [{ id: "sac", summary: "Sac de voyage" }], nextPageToken: "p2" }) }
    }
    if (String(url).includes("/events")) {
      return { json: async () => ({ items: [] }) }
    }
    return { json: async () => ({ id: "new" }) }
  }
  const api = googleApi({ fetch, token: "tok" })
  const calendars = await api.listCalendars()
  assert.equal(calendars.length, 1)
  assert.equal(calls[0].auth, "Bearer tok")
  assert.equal(calls[0].url.includes("/users/me/calendarList"), true)
  assert.equal(calls[1].url.includes("pageToken=p2"), true)
  await api.listEvents("sac")
  assert.equal(calls.at(-1).url.includes("privateExtendedProperty=app%3Dsac-de-voyage"), true)
  await api.insertEvent("sac", calendarBody({ key: "bag:1:emptying", summary: "Plongée, à vider", start: "2026-11-12", end: "2026-11-13" }))
  const sent = JSON.parse(calls.at(-1).body)
  assert.equal(sent.description, "")
  assert.equal(sent.extendedProperties.private.key, "bag:1:emptying")
  assert.equal(calls.at(-1).method, "POST")
})

test("la connexion ne demande pas de secret", async () => {
  const url = authUrl({
    clientId: "client",
    redirect: "https://badmiaoo.github.io/SacDeVoyage/",
    challenge: "abc",
    state: "xyz",
  })
  assert.equal(url.startsWith("https://accounts.google.com/o/oauth2/v2/auth?"), true)
  assert.equal(url.includes("client_id=client"), true)
  assert.equal(url.includes("code_challenge=abc"), true)
  assert.equal(url.includes("code_challenge_method=S256"), true)
  assert.equal(url.includes(encodeURIComponent("https://www.googleapis.com/auth/calendar")), true)
  assert.equal(url.includes("client_secret"), false)
  assert.throws(() => authUrl({ clientId: "", redirect: "https://x", challenge: "a", state: "b" }))
  let sent = ""
  const fetch = async (_url, options) => {
    sent = String(options.body)
    return { json: async () => ({ access_token: "a", refresh_token: "r", expires_in: 3600 }) }
  }
  const tokens = await exchangeCode({ fetch, clientId: "client", code: "code", verifier: "ver", redirect: "https://badmiaoo.github.io/SacDeVoyage/" })
  assert.equal(tokens.accessToken, "a")
  assert.equal(tokens.refreshToken, "r")
  assert.equal(sent.includes("client_secret"), false)
  assert.equal(sent.includes("code_verifier=ver"), true)
})
