import type { Node } from './ast.js'
import { CellError, isError, type Value } from './errors.js'
import { collectReferences, evaluate } from './evaluator.js'
import { ParseError, parseFormula } from './parser.js'
import { normaliseRef } from './references.js'

interface FormulaCell {
  kind: 'formula'
  source: string // the text after '='
  ast: Node
  precedents: Set<string>
}

interface LiteralCell {
  kind: 'literal'
  value: number | string | boolean
}

type Cell = FormulaCell | LiteralCell

/**
 * A spreadsheet grid. Set cells to literals or formulas (strings starting with `=`),
 * then read their evaluated values. Values are computed lazily and memoised; a change
 * invalidates only the cells that transitively depend on it, and circular references
 * are detected and reported as `#CIRCULAR!`.
 */
export class Grid {
  private readonly cells = new Map<string, Cell>()
  private readonly cache = new Map<string, Value>()
  private readonly dependents = new Map<string, Set<string>>() // cell -> cells that reference it
  private readonly computing = new Set<string>() // cells on the current evaluation stack

  /** Set a cell. A string beginning with `=` is a formula; anything else is a literal. */
  set(ref: string, input: number | string | boolean): this {
    const key = this.key(ref)
    this.clearPrecedents(key)

    if (typeof input === 'string' && input.startsWith('=')) {
      try {
        const source = input.slice(1)
        const ast = parseFormula(source)
        const precedents = collectReferences(ast)
        this.cells.set(key, { kind: 'formula', source, ast, precedents })
        for (const p of precedents) this.addDependent(p, key)
      } catch (err) {
        if (err instanceof ParseError || err instanceof Error) {
          // Store the parse error as the cell's value.
          this.cells.set(key, { kind: 'literal', value: input })
          this.invalidate(key)
          this.cache.set(key, new CellError('#NAME?', err.message))
          return this
        }
        throw err
      }
    } else {
      this.cells.set(key, { kind: 'literal', value: input })
    }

    this.invalidate(key)
    return this
  }

  /** Set several cells at once. */
  setMany(cells: Record<string, number | string | boolean>): this {
    for (const [ref, value] of Object.entries(cells)) this.set(ref, value)
    return this
  }

  /** The evaluated value of a cell. An unset cell reads as an empty string. */
  get(ref: string): Value {
    const key = this.key(ref)

    if (this.computing.has(key)) {
      return new CellError('#CIRCULAR!', `${key} refers to itself`)
    }
    const cached = this.cache.get(key)
    if (cached !== undefined) return cached

    const cell = this.cells.get(key)
    if (!cell) return ''

    if (cell.kind === 'literal') {
      this.cache.set(key, cell.value)
      return cell.value
    }

    this.computing.add(key)
    let value: Value
    try {
      value = evaluate(cell.ast, (r) => this.get(r))
    } finally {
      this.computing.delete(key)
    }
    this.cache.set(key, value)
    return value
  }

  /** The raw formula text (including the leading `=`), or undefined for a literal/empty cell. */
  getFormula(ref: string): string | undefined {
    const cell = this.cells.get(this.key(ref))
    return cell?.kind === 'formula' ? `=${cell.source}` : undefined
  }

  /** Remove a cell. */
  delete(ref: string): this {
    const key = this.key(ref)
    this.clearPrecedents(key)
    this.cells.delete(key)
    this.invalidate(key)
    return this
  }

  private key(ref: string): string {
    const normalised = normaliseRef(ref)
    if (!normalised) throw new RangeError(`Invalid cell reference: '${ref}'`)
    return normalised
  }

  private addDependent(precedent: string, dependent: string): void {
    let set = this.dependents.get(precedent)
    if (!set) {
      set = new Set()
      this.dependents.set(precedent, set)
    }
    set.add(dependent)
  }

  private clearPrecedents(key: string): void {
    const cell = this.cells.get(key)
    if (cell?.kind === 'formula') {
      for (const p of cell.precedents) this.dependents.get(p)?.delete(key)
    }
  }

  /** Drop the cached value of a cell and everything that transitively depends on it. */
  private invalidate(key: string): void {
    const stack = [key]
    const seen = new Set<string>()
    while (stack.length) {
      const current = stack.pop()!
      if (seen.has(current)) continue
      seen.add(current)
      this.cache.delete(current)
      for (const dependent of this.dependents.get(current) ?? []) stack.push(dependent)
    }
  }
}

export { isError }
