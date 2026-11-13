import test from "node:test"
import assert from "node:assert/strict"
import { formatDay, formatLine } from "./text.js"

test("une date se lit en français", () => {
  assert.equal(formatDay("2026-08-12"), "12 août")
  assert.equal(formatDay("2026-11-03"), "3 novembre")
  assert.equal(formatDay("2026-01-01"), "1 janvier")
  assert.equal(formatDay(""), "")
})

test("le nombre n'apparaît que s'il y en a plusieurs", () => {
  assert.equal(formatLine("Brosse à dents", 1), "Brosse à dents")
  assert.equal(formatLine("Brosse à dents", 3), "Brosse à dents × 3")
  assert.equal(formatLine("Brosse à dents", 0), "Brosse à dents")
})
