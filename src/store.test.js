import test from "node:test"
import assert from "node:assert/strict"
import {
  emptyDb,
  createItem,
  renameItem,
  deleteItem,
  createBagModel,
  setModelLine,
  createBag,
  toggleCheck,
  resolveLines,
  setBagQty,
} from "./store.js"

test("refuse un objet du même nom", () => {
  let db = emptyDb()
  db = createItem(db, "Masque").db
  const again = createItem(db, " masque ")
  assert.equal(again.error, "Ce nom existe déjà.")
  assert.equal(again.db.items.length, 1)
})

test("un enfant ne copie pas le modèle", () => {
  let db = emptyDb()
  const masque = createItem(db, "Masque")
  db = masque.db
  const stab = createItem(db, "Stab")
  db = stab.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, masque.item.id, 1).db
  const bag = createBag(db, "Plongée du mardi", model.model.id)
  db = bag.db
  db = setModelLine(db, model.model.id, stab.item.id, 1).db
  const lines = resolveLines(db, db.bags[0])
  assert.deepEqual(lines.map((line) => line.itemId), [masque.item.id, stab.item.id])
  assert.deepEqual(db.bags[0].added, [])
})

test("renommer et supprimer se propagent", () => {
  let db = emptyDb()
  const item = createItem(db, "Stab")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  db = createBag(db, "Mardi", model.model.id).db
  db = renameItem(db, item.item.id, "Gilet").db
  assert.equal(db.items[0].name, "Gilet")
  db = deleteItem(db, item.item.id).db
  assert.equal(resolveLines(db, db.bags[0]).length, 0)
  assert.equal(db.bagModels[0].lines.length, 0)
})

test("cocher puis décocher", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, item.item.id, 2).db
  db = createBag(db, "Mardi", model.model.id).db
  db = toggleCheck(db, db.bags[0].id, item.item.id).db
  assert.equal(db.bags[0].checks[item.item.id], true)
  db = toggleCheck(db, db.bags[0].id, item.item.id).db
  assert.equal(db.bags[0].checks[item.item.id], undefined)
})

test("le nombre d'un enfant ne change pas le modèle", () => {
  let db = emptyDb()
  const item = createItem(db, "Masque")
  db = item.db
  const model = createBagModel(db, "Plongée")
  db = model.db
  db = setModelLine(db, model.model.id, item.item.id, 1).db
  db = createBag(db, "Mardi", model.model.id).db
  db = setBagQty(db, db.bags[0].id, item.item.id, 3).db
  assert.equal(db.bagModels[0].lines[0].qty, 1)
  assert.equal(resolveLines(db, db.bags[0])[0].qty, 3)
  db = setModelLine(db, model.model.id, item.item.id, 4).db
  assert.equal(resolveLines(db, db.bags[0])[0].qty, 3)
})
