import {
  load,
  save,
  createItem,
  renameItem,
  deleteItem,
  createBagModel,
  setAfterUse,
  setModelLine,
  setRemoveAfter,
  removeModelLine,
  createBag,
  addBagLine,
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
  removeDepartureAction,
  departureFields,
  departureBagIds,
  resolveLines,
  agendaEvents,
  missingChecks,
  attention,
} from "./store.js"
import { googleApi, googleClientId, loadSession, syncDedicated } from "./google.js"

const app = document.querySelector("#app")
let departureKind = "once"
let departureDraft = { name: "", model: "", start: "", end: "", weekday: "3" }
const empty = { version: 1, items: [], bagModels: [], bags: [], departureModels: [], departures: [] }
let db
try {
  db = applyOutings(load(), todayIso())
  save(db)
} catch {
  db = empty
}

const afterUseLabel = { stay: "Reste prêt", all: "Tout sortir", marked: "Sortir le marqué" }
const statusLabel = { ready: "Rempli", emptying: "À vider", filling: "À remplir" }
const weekdays = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]

function persist(next) {
  db = applyOutings(next, todayIso())
  save(db)
  draw()
  void pushAgenda()
}

async function pushAgenda() {
  const session = loadSession(localStorage)
  if (!session?.accessToken || !googleClientId) return
  try {
    await syncDedicated(db, todayIso(), googleApi({ fetch: globalThis.fetch.bind(globalThis), token: session.accessToken }))
  } catch {
    // Le sac reste enregistré. L'agenda réessaiera au prochain geste.
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
  app.innerHTML = `
    <header><p class="brand">Sac de voyage</p><h1>${esc(title)}</h1></header>
    <main>${body}</main>
    <nav>
      <a href="#/">Sacs</a>
      <a href="#/departs">Départs</a>
      <a href="#/modeles">Modèles</a>
      <a href="#/objets">Objets</a>
    </nav>`
}

function draw() {
  const page = route()
  if (page.name === "items") return drawItems()
  if (page.name === "models") return drawModels()
  if (page.name === "model") return drawModel(page.id)
  if (page.name === "bag") return drawBag(page.id)
  if (page.name === "departures") return drawDepartures()
  if (page.name === "departure") return drawDeparture(page.id)
  if (page.name === "dmodel") return drawDepartureModel(page.id)
  drawBags()
}

function shownStatus(bag) {
  if (missingChecks(db, bag).length) return "En défaut"
  return statusLabel[bag.status] || ""
}

function faultNotice(bag) {
  const missing = missingChecks(db, bag)
  if (!missing.length) return ""
  const names = missing.map((id) => esc(itemName(db, id))).join(", ")
  return `<p class="alert">En défaut. Pas coché : ${names}</p>`
}

function drawBags() {
  const cards = [...db.bags]
    .sort((a, b) => attention(db, a) - attention(db, b))
    .map((bag) => {
      const count = visibleLines(db, bag).length
      return `<a class="row" href="#/sac/${bag.id}"><strong>${esc(bag.name)}</strong><span>${esc(shownStatus(bag))} · ${count}</span></a>`
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
  layout("Sacs", `${cards || `<p class="empty">Aucun sac.</p>`}${form}`)
}

function drawBag(id) {
  const bag = db.bags.find((entry) => entry.id === id)
  if (!bag) return layout("Sac", `<p class="empty">Ce sac n'existe pas.</p>`)
  const lines = visibleLines(db, bag)
    .map((line) => {
      const on = bag.checks[line.itemId] ? "on" : ""
      const qty = bag.status === "emptying"
        ? ""
        : `<input class="qty" data-action="bag-qty" data-id="${line.itemId}" type="number" min="1" value="${line.qty}">`
      return `<div class="line">
        <button class="check ${on}" data-action="check" data-id="${line.itemId}">
          <span>${esc(itemName(db, line.itemId))}</span>
        </button>
        ${qty}
      </div>`
    })
    .join("")
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
  layout(bag.name, `<p class="empty">${esc(shownStatus(bag))}</p>${faultNotice(bag)}${note}${lines || `<p class="empty">Rien à montrer.</p>`}${extra}${action}<button class="quiet" data-action="delete-bag" data-id="${bag.id}">Supprimer ce sac</button><a class="back" href="#/">Retour</a>`)
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
        <span>${esc(itemName(db, line.itemId))}</span>
        <input class="qty" data-action="qty" data-id="${line.itemId}" type="number" min="1" value="${line.qty}">
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
  layout(model.name, `<p class="empty">Ce modèle décide du contenu. On ne coche pas ici.</p><select data-action="after-use">${choices}</select>${lines}${form}<button class="quiet" data-action="delete-model" data-id="${model.id}">Supprimer ce modèle</button><a class="back" href="#/modeles">Retour</a>`)
}

function drawItems() {
  const rows = db.items
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
    <form data-action="item"><input name="name" placeholder="Nom de l'objet" required><button>Créer l'objet</button></form>`,
  )
}

function drawDepartures() {
  const trips = db.departures
    .map((departure) => {
      const when = departure.kind === "once"
        ? `Du ${departure.start} au ${departure.end}`
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
    .map((event) => `<div class="row"><strong>${esc(event.title)}</strong><span>depuis ${esc(event.since)}</span></div>`)
    .join("")
  layout("Départs", `${trips || `<p class="empty">Aucun départ.</p>`}<h2>Dans l'agenda</h2>${agenda || `<p class="empty">Rien en attente.</p>`}<h2>Nouveau</h2>${create}`)
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
    .map((action) => `<div class="line">
      <div class="row"><strong>${esc(action.label)}</strong><span>${esc(daysBefore(action.offsetDays))}</span></div>
      <button class="quiet" data-action="delete-action" data-id="${action.id}">Retirer</button>
    </div>`)
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
    <button class="quiet" data-action="delete-dmodel" data-id="${model.id}">Supprimer ce modèle</button>
    <a class="back" href="#/modeles">Retour</a>`,
  )
}

function drawDeparture(id) {
  const departure = db.departures.find((entry) => entry.id === id)
  if (!departure) return layout("Départ", `<p class="empty">Ce départ n'existe pas.</p>`)
  const model = db.departureModels.find((entry) => entry.id === departure.modelId)
  const today = todayIso()
  const when = departure.kind === "once" ? `${departure.start} → ${departure.end}` : `Chaque ${weekdays[departure.weekday]}`
  const actions = (model?.actions || [])
    .map((action) => {
      const on = actionChecked(departure, action) ? "on" : ""
      return `<button class="check ${on}" data-action="trip-check" data-id="${action.id}">
        <span>${esc(action.label)}</span><span>${esc(daysBefore(action.offsetDays))} · ${esc(actionDate(departure, action, today))}</span>
      </button>`
    })
    .join("")
  const bags = departureBagIds(db, departure)
    .map((bagId) => {
      const bag = db.bags.find((entry) => entry.id === bagId)
      if (!bag) return ""
      const stuff = resolveLines(db, bag).map((line) => esc(itemName(db, line.itemId))).join(", ")
      const state = shownStatus(bag)
      return `<a class="row" href="#/sac/${bagId}"><strong>${esc(bag.name)}</strong><span>${esc(state)}${stuff ? ` · ${stuff}` : ""}</span></a>`
    })
    .join("")
  layout(departure.name, `<p class="empty">${esc(when)}</p><h2>À cocher</h2>${actions || `<p class="empty">Aucune action.</p>`}<h2>Sacs</h2>${bags || `<p class="empty">Aucun sac dans le modèle.</p>`}<button class="quiet" data-action="delete-departure" data-id="${departure.id}">Supprimer ce départ</button><a class="back" href="#/departs">Retour</a>`)
}

app.addEventListener("submit", (event) => {
  const form = event.target
  if (!(form instanceof HTMLFormElement)) return
  event.preventDefault()
  const action = form.dataset.action
  const data = new FormData(form)
  const page = route()
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
  if (action === "remove-line") persist(removeModelLine(db, page.id, target.dataset.id).db)
  if (action === "delete-item") persist(deleteItem(db, target.dataset.id).db)
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
    location.hash = "#/"
    persist(deleteBag(db, target.dataset.id).db)
  }
  if (action === "delete-model") {
    location.hash = "#/modeles"
    persist(deleteBagModel(db, target.dataset.id).db)
  }
  if (action === "delete-departure") {
    location.hash = "#/departs"
    persist(deleteDeparture(db, target.dataset.id).db)
  }
  if (action === "delete-dmodel") {
    location.hash = "#/departs"
    persist(deleteDepartureModel(db, target.dataset.id).db)
  }
  if (action === "delete-action") persist(removeDepartureAction(db, page.id, target.dataset.id).db)
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
  if (input.dataset.action === "bag-qty") persist(setBagQty(db, page.id, input.dataset.id, input.value).db)
})

window.addEventListener("hashchange", draw)
draw()
