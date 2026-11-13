import test from "node:test"
import assert from "node:assert/strict"
import { googleClientId, redirectUri, beginAuth, completeAuth, refreshSession, sessionUsable, openGoogleConsent, dropAuthQuery } from "./google.js"

function memory() {
  const data = new Map()
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  }
}

test("l'identifiant et le retour sont ceux déclarés chez Google", () => {
  assert.equal(googleClientId, "941689566479-ltnmiihth5sfld922e61rscp5b74k1fv.apps.googleusercontent.com")
  assert.equal(redirectUri, "https://badmiaoo.github.io/SacDeVoyage/")
})

test("relier garde le vérificateur et part sans secret", async () => {
  const storage = memory()
  const url = await beginAuth({
    clientId: googleClientId,
    redirect: redirectUri,
    storage,
    randomState: () => "state-1",
  })
  assert.equal(url.includes("client_id=941689566479-ltnmiihth5sfld922e61rscp5b74k1fv.apps.googleusercontent.com"), true)
  assert.equal(url.includes(encodeURIComponent(redirectUri)), true)
  assert.equal(url.includes("client_secret"), false)
  const pending = JSON.parse(storage.getItem("sac-google-pending"))
  assert.equal(pending.state, "state-1")
  assert.equal(/^[A-Za-z0-9_-]+$/.test(pending.verifier), true)
  assert.equal(url.includes(pending.verifier), false)
})

test("le retour enregistre le jeton et retire le code de l'adresse", async () => {
  const storage = memory()
  await beginAuth({ clientId: googleClientId, redirect: redirectUri, storage, randomState: () => "state-1" })
  const pending = JSON.parse(storage.getItem("sac-google-pending"))
  let sent = ""
  const fetch = async (_url, options) => {
    sent = String(options.body)
    return { json: async () => ({ access_token: "a", refresh_token: "r", expires_in: 3600 }) }
  }
  const back = await completeAuth({
    href: "https://badmiaoo.github.io/SacDeVoyage/?code=abc&state=state-1#/departs",
    clientId: googleClientId,
    redirect: redirectUri,
    storage,
    fetch,
  })
  assert.equal(sent.includes(`code_verifier=${pending.verifier}`), true)
  assert.equal(sent.includes("client_secret"), false)
  assert.equal(JSON.parse(storage.getItem("sac-google-session")).accessToken, "a")
  assert.equal(storage.getItem("sac-google-pending"), null)
  assert.equal(back.href.includes("code="), false)
  assert.equal(back.href.endsWith("#/departs"), true)
})

test("un retour qui ne correspond pas n'enregistre rien", async () => {
  const storage = memory()
  await beginAuth({ clientId: googleClientId, redirect: redirectUri, storage, randomState: () => "state-1" })
  await assert.rejects(() => completeAuth({
    href: "https://badmiaoo.github.io/SacDeVoyage/?code=abc&state=autre",
    clientId: googleClientId,
    redirect: redirectUri,
    storage,
    fetch: async () => { throw new Error("ne pas appeler") },
  }))
  assert.equal(storage.getItem("sac-google-session"), null)
})

test("un jeton expiré est renouvelé sans secret", async () => {
  const storage = memory()
  storage.setItem("sac-google-session", JSON.stringify({ accessToken: "old", refreshToken: "r", expiresAt: 0 }))
  let sent = ""
  const fetch = async (_url, options) => {
    sent = String(options.body)
    return { json: async () => ({ access_token: "new", expires_in: 3600 }) }
  }
  const session = await refreshSession({ fetch, clientId: googleClientId, storage })
  assert.equal(session.accessToken, "new")
  assert.equal(session.refreshToken, "r")
  assert.equal(sent.includes("refresh_token=r"), true)
  assert.equal(sent.includes("client_secret"), false)
})

test("une session expirée sans jeton de suite n'est plus utilisable", () => {
  assert.equal(sessionUsable({ accessToken: "a", expiresAt: Date.now() + 3_600_000 }), true)
  assert.equal(sessionUsable({ accessToken: "a", expiresAt: 0 }), false)
  assert.equal(sessionUsable(null), false)
})

test("le bouton ouvre Google sans secret", () => {
  const calls = []
  let session = null
  let error = ""
  const google = {
    accounts: {
      oauth2: {
        initTokenClient: (config) => {
          calls.push(config)
          return { requestAccessToken: (options) => calls.push(options) }
        },
      },
    },
  }
  openGoogleConsent(google, {
    clientId: googleClientId,
    scope: "https://www.googleapis.com/auth/calendar",
    prompt: "consent",
    onSession: (value) => { session = value },
    onError: (message) => { error = message },
  })
  assert.equal(calls[0].client_id, googleClientId)
  assert.equal(calls[0].scope, "https://www.googleapis.com/auth/calendar")
  assert.equal(JSON.stringify(calls).includes("client_secret"), false)
  assert.deepEqual(calls[1], { prompt: "consent" })
  calls[0].callback({ access_token: "jeton", expires_in: 3600 })
  assert.equal(session.accessToken, "jeton")
  assert.equal(session.expiresAt > Date.now(), true)
  calls[0].callback({ error: "access_denied" })
  assert.equal(error, "access_denied")
})

test("un vieux retour Google est retiré de l'adresse", () => {
  assert.equal(
    dropAuthQuery("https://badmiaoo.github.io/SacDeVoyage/?code=abc&state=xyz#/departs"),
    "/SacDeVoyage/#/departs",
  )
  assert.equal(dropAuthQuery("https://badmiaoo.github.io/SacDeVoyage/#/departs"), null)
})
