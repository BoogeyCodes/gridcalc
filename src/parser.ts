import type { BinaryOp, Node } from './ast.js'
import { type Token, tokenize } from './lexer.js'
import { normaliseRef } from './references.js'

export class ParseError extends Error {}

// Infix binding powers. Higher binds tighter. '^' is right-associative.
const INFIX: Record<string, number> = {
  '&': 5,
  '=': 10,
  '<>': 10,
  '<': 10,
  '<=': 10,
  '>': 10,
  '>=': 10,
  '+': 20,
  '-': 20,
  '*': 30,
  '/': 30,
  '^': 40,
}
// Unary minus binds tighter than '^', so =-2^2 is (-2)^2 = 4, matching spreadsheet semantics.
const PREFIX_BP = 45

/** Parse a formula body (the text after '=') into an AST. */
export function parseFormula(input: string): Node {
  const parser = new Parser(tokenize(input))
  const node = parser.parseExpression(0)
  parser.expect('eof')
  return node
}

class Parser {
  private index = 0

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.index]
  }

  private next(): Token {
    return this.tokens[this.index++]
  }

  expect(type: Token['type']): Token {
    const token = this.peek()
    if (token.type !== type) {
      throw new ParseError(`Expected ${type} but found '${token.value || token.type}' at position ${token.pos}`)
    }
    return this.next()
  }

  parseExpression(minBp: number): Node {
    let left = this.parsePrefix()

    for (;;) {
      const token = this.peek()
      if (token.type !== 'op') break
      const bp = INFIX[token.value]
      if (bp === undefined || bp <= minBp) break
      this.next()
      // Right-associative for '^', so recurse at bp-1.
      const rightBp = token.value === '^' ? bp - 1 : bp
      const right = this.parseExpression(rightBp)
      left = { type: 'binary', op: token.value as BinaryOp, left, right }
    }

    return left
  }

  private parsePrefix(): Node {
    const token = this.next()

    switch (token.type) {
      case 'number':
        return { type: 'number', value: Number(token.value) }
      case 'string':
        return { type: 'string', value: token.value }
      case 'op':
        if (token.value === '-' || token.value === '+') {
          return { type: 'unary', op: token.value, operand: this.parseExpression(PREFIX_BP) }
        }
        throw new ParseError(`Unexpected operator '${token.value}' at position ${token.pos}`)
      case 'lparen': {
        const inner = this.parseExpression(0)
        this.expect('rparen')
        return inner
      }
      case 'ref': {
        const ref = normaliseRef(token.value)
        if (!ref) throw new ParseError(`Invalid reference '${token.value}' at position ${token.pos}`)
        if (this.peek().type === 'colon') {
          this.next()
          const toToken = this.expect('ref')
          const to = normaliseRef(toToken.value)
          if (!to) throw new ParseError(`Invalid reference '${toToken.value}' at position ${toToken.pos}`)
          return { type: 'range', from: ref, to }
        }
        return { type: 'ref', ref }
      }
      case 'ident': {
        const name = token.value.toUpperCase()
        if (this.peek().type === 'lparen') {
          this.next()
          const args = this.parseArgs()
          this.expect('rparen')
          return { type: 'call', name, args }
        }
        if (name === 'TRUE') return { type: 'boolean', value: true }
        if (name === 'FALSE') return { type: 'boolean', value: false }
        return { type: 'name', name }
      }
      default:
        throw new ParseError(`Unexpected '${token.value || token.type}' at position ${token.pos}`)
    }
  }

  private parseArgs(): Node[] {
    const args: Node[] = []
    if (this.peek().type === 'rparen') return args
    args.push(this.parseExpression(0))
    while (this.peek().type === 'comma') {
      this.next()
      args.push(this.parseExpression(0))
    }
    return args
  }
}
