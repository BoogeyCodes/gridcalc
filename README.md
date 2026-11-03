# gridcalc

[![CI](https://github.com/BoogeyCodes/gridcalc/actions/workflows/ci.yml/badge.svg)](https://github.com/BoogeyCodes/gridcalc/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)
![Zero dependencies](https://img.shields.io/badge/dependencies-0-success)
![ESM + CJS](https://img.shields.io/badge/module-ESM%20%2B%20CJS-blue)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

A spreadsheet formula engine in TypeScript, with no runtime dependencies. Set cells to numbers,
text or **formulas** that reference other cells, and read back computed values. It has a real
formula parser, A1-style references and ranges, a dependency graph that recomputes only what changed,
and circular-reference detection.

```ts
import { Grid } from 'gridcalc'

const sheet = new Grid()
sheet.setMany({ A1: 3, B1: 4.5, A2: 10, B2: 1.2 })
sheet.set('C1', '=A1 * B1')
sheet.set('C2', '=A2 * B2')
sheet.set('total', 'ignored') // cells are addressed A1-style, not by name
sheet.set('C3', '=SUM(C1:C2)')
sheet.set('C4', '=IF(C3 > 20, C3 * 0.9, C3)') // 10% off over 20

sheet.get('C3') // 25.5
sheet.get('C4') // 22.95

sheet.set('A2', 50) // change an input...
sheet.get('C4') // 60.3 — dependents recomputed automatically
```

## Why

A spreadsheet is a surprisingly complete little computer: a language you parse, a dependency graph
you evaluate in the right order, and error values that propagate. gridcalc implements that core in a
few hundred lines of readable TypeScript, as a demonstration of the moving parts — a lexer, a Pratt
parser, a tree-walking evaluator, and a reactive dependency graph — rather than as a full Excel
replacement. It is a library: no UI, no file formats, just the engine.

## What it supports

- **Values**: numbers, text, booleans, and error values (`#DIV/0!`, `#CIRCULAR!`, `#NAME?`,
  `#VALUE!`).
- **References and ranges**: `A1`, `B2`, `A1:C3`. Column letters go past `Z` (`AA`, `AB`, …).
- **Operators**: `+ - * / ^`, comparisons (`= <> < <= > >=`), and `&` for text concatenation, with
  correct precedence and right-associative `^`.
- **Functions**: `SUM`, `AVERAGE`, `MIN`, `MAX`, `PRODUCT`, `COUNT`, `IF`, `AND`, `OR`, `NOT`, `ABS`,
  `SQRT`, `INT`, `ROUND`, `MOD`, `CONCAT`, `LEN`, `UPPER`, `LOWER`, `TRIM`.
- **Error propagation**: an error in a precedent flows through to everything that depends on it.

## How it works

```
  set('C3', '=SUM(C1:C2)')
        │
        ▼
  tokenize  ──►  Pratt parser  ──►  AST
        │                            │ referenced cells
        │                            ▼
        │                     dependency graph (precedents ⇄ dependents)
        ▼
  get('C3')
        │  lazy, memoised evaluation
        ▼
  evaluate(AST, resolve)   resolve(ref) -> get(ref), recursively
        │  a cell on the current stack ⇒ #CIRCULAR!
        ▼
  value (cached until a precedent changes)
```

- **Parsing.** Formulas are tokenized and parsed by a [Pratt parser](https://en.wikipedia.org/wiki/Operator-precedence_parser),
  which handles operator precedence and the right-associativity of `^` cleanly. Unary minus binds
  tighter than `^`, so `=-2^2` is `4`, matching spreadsheet behaviour.
- **Evaluation** is lazy and memoised. `get(cell)` evaluates the formula, resolving each reference by
  recursively getting that cell, and caches the result.
- **The dependency graph** records, for each formula, the cells it reads. Setting a cell invalidates
  the cache for that cell and everything that transitively depends on it — and nothing else — so a
  change recomputes the minimum.
- **Circular references** are caught during evaluation: if a cell appears on the current evaluation
  stack, it and the cells in the cycle resolve to `#CIRCULAR!`. Break the cycle and they recover.

## Install

```bash
npm install gridcalc
```

Node 18+. Ships as ESM and CommonJS with type definitions. No runtime dependencies.

## API

```ts
const grid = new Grid()

grid.set(ref, value)      // value: number | string | boolean; a string starting with '=' is a formula
grid.setMany({ A1: 1 })   // set several at once
grid.get(ref)             // evaluated Value (number | string | boolean | CellError); unset cells read as ''
grid.getFormula(ref)      // the raw '=...' text, or undefined
grid.delete(ref)          // remove a cell
```

The lower-level pieces are exported too, so you can use the engine without the grid:

```ts
import { parseFormula, evaluate, tokenize } from 'gridcalc'

const ast = parseFormula('SUM(A1:A3) * 2')
```

## Semantics worth knowing

- An **unset cell** reads as `0` in arithmetic and `""` in text, so `=A1+1` on an empty `A1` is `1`.
- **Aggregation** (`SUM`, `AVERAGE`, …) ignores non-numeric text inside ranges and propagates error
  values, as spreadsheets do.
- **Text comparison** is case-insensitive: `="abc" = "ABC"` is `TRUE`.

## Development

```bash
npm install
npm run typecheck
npm test            # 26 tests across the references, parser, evaluator and grid
npm run build       # ESM + CJS + .d.ts via tsup
```

## Where it would go next

- `$A$1` absolute references, and relative-reference adjustment when formulas are copied.
- More functions (`VLOOKUP`, `SUMIF`, date math).
- A `topologicalOrder()` for batch recalculation, and serialisation of a sheet.

## License

MIT
