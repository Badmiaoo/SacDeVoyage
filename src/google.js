import { agendaEvents } from "./store.js?v=16"
import { planCalendar, applyPlan } from "./agenda.js"

export const CALENDAR_NAME = "Sac de voyage"
export const googleClientId = "941689566479-ltnmiihth5sfld922e61rscp5b74k1fv.apps.googleusercontent.com"
export const redirectUri = "https://badmiaoo.github.io/SacDeVoyage/"
const API = "https://www.googleapis.com/calendar/v3"
const SESSION = "sac-google-session"
const PENDING = "sac-google-pending"

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

export function sessionUsable(session, now = Date.now()) {
  if (!session?.accessToken) return false
  if (session.expiresAt == null) return true
  return session.expiresAt > now + 60_000
}

export function dropAuthQuery(href) {
  const url = new URL(href)
  if (!url.searchParams.has("code") && !url.searchParams.has("error")) return null
  url.search = ""
  return `${url.pathname}${url.hash}`
}

export function openGoogleConsent(google, { clientId, scope, prompt, onSession, onError }) {
  const client = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope,
    callback: (response) => {
      if (response.error || !response.access_token) {
        onError(response.error || "Google n'a pas donné de jeton.")
        return
      }
      onSession({
        accessToken: response.access_token,
        expiresAt: Date.now() + Number(response.expires_in || 3600) * 1000,
      })
    },
    error_callback: () => onError("Connexion annulée."),
  })
  client.requestAccessToken({ prompt })
}

export function loadSession(storage) {
  const raw = storage.getItem(SESSION)
  if (!raw) return null
  return JSON.parse(raw)
}

export function saveSession(session, storage) {
  storage.setItem(SESSION, JSON.stringify(session))
}

function base64url(bytes) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

export async function beginAuth({ clientId, redirect, storage, randomState }) {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const verifier = base64url(bytes)
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  const challenge = base64url(new Uint8Array(digest))
  const state = randomState()
  storage.setItem(PENDING, JSON.stringify({ verifier, state }))
  return authUrl({ clientId, redirect, challenge, state })
}

export async function completeAuth({ href, clientId, redirect, storage, fetch }) {
  const url = new URL(href)
  const code = url.searchParams.get("code")
  if (!code) {
    if (!url.searchParams.get("error")) return null
    url.search = ""
    return { href: `${url.pathname}${url.hash}`, error: true }
  }
  const pending = JSON.parse(storage.getItem(PENDING) || "null")
  if (!pending || pending.state !== url.searchParams.get("state")) throw new Error("Retour Google refusé.")
  const tokens = await exchangeCode({ fetch, clientId, code, verifier: pending.verifier, redirect })
  if (!tokens.accessToken) throw new Error("Google n'a pas donné de jeton.")
  const session = {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  }
  saveSession(session, storage)
  storage.removeItem(PENDING)
  url.search = ""
  return { session, href: `${url.pathname}${url.hash}` }
}

export async function refreshSession({ fetch, clientId, storage }) {
  const session = loadSession(storage)
  if (!session?.accessToken) return null
  if (sessionUsable(session)) return session
  if (!session.refreshToken) return null
  const body = new URLSearchParams({
    client_id: clientId,
    refresh_token: session.refreshToken,
    grant_type: "refresh_token",
  })
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const json = await response.json()
  if (!json.access_token) throw new Error("Google n'a pas renouvelé le jeton.")
  const next = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || session.refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000,
  }
  saveSession(next, storage)
  return next
}
