import {
  emptyDb,
  load,
  save,
  createItem,
  createBagModel,
  setAfterUse,
  setModelLine,
  setRemoveAfter,
  setModelGroup,
  createBag,
  excludeBagLine,
  setBagQty,
  createDepartureModel,
  toggleDepartureBag,
  addDepartureAction,
  createDeparture,
} from "./store.js"

export const PERSONAL_SEED = "maquette-3"
const KEEP = new Set([PERSONAL_SEED, "maquette-2", "imported"])

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

const courte = ["Brosse à dents", "Dentifrice", "Déodorant", "Lingettes", "Chargeur téléphone"]

const longue = ["Brosse à dents", "Dentifrice", "Shampoing", "Crème", "Rasoir", "Coton-tiges"]

const plongee = [
  ["Masque", false],
  ["Tuba", false],
  ["Palmes", false],
  ["Ceinture de plombs", false],
  ["Ordinateur de plongée", false],
  ["Lampe de plongée", false],
  ["Sifflet", false],
  ["Stab", true],
  ["Combinaison", true],
  ["Chaussons", true],
  ["Serviette", true],
]

const voyage = [
  ["Pisse debout", "Sac"],
  ["Sac voyage Quechua", "Sac"],
  ["Gourde", "Sac"],
  ["Sac plastique", "Sac"],
  ["Ficelle", "Sac"],
  ["Sac de plage", "Sac"],
  ["Serviette micro fibre", "Sac"],
  ["Airtag (chipolo)", "Tech"],
  ["Lampe torche, frontale", "Tech"],
  ["Pic carte sim", "Tech"],
  ["Câble Anker", "Tech"],
  ["Adaptateur jack-bluetooth (ou jack 3.5 2.5)", "Tech"],
  ["Power bank steamdeck", "Tech"],
  ["Mini ventilateur", "Tech"],
  ["Boule quies, bouchons d'oreilles", "Confort"],
  ["Lessive à main", "Confort"],
  ["Coussin avion à rembourrer", "Confort"],
  ["Crème solaire brume", "Confort"],
  ["Vêtements anti UV", "Confort"],
  ["Bas de contention", "Confort"],
  ["Anti-friction", "Confort"],
  ["Crème solaire tatouage", "Confort"],
  ["Fix-it", "Divers"],
  ["Dés + cartes", "Divers"],
  ["Lingettes antiseptiques", "Divers"],
  ["Kit vis/bricolage", "Divers"],
  ["Bonde évier", "Divers"],
  ["cadenas TSA", "Divers"],
  ["Brosse à dents", "Divers"],
  ["Chaussettes", "Divers"],
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

const weekend = ["Pyjama", "Chargeur téléphone", "Brosse à dents"]

function itemId(db, name) {
  const found = db.items.find((item) => item.name.toLocaleLowerCase("fr") === name.toLocaleLowerCase("fr"))
  if (found) return { db, id: found.id }
  const created = createItem(db, name)
  return { db: created.db, id: created.item.id }
}

function makeBag(db, name, afterUse, labels) {
  let next = db
  const rows = labels.map((label) => (Array.isArray(label) ? label : [label, ""]))
  const ids = []
  for (const [label] of rows) {
    const added = itemId(next, label)
    next = added.db
    ids.push(added.id)
  }
  const model = createBagModel(next, name)
  next = setAfterUse(model.db, model.model.id, afterUse).db
  rows.forEach(([, group], index) => {
    next = setModelLine(next, model.model.id, ids[index], 1).db
    if (group) next = setModelGroup(next, model.model.id, ids[index], group).db
  })
  const bag = createBag(next, name, model.model.id)
  return { db: bag.db, bagId: bag.bag.id, modelId: model.model.id }
}

function makeTrip(db, name, bagIds, actions = []) {
  const model = createDepartureModel(db, name)
  let next = model.db
  for (const bagId of bagIds) next = toggleDepartureBag(next, model.model.id, bagId).db
  for (const action of actions) next = addDepartureAction(next, model.model.id, action.label, action.days).db
  return { db: next, modelId: model.model.id }
}

export function personalDb() {
  let db = emptyDb()
  const house = makeBag(db, "Départ maison", "stay", maison)
  const kit = makeBag(house.db, "Trousse de secours", "stay", trousse)
  const short = makeBag(kit.db, "Trousse courte", "stay", courte)
  const long = makeBag(short.db, "Trousse longue", "stay", longue)
  db = long.db
  const diveModel = createBagModel(db, "Plongée")
  db = setAfterUse(diveModel.db, diveModel.model.id, "marked").db
  for (const [label, wet] of plongee) {
    const added = itemId(db, label)
    db = setModelLine(added.db, diveModel.model.id, added.id, 1).db
    if (wet) db = setRemoveAfter(db, diveModel.model.id, added.id, true).db
  }
  const dive = createBag(db, "Plongée du mardi", diveModel.model.id)
  db = dive.db
  const trip = makeBag(db, "Voyage", "all", voyage)
  db = setModelLine(trip.db, trip.modelId, itemId(trip.db, "Chaussettes").id, 3).db
  const kitModel = db.bagModels.find((model) => model.name === "Trousse de secours")
  const compresses = itemId(db, "Compresse")
  db = setModelLine(compresses.db, kitModel.id, compresses.id, 4).db
  const socks = itemId(db, "Chaussettes")
  db = setBagQty(socks.db, trip.bagId, socks.id, 5).db
  const backpack = createBag(db, "Sac à dos", trip.modelId)
  db = excludeBagLine(backpack.db, backpack.bag.id, itemId(backpack.db, "cadenas TSA").id).db
  db = excludeBagLine(db, backpack.bag.id, itemId(db, "Coussin avion à rembourrer").id).db
  const cat = makeBag(db, "Absence chat", "stay", chat)
  const away = makeBag(cat.db, "Shaé part", "all", shae)
  const last = makeBag(away.db, "Week-end", "all", weekend)
  db = last.db

  const houseTrip = makeTrip(db, "Départ maison", [house.bagId], maison.map((label) => ({ label, days: 1 })))
  const voyageTrip = makeTrip(houseTrip.db, "Voyage", [kit.bagId, long.bagId, trip.bagId], [
    { label: "Vérifier les papiers", days: 30 },
    { label: "Prévenir la banque", days: 7 },
    { label: "Inscription fil d'Ariane", days: 7 },
    { label: "Photocopie passeport", days: 1 },
  ])
  const diveTrip = makeTrip(voyageTrip.db, "Plongée", [dive.bag.id], [{ label: "Gonfler le stab", days: 0 }])
  const paris = makeTrip(diveTrip.db, "Paris", [short.bagId], [{ label: "Badge", days: 0 }])
  const catTrip = makeTrip(paris.db, "Absence chat", [cat.bagId], chat.map((label) => ({ label, days: 1 })))
  const shaeTrip = makeTrip(catTrip.db, "Shaé part", [away.bagId])
  const weekendTrip = makeTrip(shaeTrip.db, "Week-end", [last.bagId])
  db = weekendTrip.db

  db = createDeparture(db, "CSE décembre", voyageTrip.modelId, "once", "2026-12-18", "2026-12-27", "", "2026-11-01").db
  db = createDeparture(db, "Plongée du mardi", diveTrip.modelId, "recurring", "", "", "2", "2026-11-01").db
  db = createDeparture(db, "Paris mercredi", paris.modelId, "recurring", "", "", "3", "2026-11-14").db
  db = createDeparture(db, "Week-end 21 nov", houseTrip.modelId, "once", "2026-11-21", "2026-11-22", "", "2026-11-14").db
  db = createDeparture(db, "Week-end dernier", weekendTrip.modelId, "once", "2026-11-07", "2026-11-09", "", "2026-11-01").db
  db = createDeparture(db, "Noël chat", catTrip.modelId, "once", "2026-12-24", "2026-12-26", "", "2026-11-14").db
  return { ...db, seed: PERSONAL_SEED }
}

export function openDb(storage) {
  try {
    const current = load(storage)
    if (KEEP.has(current?.seed)) return current
    if (current?.seed && Array.isArray(current.bags) && current.bags.length) return current
  } catch {
    // Un fichier illisible est remplacé.
  }
  const fresh = personalDb()
  save(fresh, storage)
  return fresh
}
