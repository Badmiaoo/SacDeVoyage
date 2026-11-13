import { emptyDb, load, save, createItem, createBagModel, setAfterUse, setModelLine, createBag, createDepartureModel, toggleDepartureBag } from "./store.js"

export const PERSONAL_SEED = "listes-perso-1"

const maison = [
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
]

const trousse = [
  "Ibuprofene",
  "Doliprane",
  "Sérum physiologique",
  "Compresse",
  "Pansements",
  "Désinfectant",
  "Bande adhésive",
  "Serviette hygiénique",
  "Tulle gras",
  "Baume du tigre",
  "Citrate de betaine",
  "Thermomètre",
  "Smecta",
  "Crème hémorroïdes",
  "Constipation (movicol)",
  "Anti histaminique",
]

const voyage = [
  "Pisse debout",
  "Sac voyage Quechua",
  "Gourde",
  "Lampe torche, frontale",
  "Sac plastique",
  "Ficelle",
  "Airtag (chipolo)",
  "Boule quies, bouchons d'oreilles",
  "Lessive à main",
  "Coussin avion à rembourrer",
  "Crème solaire brume",
  "Vêtements anti UV",
  "Pic carte sim",
  "Câble Anker",
  "Adaptateur jack-bluetooth (ou jack 3.5 2.5)",
  "Power bank steamdeck",
  "Bas de contention",
  "Photocopie passeport",
  "Inscription fil d'Ariane",
  "Prévenir la banque",
  "Sac de plage",
  "Mini ventilateur",
  "Anti-friction",
  "Fix-it",
  "Crème solaire tatouage",
  "Dés + cartes",
  "Lingettes antiseptiques",
  "Kit vis/bricolage",
  "Bonde évier",
  "Serviette micro fibre",
  "cadenas TSA",
]

const chat = [
  "Remplir la machine à croquettes",
  "Remplir la fontaine",
  "Nettoyer la litière",
  "Mettre la caméra",
  "Si absence longue, demander à quelqu'un de passer",
  "Sortir jouets et brosse et pâté",
  "Préparer carnet de santé et caisse de transport",
  "Couper griffes et poils de Q",
]

const shae = [
  "Désactivé machine à croquettes",
  "Débrancher et vider la fontaine",
  "Nettoyer la litière",
]

function itemId(db, name) {
  const found = db.items.find((item) => item.name.toLocaleLowerCase("fr") === name.toLocaleLowerCase("fr"))
  if (found) return { db, id: found.id }
  const created = createItem(db, name)
  return { db: created.db, id: created.item.id }
}

function makeBag(db, name, afterUse, labels) {
  let next = db
  const ids = []
  for (const label of labels) {
    const added = itemId(next, label)
    next = added.db
    ids.push(added.id)
  }
  const model = createBagModel(next, name)
  next = setAfterUse(model.db, model.model.id, afterUse).db
  for (const id of ids) next = setModelLine(next, model.model.id, id, 1).db
  const bag = createBag(next, name, model.model.id)
  return { db: bag.db, bagId: bag.bag.id }
}

function makeTrip(db, name, bagIds) {
  const model = createDepartureModel(db, name)
  let next = model.db
  for (const bagId of bagIds) next = toggleDepartureBag(next, model.model.id, bagId).db
  return next
}

export function personalDb() {
  let db = emptyDb()
  const house = makeBag(db, "Départ maison", "all", maison)
  const kit = makeBag(house.db, "Trousse de secours", "stay", trousse)
  const trip = makeBag(kit.db, "Voyage", "all", voyage)
  const cat = makeBag(trip.db, "Absence chat", "all", chat)
  const away = makeBag(cat.db, "Shaé part", "all", shae)
  db = away.db
  db = makeTrip(db, "Départ maison", [house.bagId])
  db = makeTrip(db, "Voyage", [kit.bagId, trip.bagId])
  db = makeTrip(db, "Absence chat", [cat.bagId])
  db = makeTrip(db, "Shaé part", [away.bagId])
  return { ...db, seed: PERSONAL_SEED }
}

export function openDb(storage) {
  try {
    const current = load(storage)
    if (current?.seed === PERSONAL_SEED) return current
  } catch {
    // Un fichier illisible est remplacé.
  }
  const fresh = personalDb()
  save(fresh, storage)
  return fresh
}
