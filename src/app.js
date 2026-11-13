import {
  load,
  save,
  createItem,
  renameItem,
  deleteItem,
  createBagModel,
  setModelLine,
  removeModelLine,
  createBag,
  toggleCheck,
  resolveLines,
  itemName,
} from "./store.js"

const app = document.querySelector("#app")
let db = load()

function persist(next) {
  db = next
  save(db)
  draw()
}

function route() {
  const parts = (location.hash.slice(1) || "/").split("/").filter(Boolean)
  const [path, id] = parts
  if (!path) return { name: "bags" }
  if (path === "objets") return { name: "items" }
  if (path === "modeles" && id) return { name: "model", id }
  if (path === "modeles") return { name: "models" }
  if (path === "sac" && id) return { name: "bag", id }
  return { name: "bags" }
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&")
    .replaceAll("<", "<")
    .replaceAll(">", ">")
    .replaceAll('"', """)
}

function layout(title, body) {
  app.innerHTML = `
    <header><p class="brand">Sac de voyage</p><h1>${esc(title)}</h1></header>
    <main>${body}</main>
    <nav>
      <a href="#/">Sacs</a>
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
  drawBags()
}

function drawBags() {
  const cards = db.bags
    .map((bag) => {
      const count = resolveLines(db, bag).length
      return `<a class="row" href="#/sac/${bag.id}"><strong>${esc(bag.name)}</strong><span>${count}</span></a>`
    })
    .join("")
  const options = db.bagModels
    .map((model) => `<option value="${model.id}">${esc(model.name)}</option>`)
    .join("")
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
  const lines = resolveLines(db, bag)
    .map((line) => {
      const on = bag.checks[line.itemId] ? "on" : ""
      return `<button class="check ${on}" data-action="check" data-id="${line.itemId}">
        <span>${esc(itemName(db, line.itemId))}</span><span>${line.qty}</span>
      </button>`
    })
    .join("")
  layout(bag.name, `${lines || `<p class="empty">Ce modèle est vide.</p>`}<a class="back" href="#/">Retour</a>`)
}

function drawModels() {
  const cards = db.bagModels
    .map((model) => `<a class="row" href="#/modeles/${model.id}"><strong>${esc(model.name)}</strong><span>${model.lines.length}</span></a>`)
    .join("")
  layout(
    "Modèles",
    `${cards || `<p class="empty">Aucun modèle.</p>`}
    <form data-action="model"><input name="name" placeholder="Nom du modèle" required><button>Créer le modèle</button></form>`,
  )
}

function drawModel(id) {
  const model = db.bagModels.find((entry) => entry.id === id)
  if (!model) return layout("Modèle", `<p class="empty">Ce modèle n'existe pas.</p>`)
  const lines = model.lines
    .map(
      (line) => `<div class="line">
        <span>${esc(itemName(db, line.itemId))}</span>
        <input data-action="qty" data-id="${line.itemId}" type="number" min="1" value="${line.qty}">
        <button data-action="remove-line" data-id="${line.itemId}">Retirer</button>
      </div>`,
    )
    .join("")
  const options = db.items
    .map((item) => `<option value="${item.id}">${esc(item.name)}</option>`)
    .join("")
  const form = db.items.length
    ? `<form data-action="line">
        <select name="item">${options}</select>
        <input name="qty" type="number" min="1" value="1">
        <button>Ajouter</button>
      </form>`
    : `<p class="empty">Crée d'abord un objet.</p>`
  layout(model.name, `${lines}${form}<a class="back" href="#/modeles">Retour</a>`)
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

app.addEventListener("submit", (event) => {
  const form = event.target
  if (!(form instanceof HTMLFormElement)) return
  event.preventDefault()
  const action = form.dataset.action
  const data = new FormData(form)
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
    const page = route()
    persist(setModelLine(db, page.id, data.get("item"), data.get("qty")).db)
  }
  if (action === "bag") {
    const result = createBag(db, data.get("name"), data.get("model"))
    if (result.error) return alert(result.error)
    persist(result.db)
    location.hash = `#/sac/${result.bag.id}`
  }
})

app.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]")
  if (!target) return
  const action = target.dataset.action
  const page = route()
  if (action === "check") persist(toggleCheck(db, page.id, target.dataset.id).db)
  if (action === "remove-line") persist(removeModelLine(db, page.id, target.dataset.id).db)
  if (action === "delete-item") persist(deleteItem(db, target.dataset.id).db)
})

app.addEventListener("change", (event) => {
  const input = event.target
  if (!(input instanceof HTMLInputElement) || input.dataset.action !== "qty") return
  const page = route()
  persist(setModelLine(db, page.id, input.dataset.id, input.value).db)
})

window.addEventListener("hashchange", draw)
draw()
