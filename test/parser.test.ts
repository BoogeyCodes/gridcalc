import { describe, expect, it } from 'vitest'
import type { Node } from '../src/ast.js'
import { ParseError, parseFormula } from '../src/parser.js'

describe('parseFormula', () => {
  it('respects operator precedence', () => {
    // 1 + 2 * 3 should parse as 1 + (2 * 3)
    const ast = parseFormula('1 + 2 * 3') as Extract<Node, { type: 'binary' }>
    expect(ast.type).toBe('binary')
    expect(ast.op).toBe('+')
    expect(ast.left).toEqual({ type: 'number', value: 1 })
    expect((ast.right as Extract<Node, { type: 'binary' }>).op).toBe('*')
  })

  it('makes exponentiation right-associative', () => {
    // 2 ^ 3 ^ 2 is 2 ^ (3 ^ 2)
    const ast = parseFormula('2 ^ 3 ^ 2') as Extract<Node, { type: 'binary' }>
    expect(ast.op).toBe('^')
    expect(ast.left).toEqual({ type: 'number', value: 2 })
    expect((ast.right as Extract<Node, { type: 'binary' }>).op).toBe('^')
  })

  it('parses parentheses, refs, ranges and calls', () => {
    expect(parseFormula('(1 + 2)')).toEqual({
      type: 'binary',
      op: '+',
      left: { type: 'number', value: 1 },
      right: { type: 'number', value: 2 },
    })
    expect(parseFormula('a1')).toEqual({ type: 'ref', ref: 'A1' })
    expect(parseFormula('A1:B2')).toEqual({ type: 'range', from: 'A1', to: 'B2' })
    expect(parseFormula('SUM(A1:A3, 10)')).toEqual({
      type: 'call',
      name: 'SUM',
      args: [{ type: 'range', from: 'A1', to: 'A3' }, { type: 'number', value: 10 }],
    })
  })

  it('parses booleans, strings and unary minus', () => {
    expect(parseFormula('TRUE')).toEqual({ type: 'boolean', value: true })
    expect(parseFormula('"hi ""there"""')).toEqual({ type: 'string', value: 'hi "there"' })
    expect((parseFormula('-5') as Extract<Node, { type: 'unary' }>).op).toBe('-')
  })

  it('rejects malformed formulas', () => {
    expect(() => parseFormula('1 +')).toThrow(ParseError)
    expect(() => parseFormula('(1 + 2')).toThrow(ParseError)
    expect(() => parseFormula('SUM(1,')).toThrow(ParseError)
  })
})
