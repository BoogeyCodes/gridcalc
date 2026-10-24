/** Helpers for A1-style cell references and ranges. */

const REF = /^([A-Za-z]+)(\d+)$/

/** `'A'` -> 0, `'Z'` -> 25, `'AA'` -> 26. Base-26 "bijective" (no zero digit). */
export function columnToIndex(column: string): number {
  let index = 0
  for (const ch of column.toUpperCase()) {
    index = index * 26 + (ch.charCodeAt(0) - 64) // 'A' is 65
  }
  return index - 1
}

export function indexToColumn(index: number): string {
  let n = index + 1
  let column = ''
  while (n > 0) {
    const remainder = (n - 1) % 26
    column = String.fromCharCode(65 + remainder) + column
    n = Math.floor((n - 1) / 26)
  }
  return column
}

export interface Coord {
  row: number // 0-based
  col: number // 0-based
}

export function parseRef(ref: string): Coord | null {
  const match = REF.exec(ref)
  if (!match) return null
  const row = Number(match[2]) - 1
  if (row < 0) return null
  return { row, col: columnToIndex(match[1]) }
}

export function toRef(coord: Coord): string {
  return `${indexToColumn(coord.col)}${coord.row + 1}`
}

/** Normalise `'a1'` to `'A1'`. Returns null if not a valid reference. */
export function normaliseRef(ref: string): string | null {
  const coord = parseRef(ref)
  return coord ? toRef(coord) : null
}

/** Every cell in the rectangle spanned by two corners, row-major. */
export function expandRange(from: string, to: string): string[] {
  const a = parseRef(from)
  const b = parseRef(to)
  if (!a || !b) return []

  const r0 = Math.min(a.row, b.row)
  const r1 = Math.max(a.row, b.row)
  const c0 = Math.min(a.col, b.col)
  const c1 = Math.max(a.col, b.col)

  const cells: string[] = []
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      cells.push(toRef({ row, col }))
    }
  }
  return cells
}
