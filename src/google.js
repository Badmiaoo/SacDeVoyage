import { agendaEvents } from "./store.js"
import { planCalendar, applyPlan } from "./agenda.js"

export const CALENDAR_NAME = "Sac de voyage"
export const googleClientId = ""
const API = "https://www.googleapis.com/calendar/v3"
const SESSION = "sac-google-session"

export function calendarBody(event) {
  return {
    summary: event.summary,
    description: "",
    start: { date: event.start },
    end: { date: event.end },
    extendedProperties: { private: { app: "sac-de-voyage", key: event.key } },
  }
}

export function readEvent(event) {
  const key = event.extendedProperties?.private?.key
  const start = event.start?.date
  const end = event.end?.date
  if (!key || !start || !end) return null
  return {
    id: event.id,
    key,
    summary: event.summary,
    description: event.description || "",
    start,
    end,
  }
}

export async function syncDedicated(db, today, api) {
  const calendars = await api.listCalendars()
  let calendar = calendars.find((entry) => entry.summary === CALENDAR_NAME)
  if (!calendar) calendar = await api.createCalendar(CALENDAR_NAME)
  const existing = (await api.listEvents(calendar.id)).map(readEvent).filter(Boolean)
  const plan = planCalendar(agendaEvents(db, today), existing, today)
  await applyPlan(plan, {
    remove: (id) => api.deleteEvent(calendar.id, id),
    create: (event) => api.insertEvent(calendar.id, calendarBody(event)),
    update: (event) => api.patchEvent(calendar.id, event.id, calendarBody(event)),
  })
  return calendar.id
}

export function googleApi({ fetch, token }) {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  async function getAll(url) {
    const items = []
    let next = url
    const seen = new Set()
    while (next && !seen.has(next)) {
      seen.add(next)
      const response = await fetch(next, { headers })
      const json = await response.json()
      items.push(...(json.items || []))
      if (!json.nextPageToken) break
      const page = new URL(next)
      page.searchParams.set("pageToken", json.nextPageToken)
      next = page.toString()
    }
    return items
  }
  const events = (id) => `${API}/calendars/${encodeURIComponent(id)}/events`
  return {
    listCalendars: () => getAll(`${API}/users/me/calendarList`),
    async createCalendar(name) {
      const response = await fetch(`${API}/calendars`, { method: "POST", headers, body: JSON.stringify({ summary: name }) })
      return response.json()
    },
    listEvents: (id) => getAll(`${events(id)}?privateExtendedProperty=app%3Dsac-de-voyage`),
    async insertEvent(id, body) {
      const response = await fetch(events(id), { method: "POST", headers, body: JSON.stringify(body) })
      return response.json()
    },
    async patchEvent(id, eventId, body) {
      const response = await fetch(`${events(id)}/${encodeURIComponent(eventId)}`, { method: "PATCH", headers, body: JSON.stringify(body) })
      return response.json()
    },
    async deleteEvent(id, eventId) {
      await fetch(`${events(id)}/${encodeURIComponent(eventId)}`, { method: "DELETE", headers })
    },
  }
}

export function authUrl({ clientId, redirect, challenge, state }) {
  if (!clientId) throw new Error("Pas d'identifiant Google.")
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", redirect)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar")
  url.searchParams.set("code_challenge", challenge)
  url.searchParams.set("code_challenge_method", "S256")
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent")
  url.searchParams.set("state", state)
  return url.toString()
}

export async function exchangeCode({ fetch, clientId, code, verifier, redirect }) {
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    code_verifier: verifier,
    redirect_uri: redirect,
    grant_type: "authorization_code",
  })
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const json = await response.json()
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresIn: json.expires_in }
}

export function loadSession(storage) {
  const raw = storage.getItem(SESSION)
  if (!raw) return null
  return JSON.parse(raw)
}

export function saveSession(session, storage) {
  storage.setItem(SESSION, JSON.stringify(session))
}
