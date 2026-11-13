const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]

export function formatDay(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""))
  if (!match) return String(iso || "")
  const month = months[Number(match[2]) - 1]
  const day = Number(match[3])
  if (!month || day < 1 || day > 31) return String(iso)
  return `${day} ${month}`
}

export function formatLine(name, qty) {
  const count = Math.floor(Number(qty))
  if (!Number.isFinite(count) || count <= 1) return name
  return `${name} × ${count}`
}
