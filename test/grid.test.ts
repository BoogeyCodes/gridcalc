import { describe, expect, it } from 'vitest'
import { Grid } from '../src/grid.js'

describe('Grid', () => {
  it('resolves references and ranges across cells', () => {
    const grid = new Grid().setMany({ A1: 10, A2: 20, A3: 30 }).set('B1', '=SUM(A1:A3)').set('B2', '=A1 + A3')
    expect(grid.get('B1')).toBe(60)
    expect(grid.get('B2')).toBe(40)
  })

  it('recomputes dependents when a precedent changes', () => {
    const grid = new Grid().set('A1', 5).set('A2', '=A1 * 2').set('A3', '=A2 + 1')
    expect(grid.get('A3')).toBe(11)

    grid.set('A1', 100)
    expect(grid.get('A2')).toBe(200)
    expect(grid.get('A3')).toBe(201)
  })

  it('reads an unset cell as empty', () => {
    expect(new Grid().get('Z9')).toBe('')
  })

  it('exposes the raw formula and lets a cell switch between formula and literal', () => {
    const grid = new Grid().set('A1', '=1 + 1')
    expect(grid.getFormula('A1')).toBe('=1 + 1')
    expect(grid.get('A1')).toBe(2)

    grid.set('A1', 42)
    expect(grid.getFormula('A1')).toBeUndefined()
    expect(grid.get('A1')).toBe(42)
  })

  it('normalises references, so a1 and A1 are the same cell', () => {
    const grid = new Grid().set('a1', 7)
    expect(grid.get('A1')).toBe(7)
    expect(grid.get('a1')).toBe(7)
  })

  it('detects a direct self-reference', () => {
    const grid = new Grid().set('A1', '=A1 + 1')
    expect((grid.get('A1') as { code: string }).code).toBe('#CIRCULAR!')
  })

  it('detects an indirect cycle and marks the cells in it', () => {
    const grid = new Grid().set('A1', '=B1').set('B1', '=C1').set('C1', '=A1')
    expect((grid.get('A1') as { code: string }).code).toBe('#CIRCULAR!')
    expect((grid.get('B1') as { code: string }).code).toBe('#CIRCULAR!')
  })

  it('recovers once a cycle is broken', () => {
    const grid = new Grid().set('A1', '=B1').set('B1', '=A1')
    expect((grid.get('A1') as { code: string }).code).toBe('#CIRCULAR!')

    grid.set('B1', 5)
    expect(grid.get('A1')).toBe(5)
    expect(grid.get('B1')).toBe(5)
  })

  it('invalidates deep dependency chains on change', () => {
    const grid = new Grid().set('A1', 1)
    for (let i = 2; i <= 20; i++) grid.set(`A${i}`, `=A${i - 1} + 1`)
    expect(grid.get('A20')).toBe(20)

    grid.set('A1', 100)
    expect(grid.get('A20')).toBe(119)
  })

  it('rejects invalid references', () => {
    expect(() => new Grid().set('not-a-ref', 1)).toThrow(RangeError)
  })
})
