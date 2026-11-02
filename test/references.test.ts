import { describe, expect, it } from 'vitest'
import { columnToIndex, expandRange, indexToColumn, parseRef, toRef } from '../src/references.js'

describe('references', () => {
  it('converts columns to indices and back', () => {
    expect(columnToIndex('A')).toBe(0)
    expect(columnToIndex('Z')).toBe(25)
    expect(columnToIndex('AA')).toBe(26)
    expect(columnToIndex('AZ')).toBe(51)
    expect(columnToIndex('BA')).toBe(52)
    for (const i of [0, 25, 26, 51, 701, 702, 16383]) {
      expect(columnToIndex(indexToColumn(i))).toBe(i)
    }
  })

  it('parses and formats A1 references', () => {
    expect(parseRef('A1')).toEqual({ row: 0, col: 0 })
    expect(parseRef('B3')).toEqual({ row: 2, col: 1 })
    expect(parseRef('AA10')).toEqual({ row: 9, col: 26 })
    expect(parseRef('nonsense')).toBeNull()
    expect(toRef({ row: 2, col: 1 })).toBe('B3')
  })

  it('expands ranges row-major regardless of corner order', () => {
    expect(expandRange('A1', 'B2')).toEqual(['A1', 'B1', 'A2', 'B2'])
    expect(expandRange('B2', 'A1')).toEqual(['A1', 'B1', 'A2', 'B2'])
    expect(expandRange('A1', 'A3')).toEqual(['A1', 'A2', 'A3'])
  })
})
