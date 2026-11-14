import {
  save,
  createItem,
  renameItem,
  deleteItem,
  createBagModel,
  setAfterUse,
  setModelLine,
  setModelGroup,
  setRemoveAfter,
  removeModelLine,
  createBag,
  addBagLine,
  removeBagLine,
  excludeBagLine,
  includeBagLine,
  resetBag,
  dueActions,
  listedActions,
  toggleCheck,
  setBagQty,
  markEmptied,
  markFilled,
  visibleLines,
  itemName,
  bagName,
  createDepartureModel,
  toggleDepartureBag,
  addDepartureAction,
  createDeparture,
  toggleDepartureAction,
  actionChecked,
  actionDate,
  applyOutings,
  todayIso,
  deleteBag,
  deleteBagModel,
  deleteDeparture,
  deleteDepartureModel,
  renameBag,
  renameBagModel,
  renameDeparture,
  renameDepartureModel,
  removeDepartureAction,
  departureFields,
  departureBagIds,
  resolveLines,
  agendaEvents,
  missingChecks,
  attention,
  gapNames,
  updateDeparture,
  updateDepartureAction,
  exportData,
  importData,
} from "./store.js?v=20"
import { clearSession, clearDedicated, dropAuthQuery, googleApi, googleClientId, loadSession, openGoogleConsent, refreshSession, saveSession, sessionUsable, syncDedicated } from "./google.js"
import { formatDay, formatLine } from "./text.js"
import { openDb, personalDb } from "./personal.js?v=22"

const app = document.querySelector("#app")
let departureKind = "once"
let departureDraft = { name: "", model: "", start: "", end: "", weekday: "3" }
let db
try {
  db = applyOutings(openDb(localStorage), todayIso())
  save(db)
} catch {
  db = personalDb()
  save(db)
}

const afterUseLabel = { stay: "Reste prêt", all: "Tout sortir", marked: "Sortir le marqué" }
const statusLabel = { ready: "Rempli", emptying: "À vider", filling: "À remplir" }
const weekdays = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]

const UNDO = "sac-undo"
const history = JSON.parse(sessionStorage.getItem(UNDO) || "[]")

function remember() {
  sessionStorage.setItem(UNDO, JSON.stringify(history.slice(-20)))
}

function persist(next) {
  history.push(db)
  if (history.length > 20) history.shift()
  remember()
  db = applyOutings(next, todayIso())
  save(db)
  draw()
  void pushAgenda()
}

function undo() {
  const previous = history.pop()
  if (!previous) return
  remember()
  db = previous
  save(db)
  draw()
  void pushAgenda()
}

let agendaChain = Promise.resolve()
let agendaNote = ""

async function pushAgenda() {
  const run = agendaChain.then(() => sendAgenda())
  agendaChain = run.catch(() => {})
  return run
}

async function sendAgenda() {
  if (!googleClientId) return
  try {
    const session = await refreshSession({
      fetch: globalThis.fetch.bind(globalThis),
      clientId: googleClientId,
      storage: localStorage,
    })
    const stored = loadSession(localStorage)
    if (!session?.accessToken) {
      if (stored) {
        agendaNote = "Le jeton Google a expiré. Relie l'agenda."
        draw()
      }
      return
    }
    await syncDedicated(db, todayIso(), googleApi({ fetch: globalThis.fetch.bind(globalThis), token: session.accessToken }))
    if (agendaNote) {
      agendaNote = ""
      draw()
    }
  } catch {
    agendaNote = "L'agenda n'a pas été mis à jour. Réessaie."
    draw()
  }
}

function route() {
  const [path, id] = (location.hash.slice(1) || "/").split("/").filter(Boolean)
  if (!path) return { name: "bags" }
  if (path === "objets") return { name: "items" }
  if (path === "modeles" && id) return { name: "model", id }
  if (path === "modeles") return { name: "models" }
  if (path === "sac" && id) return { name: "bag", id }
  if (path === "departs" && id) return { name: "departure", id }
  if (path === "departs") return { name: "departures" }
  if (path === "dmodele" && id) return { name: "dmodel", id }
  return { name: "bags" }
}

function esc(value) {
  return String(value)
    .replaceAll("\u0026", "\u0026amp;")
    .replaceAll("<", "\u0026lt;")
    .replaceAll(">", "\u0026gt;")
    .replaceAll('"', "\u0026quot;")
}

function layout(title, body) {
  const undo = history.length ? `<button type="button" class="quiet" data-action="undo">Annuler</button>` : ""
  app.innerHTML = `
    <header><p class="brand">Sac de voyage</p><h1>${esc(title)}</h1>${undo}</header>
    <main>${body}</main>
    <nav>
      <a href="#/">Sacs</a>
      <a href="#/departs">Départs</a>
      <a href="#/modeles">Modèles</a>
      <a href="#/objets">Objets</a>
    </nav>`
}

let drawn = ""

function draw() {
  const page = route()
  const key = `${page.name}/${page.id || ""}`
  const keep = key === drawn
  const y = keep ? window.scrollY : 0
  drawn = key
  if (page.name === "items") drawItems()
  else if (page.name === "models") drawModels()
  else if (page.name === "model") drawModel(page.id)
  else if (page.name === "bag") drawBag(page.id)
  else if (page.name === "departures") drawDepartures()
  else if (page.name === "departure") drawDeparture(page.id)
  else if (page.name === "dmodel") drawDepartureModel(page.id)
  else drawBags()
  if (keep) requestAnimationFrame(() => window.scrollTo(0, y))
}

function shownStatus(bag) {
  if (missingChecks(db, bag).length) return "En défaut"
  return statusLabel[bag.status] || ""
}

let homeQuery = ""
let bagQuery = ""
let itemQuery = ""

function matches(name, query) {
  return name.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"))
}

function faultNotice(bag) {
  const names = gapNames(db, bag)
  if (!names.length) return ""
  const shown = names.slice(0, 6).map((name) => esc(name)).join(", ")
  const more = names.length > 6 ? ` et ${names.length - 6} autre${names.length - 6 > 1 ? "s" : ""}` : ""
  if (bag.status === "filling") return `<p class="alert">Pas encore remis : ${shown}${more}</p>`
  if (bag.status === "ready") return `<p class="alert">En défaut. Pas coché : ${shown}${more}</p>`
  return ""
}

function drawBags() {
  const today = todayIso()
  const listed = listedActions(db, today)
  const due = listed.filter((row) => row.due)
  const later = listed.filter((row) => !row.due).slice(0, 3)
  const next = due.length || later.length
    ? `<h2>À faire</h2>${due.map((row) => `<a class="row" href="#/departs/${row.departureId}"><strong>${esc(row.label)}</strong><span>${esc(row.departureName)}</span></a>`).join("")}${later.map((row) => `<a class="row" href="#/departs/${row.departureId}"><strong>${esc(row.label)}</strong><span>${esc(formatDay(row.since))}</span></a>`).join("")}`
    : db.departures.length
      ? ""
      : `<p class="empty">Aucun départ daté. L'agenda reste vide tant qu'il n'y en a pas un.</p>`
  const cards = [...db.bags]
    .filter((bag) => !homeQuery || matches(bag.name, homeQuery))
    .sort((a, b) => attention(db, a) - attention(db, b))
    .map((bag) => {
      const lines = visibleLines(db, bag)
      const done = lines.filter((line) => bag.checks[line.itemId]).length
      const gaps = gapNames(db, bag)
      const detail = gaps.length ? `${shownStatus(bag)} · ${done}/${lines.length}` : `${shownStatus(bag)} · ${lines.length}`
      return `<a class="row" href="#/sac/${bag.id}"><strong>${esc(bag.name)}</strong><span>${esc(detail)}</span></a>`
    })
    .join("")
  const options = db.bagModels.map((model) => `<option value="${model.id}">${esc(model.name)}</option>`).join("")
  const form = db.bagModels.length
    ? `<form data-action="bag">
        <input name="name" placeholder="Nom du sac" required>
        <select name="model">${options}</select>
        <button>Créer le sac</button>
      </form>`
    : `<p class="empty">Crée d'abord un modèle.</p>`
  const search = `<form data-action="find-home"><input name="q" value="${esc(homeQuery)}" placeholder="Chercher un sac"></form>`
  const copy = `<h2>Autre téléphone</h2>
    <p class="empty">Télécharge la copie ici, envoie-la, puis reprends-la là-bas. C'est le seul pont.</p>
    <button type="button" data-action="export">Télécharger une copie</button>
    <form data-action="import"><input name="file" type="file" accept="application/json"><button>Reprendre une copie</button></form>`
  layout("Sacs", `${next}${search}${cards || `<p class="empty">Aucun sac.</p>`}${form}${copy}`)
}

function drawBag(id) {
  const bag = db.bags.find((entry) => entry.id === id)
  if (!bag) return layout("Sac", `<p class="empty">Ce sac n'existe pas.</p>`)
  const query = bagQuery
  const groups = new Map()
  for (const line of visibleLines(db, bag)) {
    if (query && !matches(itemName(db, line.itemId), query)) continue
    const key = line.group || ""
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(line)
  }
  const lines = [...groups.entries()]
    .map(([group, rows]) => {
      const head = group ? `<h2>${esc(group)}</h2>` : ""
      const body = rows
        .map((line) => {
          const on = bag.checks[line.itemId] ? "on" : ""
          const qty = bag.status === "emptying"
            ? ""
            : `<input class="qty" data-action="bag-qty" data-id="${line.itemId}" type="number" min="1" value="${line.qty}">`
          const fromModel = !bag.added.some((entry) => entry.itemId === line.itemId)
          const own = fromModel
            ? `<button type="button" class="quiet" data-action="exclude-line" data-id="${line.itemId}">Pas dans ce sac</button>`
            : `<button type="button" data-action="remove-bag-line" data-id="${line.itemId}">Retirer</button>`
          return `<div class="line">
            <button class="check ${on}" data-action="check" data-id="${line.itemId}" aria-pressed="${on ? "true" : "false"}">
              <span>${esc(formatLine(itemName(db, line.itemId), line.qty))}</span>
            </button>
            ${qty}
            ${own}
          </div>`
        })
        .join("")
      return `${head}${body}`
    })
    .join("")
  const finder = `<form data-action="find-bag"><input name="q" value="${esc(query)}" placeholder="Chercher dans ce sac"></form>`
  const action = bag.status === "emptying"
    ? `<button data-action="emptied" data-id="${bag.id}">C'est vidé</button>`
    : bag.status === "filling"
      ? `<button data-action="filled" data-id="${bag.id}">C'est rempli</button>`
      : ""
  const note = bag.status === "emptying" ? `<p class="empty">Seulement ce qui doit sortir.</p>` : ""
  const present = new Set(resolveLines(db, bag).map((line) => line.itemId))
  const remaining = db.items.filter((item) => !present.has(item.id))
  const extra = bag.status === "emptying" || !remaining.length
    ? ""
    : `<form data-action="bag-line">
        <select name="item"><option value="">Ajouter dans ce sac seulement</option>${remaining.map((item) => `<option value="${item.id}">${esc(item.name)}</option>`).join("")}</select>
        <input name="qty" type="number" min="1" value="1">
        <button>Ajouter</button>
      </form>`
  const aside = (bag.excluded || [])
    .map((itemId) => `<button type="button" class="quiet" data-action="include-line" data-id="${itemId}">${esc(itemName(db, itemId))} · remettre</button>`)
    .join("")
  const progress = `${visibleLines(db, bag).filter((line) => bag.checks[line.itemId]).length}/${visibleLines(db, bag).length}`
  layout(bag.name, `<p class="empty">${esc(shownStatus(bag))} · ${progress}</p>${finder}${faultNotice(bag)}${note}${lines || `<p class="empty">Rien à montrer.</p>`}${aside}${extra}${action}<button data-action="reset-bag" data-id="${bag.id}">Remettre à zéro</button><form data-action="rename-bag" data-id="${bag.id}"><input name="name" value="${esc(bag.name)}" required><button>Renommer</button></form><button class="quiet" data-action="delete-bag" data-id="${bag.id}">Supprimer ce sac</button><a class="back" href="#/">Retour</a>`)
}

function daysBefore(offset) {
  const days = -offset
  if (days === 0) return "le jour du départ"
  if (days === 1) return "la veille"
  return `${days} jours avant`
}

function drawModels() {
  const bags = db.bagModels
    .map((model) => `<a class="row" href="#/modeles/${model.id}"><strong>${esc(model.name)}</strong><span>Sac</span></a>`)
    .join("")
  const trips = db.departureModels
    .map((model) => `<a class="row" href="#/dmodele/${model.id}"><strong>${esc(model.name)}</strong><span>Départ</span></a>`)
    .join("")
  layout(
    "Modèles",
    `<h2>Sacs</h2>
    <p class="empty">Ce qui doit être dans le sac.</p>
    ${bags || `<p class="empty">Aucun.</p>`}
    <form data-action="model"><input name="name" placeholder="Nom, par exemple Plongée" required><button>Créer un modèle de sac</button></form>
    <h2>Départs</h2>
    <p class="empty">Quels sacs partent, et quoi faire avant. Pas de date ici.</p>
    ${trips || `<p class="empty">Aucun.</p>`}
    <form data-action="dmodel"><input name="name" placeholder="Nom, par exemple Avec avion" required><button>Créer un modèle de départ</button></form>`,
  )
}

function drawModel(id) {
  const model = db.bagModels.find((entry) => entry.id === id)
  if (!model) return layout("Modèle", `<p class="empty">Ce modèle n'existe pas.</p>`)
  const choices = ["stay", "all", "marked"]
    .map((value) => `<option value="${value}" ${model.afterUse === value ? "selected" : ""}>${esc(afterUseLabel[value])}</option>`)
    .join("")
  const lines = model.lines
    .map((line) => {
      const mark = model.afterUse === "marked"
        ? `<button type="button" data-action="mark" data-id="${line.itemId}">${line.removeAfter ? "À sortir" : "Reste"}</button>`
        : ""
      return `<div class="line">
        <span>${esc(formatLine(itemName(db, line.itemId), line.qty))}</span>
        <input class="qty" data-action="qty" data-id="${line.itemId}" type="number" min="1" value="${line.qty}">
        <input data-action="group" data-id="${line.itemId}" value="${esc(line.group || "")}" placeholder="Groupe">
        ${mark}
        <button data-action="remove-line" data-id="${line.itemId}">Retirer</button>
      </div>`
    })
    .join("")
  const used = new Set(model.lines.map((line) => line.itemId))
  const remaining = db.items.filter((item) => !used.has(item.id))
  const options = remaining.map((item) => `<option value="${item.id}">${esc(item.name)}</option>`).join("")
  const form = !db.items.length
    ? `<p class="empty">Crée d'abord un objet.</p>`
    : remaining.length
      ? `<form data-action="line">
          <select name="item"><option value="">Ajouter un objet</option>${options}</select>
          <input name="qty" type="number" min="1" value="1">
          <button>Ajouter</button>
        </form>`
      : `<p class="empty">Tous les objets sont dans le sac.</p>`
  layout(model.name, `<p class="empty">Ce modèle décide du contenu. On ne coche pas ici.</p><select data-action="after-use">${choices}</select>${lines}${form}<form data-action="rename-model" data-id="${model.id}"><input name="name" value="${esc(model.name)}" required><button>Renommer</button></form><button class="quiet" data-action="delete-model" data-id="${model.id}">Supprimer ce modèle</button><a class="back" href="#/modeles">Retour</a>`)
}

function drawItems() {
  const rows = db.items
    .filter((item) => !itemQuery || matches(item.name, itemQuery))
    .map(
      (item) => `<form class="line" data-action="rename" data-id="${item.id}">
        <input name="name" value="${esc(item.name)}">
        <button>Renommer</button>
        <button type="button" data-action="delete-item" data-id="${item.id}">Supprimer</button>
      </form>`,
    )
    .join("")
  layout(
    "Objets",
    `${rows || `<p class="empty">Aucun objet.</p>`}
    <form data-action="find-item"><input name="q" value="${esc(itemQuery)}" placeholder="Chercher un objet"></form>
    <form data-action="item"><input name="name" placeholder="Nom de l'objet" required><button>Créer l'objet</button></form>`,
  )
}

function drawDepartures() {
  const trips = db.departures
    .map((departure) => {
      const when = departure.kind === "once"
        ? `Du ${formatDay(departure.start)} au ${formatDay(departure.end)}`
        : `Tous les ${weekdays[departure.weekday].toLowerCase()}s`
      return `<div class="line">
        <a class="row" href="#/departs/${departure.id}"><strong>${esc(departure.name)}</strong><span>${esc(when)}</span></a>
        <button class="quiet" data-action="delete-departure" data-id="${departure.id}">Supprimer</button>
      </div>`
    })
    .join("")
  const options = db.departureModels
    .map((model) => `<option value="${model.id}" ${model.id === departureDraft.model ? "selected" : ""}>${esc(model.name)}</option>`)
    .join("")
  const days = weekdays
    .map((label, index) => `<option value="${index}" ${String(index) === departureDraft.weekday ? "selected" : ""}>${label}</option>`)
    .join("")
  const fields = departureFields(departureKind)
  const when = fields.includes("weekday")
    ? `<label>Tous les<select name="weekday">${days}</select></label>`
    : `<label>Le jour où tu pars<input name="start" type="date" value="${esc(departureDraft.start)}" required></label>
       <label>Le jour où tu rentres<input name="end" type="date" value="${esc(departureDraft.end)}" required></label>`
  const create = db.departureModels.length
    ? `<form data-action="departure">
        <label>À partir du modèle<select name="model">${options}</select></label>
        <label>Nom de cette fois<input name="name" value="${esc(departureDraft.name)}" placeholder="CSE juin" required></label>
        <label>Ça revient ?
          <select name="kind">
            <option value="once" ${departureKind === "once" ? "selected" : ""}>Non, une seule fois</option>
            <option value="recurring" ${departureKind === "recurring" ? "selected" : ""}>Oui, toutes les semaines</option>
          </select>
        </label>
        ${when}
        <button>Créer le départ</button>
      </form>`
    : `<p class="empty">D'abord, crée un modèle de départ dans Modèles.</p>`
  const agenda = agendaEvents(db, todayIso())
    .map((event) => `<div class="row"><strong>${esc(event.title)}</strong><span>depuis ${esc(formatDay(event.since))}</span></div>`)
    .join("")
  const linked = sessionUsable(loadSession(localStorage))
  const link = linked
    ? `<p class="empty">Agenda Google relié.</p><button type="button" class="quiet" data-action="disconnect">Oublier la connexion</button>`
    : `<button data-action="connect-google">Relier l'agenda Google</button>`
  const note = agendaNote ? `<p class="alert">${esc(agendaNote)}</p>` : ""
  layout("Départs", `${trips || `<p class="empty">Aucun départ.</p>`}<h2>Dans l'agenda</h2>${note}${agenda || `<p class="empty">Rien en attente.</p>`}${link}<h2>Nouveau</h2>${create}`)
}

function drawDepartureModel(id) {
  const model = db.departureModels.find((entry) => entry.id === id)
  if (!model) return layout("Modèle", `<p class="empty">Ce modèle n'existe pas.</p>`)
  const bags = db.bags
    .map((bag) => {
      const on = model.bagIds.includes(bag.id) ? "on" : ""
      return `<button class="check ${on}" data-action="trip-bag" data-id="${bag.id}">${esc(bag.name)}</button>`
    })
    .join("")
  const actions = model.actions
    .map((action) => `<form class="line" data-action="edit-action" data-id="${action.id}">
      <input name="label" value="${esc(action.label)}" required>
      <input name="days" type="number" min="0" value="${-action.offsetDays}">
      <button>Modifier</button>
      <button type="button" class="quiet" data-action="delete-action" data-id="${action.id}">Retirer</button>
    </form>`)
    .join("")
  layout(
    model.name,
    `<p class="empty">Pas de date. Seulement les sacs, et ce qu'il faut faire avant le jour du départ.</p>
    <h2>Sacs qui partent</h2>
    ${bags || `<p class="empty">Crée d'abord un sac.</p>`}
    <h2>Avant le départ</h2>
    ${actions}
    <form data-action="action">
      <label>Quoi faire<input name="label" placeholder="Vérifier les papiers" required></label>
      <label>Combien de jours avant<input name="days" type="number" min="0" value="30"></label>
      <p class="empty">0, le jour même. 1, la veille. 30, trente jours avant.</p>
      <button>Ajouter</button>
    </form>
    <form data-action="rename-dmodel" data-id="${model.id}"><input name="name" value="${esc(model.name)}" required><button>Renommer</button></form>
    <button class="quiet" data-action="delete-dmodel" data-id="${model.id}">Supprimer ce modèle</button>
    <a class="back" href="#/modeles">Retour</a>`,
  )
}

function drawDeparture(id) {
  const departure = db.departures.find((entry) => entry.id === id)
  if (!departure) return layout("Départ", `<p class="empty">Ce départ n'existe pas.</p>`)
  const model = db.departureModels.find((entry) => entry.id === departure.modelId)
  const today = todayIso()
  const when = departure.kind === "once" ? `${formatDay(departure.start)} → ${formatDay(departure.end)}` : `Chaque ${weekdays[departure.weekday]}`
  const actions = (model?.actions || [])
    .map((action) => {
      const on = actionChecked(departure, action) ? "on" : ""
      return `<button class="check ${on}" data-action="trip-check" data-id="${action.id}" aria-pressed="${on ? "true" : "false"}">
        <span>${esc(action.label)}</span><span>${esc(daysBefore(action.offsetDays))} · ${esc(formatDay(actionDate(departure, action, today)))}</span>
      </button>`
    })
    .join("")
  const bags = departureBagIds(db, departure)
    .map((bagId) => {
      const bag = db.bags.find((entry) => entry.id === bagId)
      if (!bag) return ""
      const state = shownStatus(bag)
      return `<a class="row" href="#/sac/${bagId}"><strong>${esc(bag.name)}</strong><span>${esc(state)}</span></a>`
    })
    .join("")
  const edit = departure.kind === "once"
    ? `<form data-action="edit-departure" data-id="${departure.id}">
        <input type="hidden" name="kind" value="once">
        <label>Le jour où tu pars<input name="start" type="date" value="${esc(departure.start || "")}" required></label>
        <label>Le jour où tu rentres<input name="end" type="date" value="${esc(departure.end || "")}" required></label>
        <button>Modifier les dates</button>
      </form>`
    : `<form data-action="edit-departure" data-id="${departure.id}">
        <input type="hidden" name="kind" value="recurring">
        <label>Tous les<select name="weekday">${weekdays.map((label, index) => `<option value="${index}" ${index === departure.weekday ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <button>Modifier le jour</button>
      </form>`
  layout(departure.name, `<p class="empty">${esc(when)}</p><h2>À cocher</h2>${actions || `<p class="empty">Aucune action.</p>`}<h2>Sacs</h2>${bags || `<p class="empty">Aucun sac dans le modèle.</p>`}${edit}<form data-action="rename-departure" data-id="${departure.id}"><input name="name" value="${esc(departure.name)}" required><button>Renommer</button></form><button class="quiet" data-action="delete-departure" data-id="${departure.id}">Supprimer ce départ</button><a class="back" href="#/departs">Retour</a>`)
}

app.addEventListener("submit", (event) => {
  const form = event.target
  if (!(form instanceof HTMLFormElement)) return
  event.preventDefault()
  const action = form.dataset.action
  const data = new FormData(form)
  const page = route()
  if (action === "find-home" || action === "find-bag" || action === "find-item") {
    if (action === "find-home") homeQuery = String(data.get("q") || "")
    else if (action === "find-bag") bagQuery = String(data.get("q") || "")
    else itemQuery = String(data.get("q") || "")
    draw()
    return
  }
  if (action === "item") {
    const result = createItem(db, data.get("name"))
    if (result.error) return alert(result.error)
    persist(result.db)
  }
  if (action === "rename") {
    const result = renameItem(db, form.dataset.id, data.get("name"))
    if (result.error) return alert(result.error)
    persist(result.db)
  }
  if (action === "rename-bag" || action === "rename-model" || action === "rename-departure" || action === "rename-dmodel") {
    const rename = {
      "rename-bag": renameBag,
      "rename-model": renameBagModel,
      "rename-departure": renameDeparture,
      "rename-dmodel": renameDepartureModel,
    }[action]
    const result = rename(db, form.dataset.id, data.get("name"))
    if (result.error) return alert(result.error)
    persist(result.db)
  }
  if (action === "model") {
    const result = createBagModel(db, data.get("name"))
    if (result.error) return alert(result.error)
    persist(result.db)
    location.hash = `#/modeles/${result.model.id}`
  }
  if (action === "line") {
    const item = data.get("item")
    if (!item) return
    persist(setModelLine(db, page.id, item, data.get("qty")).db)
  }
  if (action === "bag") {
    const result = createBag(db, data.get("name"), data.get("model"))
    if (result.error) return alert(result.error)
    persist(result.db)
    location.hash = `#/sac/${result.bag.id}`
  }
  if (action === "bag-line") {
    const item = data.get("item")
    if (!item) return
    const result = addBagLine(db, page.id, item, data.get("qty"))
    if (result.error) return alert(result.error)
    persist(result.db)
  }
  if (action === "dmodel") {
    const result = createDepartureModel(db, data.get("name"))
    if (result.error) return alert(result.error)
    persist(result.db)
    location.hash = `#/dmodele/${result.model.id}`
  }
  if (action === "action") {
    const result = addDepartureAction(db, page.id, data.get("label"), data.get("days"))
    if (result.error) return alert(result.error)
    persist(result.db)
  }
  if (action === "edit-action") {
    const result = updateDepartureAction(db, page.id, form.dataset.id, data.get("label"), data.get("days"))
    if (result.error) return alert(result.error)
    persist(result.db)
  }
  if (action === "edit-departure") {
    const result = updateDeparture(db, form.dataset.id, data.get("kind"), data.get("start"), data.get("end"), data.get("weekday"), todayIso())
    if (result.error) return alert(result.error)
    persist(result.db)
  }
  if (action === "import") {
    const file = data.get("file")
    if (!file || typeof file.text !== "function") return
    if (!confirm("Remplacer toutes les données par ce fichier ?")) return
    file.text().then((raw) => {
      const result = importData(raw)
      if (result.error) return alert(result.error)
      history.length = 0
      persist(result.db)
    })
  }
  if (action === "departure") {
    const result = createDeparture(
      db,
      data.get("name"),
      data.get("model"),
      data.get("kind"),
      data.get("start"),
      data.get("end"),
      data.get("weekday"),
      todayIso(),
    )
    if (result.error) return alert(result.error)
    persist(result.db)
    location.hash = `#/departs/${result.departure.id}`
  }
})

app.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]")
  if (!target) return
  if (target.closest("form") && target.type === "submit") return
  const action = target.dataset.action
  const page = route()
  if (action === "check") persist(toggleCheck(db, page.id, target.dataset.id).db)
  if (action === "undo") return undo()
  if (action === "exclude-line") persist(excludeBagLine(db, page.id, target.dataset.id).db)
  if (action === "include-line") persist(includeBagLine(db, page.id, target.dataset.id).db)
  if (action === "reset-bag") {
    if (!confirm("Oublier les coches et remettre ce sac à prêt ?")) return
    persist(resetBag(db, target.dataset.id).db)
  }
  if (action === "remove-line") persist(removeModelLine(db, page.id, target.dataset.id).db)
  if (action === "remove-bag-line") {
    const result = removeBagLine(db, page.id, target.dataset.id)
    if (result.error) return alert(result.error)
    persist(result.db)
  }
  if (action === "delete-item") {
    if (!confirm("Supprimer cet objet partout ?")) return
    persist(deleteItem(db, target.dataset.id).db)
  }
  if (action === "mark") {
    const model = db.bagModels.find((entry) => entry.id === page.id)
    const line = model?.lines.find((entry) => entry.itemId === target.dataset.id)
    persist(setRemoveAfter(db, page.id, target.dataset.id, !line?.removeAfter).db)
  }
  if (action === "emptied") persist(markEmptied(db, target.dataset.id).db)
  if (action === "filled") persist(markFilled(db, target.dataset.id).db)
  if (action === "trip-bag") persist(toggleDepartureBag(db, page.id, target.dataset.id).db)
  if (action === "trip-check") persist(toggleDepartureAction(db, page.id, target.dataset.id, todayIso()).db)
  if (action === "delete-bag") {
    if (!confirm("Supprimer ce sac ?")) return
    location.hash = "#/"
    persist(deleteBag(db, target.dataset.id).db)
  }
  if (action === "delete-model") {
    if (!confirm("Supprimer ce modèle et ses sacs ?")) return
    location.hash = "#/modeles"
    persist(deleteBagModel(db, target.dataset.id).db)
  }
  if (action === "delete-departure") {
    if (!confirm("Supprimer ce départ ?")) return
    location.hash = "#/departs"
    persist(deleteDeparture(db, target.dataset.id, todayIso()).db)
  }
  if (action === "delete-dmodel") {
    if (!confirm("Supprimer ce modèle de départ ?")) return
    location.hash = "#/departs"
    persist(deleteDepartureModel(db, target.dataset.id).db)
  }
  if (action === "delete-action") persist(removeDepartureAction(db, page.id, target.dataset.id).db)
  if (action === "export") {
    const url = URL.createObjectURL(new Blob([exportData(db)], { type: "application/json" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `sac-de-voyage-${todayIso()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  if (action === "disconnect") {
    const session = loadSession(localStorage)
    clearSession(localStorage)
    agendaNote = ""
    draw()
    if (session?.accessToken) {
      clearDedicated(googleApi({ fetch: globalThis.fetch.bind(globalThis), token: session.accessToken })).catch(() => {})
    }
  }
  if (action === "connect-google") {
    const google = globalThis.google
    if (!google?.accounts?.oauth2) {
      agendaNote = "Google ne s'est pas chargé. Recharge la page."
      draw()
      return
    }
    openGoogleConsent(google, {
      clientId: googleClientId,
      scope: "https://www.googleapis.com/auth/calendar",
      prompt: "consent",
      onSession: (session) => {
        saveSession(session, localStorage)
        agendaNote = ""
        draw()
        void pushAgenda()
      },
      onError: (message) => {
        agendaNote = message === "access_denied" ? "Connexion annulée." : "Google n'a pas relié l'agenda. Réessaie."
        draw()
      },
    })
    return
  }
})

app.addEventListener("change", (event) => {
  const input = event.target
  const page = route()
  if (input instanceof HTMLSelectElement && input.dataset.action === "after-use") {
    persist(setAfterUse(db, page.id, input.value).db)
  }
  if (input instanceof HTMLSelectElement && input.name === "kind" && input.form) {
    const form = input.form
    departureDraft = {
      name: form.name.value,
      model: form.model.value,
      start: form.start?.value || "",
      end: form.end?.value || "",
      weekday: form.weekday?.value || departureDraft.weekday,
    }
    departureKind = input.value
    draw()
  }
  if (!(input instanceof HTMLInputElement)) return
  if (input.dataset.action === "qty") persist(setModelLine(db, page.id, input.dataset.id, input.value).db)
  if (input.dataset.action === "group") persist(setModelGroup(db, page.id, input.dataset.id, input.value).db)
  if (input.dataset.action === "bag-qty") persist(setBagQty(db, page.id, input.dataset.id, input.value).db)
  if (input.name === "q" && input.form?.dataset.action === "find-home") homeQuery = input.value
  if (input.name === "q" && input.form?.dataset.action === "find-bag") bagQuery = input.value
  if (input.name === "q" && input.form?.dataset.action === "find-item") itemQuery = input.value
  if (input.name === "q") {
    const actionName = input.form?.dataset.action
    const caret = input.selectionStart
    draw()
    const field = document.querySelector(`form[data-action="${actionName}"] input[name="q"]`)
    if (field) {
      field.focus()
      field.setSelectionRange(caret, caret)
    }
  }
})

window.addEventListener("hashchange", draw)

const clean = dropAuthQuery(location.href)
if (clean) history.replaceState(null, "", clean)
draw()
void pushAgenda()
