import { describe, expect, it } from 'vitest'
import { isError } from '../src/errors.js'
import { Grid } from '../src/grid.js'

/** Evaluate a single formula in an otherwise empty grid. */
function evalFormula(formula: string): unknown {
  return new Grid().set('Z1', formula).get('Z1')
}

describe('formula evaluation', () => {
  it('does arithmetic with correct precedence', () => {
    expect(evalFormula('=1 + 2 * 3')).toBe(7)
    expect(evalFormula('=(1 + 2) * 3')).toBe(9)
    expect(evalFormula('=2 ^ 3 ^ 2')).toBe(512)
    expect(evalFormula('=-2 ^ 2')).toBe(4) // unary minus binds tighter than ^ here
    expect(evalFormula('=10 / 4')).toBe(2.5)
  })

  it('reports division by zero', () => {
    const result = evalFormula('=1 / 0')
    expect(isError(result) && result.code).toBe('#DIV/0!')
  })

  it('compares values and returns booleans', () => {
    expect(evalFormula('=3 > 2')).toBe(true)
    expect(evalFormula('=2 >= 2')).toBe(true)
    expect(evalFormula('="abc" = "ABC"')).toBe(true) // case-insensitive text compare
    expect(evalFormula('=1 <> 2')).toBe(true)
  })

  it('concatenates with &', () => {
    expect(evalFormula('="a" & "b" & 1')).toBe('ab1')
    expect(evalFormula('=TRUE & "!"')).toBe('TRUE!')
  })

  it('evaluates built-in functions', () => {
    expect(evalFormula('=SUM(1, 2, 3)')).toBe(6)
    expect(evalFormula('=AVERAGE(2, 4, 6)')).toBe(4)
    expect(evalFormula('=MIN(5, 2, 8)')).toBe(2)
    expect(evalFormula('=MAX(5, 2, 8)')).toBe(8)
    expect(evalFormula('=ROUND(3.14159, 2)')).toBe(3.14)
    expect(evalFormula('=ABS(-7)')).toBe(7)
    expect(evalFormula('=MOD(7, 3)')).toBe(1)
    expect(evalFormula('=IF(1 > 0, "yes", "no")')).toBe('yes')
    expect(evalFormula('=IF(AND(TRUE, FALSE), 1, 2)')).toBe(2)
    expect(evalFormula('=CONCAT("a", "b", "c")')).toBe('abc')
    expect(evalFormula('=LEN("hello")')).toBe(5)
    expect(evalFormula('=UPPER("abc")')).toBe('ABC')
    expect(evalFormula('=POWER(2, 10)')).toBe(1024)
    expect(evalFormula('=MEDIAN(1, 3, 2)')).toBe(2)
    expect(evalFormula('=MEDIAN(1, 2, 3, 4)')).toBe(2.5)
  })

  it('counts non-empty values with COUNTA', () => {
    const grid = new Grid().setMany({ A1: 10, A2: '', A3: 'x', A4: 0 })
    grid.set('B1', '=COUNTA(A1:A4)')
    expect(grid.get('B1')).toBe(3) // 10, "x", 0 — the blank A2 is skipped
  })

  it('propagates errors through operators and functions', () => {
    const grid = new Grid().set('A1', '=1/0').set('A2', '=A1 + 1').set('A3', '=SUM(A1, 5)')
    expect(isError(grid.get('A2')) && (grid.get('A2') as { code: string }).code).toBe('#DIV/0!')
    expect(isError(grid.get('A3'))).toBe(true)
  })

  it('returns #NAME? for unknown functions and names', () => {
    expect((evalFormula('=BOGUS(1)') as { code: string }).code).toBe('#NAME?')
    expect((evalFormula('=notafunction') as { code: string }).code).toBe('#NAME?')
  })

  it('treats a blank cell as zero in arithmetic and empty in text', () => {
    const grid = new Grid().set('A1', '=B1 + 5').set('A2', '=B1 & "x"')
    expect(grid.get('A1')).toBe(5)
    expect(grid.get('A2')).toBe('x')
  })
})
