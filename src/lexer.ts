export type TokenType =
  | 'number'
  | 'string'
  | 'ref'
  | 'ident'
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'colon'
  | 'eof'

export interface Token {
  type: TokenType
  value: string
  pos: number
}

export class LexError extends Error {}

const OPERATORS = ['<=', '>=', '<>', '+', '-', '*', '/', '^', '&', '=', '<', '>']

/** Turn a formula body (without the leading '=') into tokens. */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  const push = (type: TokenType, value: string, pos: number) => tokens.push({ type, value, pos })

  while (i < input.length) {
    const ch = input[i]

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }

    if (ch === '(') {
      push('lparen', ch, i++)
      continue
    }
    if (ch === ')') {
      push('rparen', ch, i++)
      continue
    }
    if (ch === ',') {
      push('comma', ch, i++)
      continue
    }
    if (ch === ':') {
      push('colon', ch, i++)
      continue
    }

    if (ch === '"') {
      const start = i
      i++
      let value = ''
      while (i < input.length) {
        if (input[i] === '"') {
          if (input[i + 1] === '"') {
            value += '"' // "" is an escaped quote
            i += 2
            continue
          }
          i++
          push('string', value, start)
          break
        }
        value += input[i++]
      }
      if (i > input.length || (input[i - 1] !== '"' && tokens[tokens.length - 1]?.pos !== start)) {
        throw new LexError(`Unterminated string at position ${start}`)
      }
      continue
    }

    if (isDigit(ch) || (ch === '.' && isDigit(input[i + 1] ?? ''))) {
      const start = i
      while (i < input.length && /[0-9.eE+-]/.test(input[i])) {
        // Only consume +/- when part of an exponent (e.g. 1e-3).
        if ((input[i] === '+' || input[i] === '-') && !/[eE]/.test(input[i - 1])) break
        i++
      }
      const text = input.slice(start, i)
      if (!/^\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(text) && !/^\d+\.?\d*(?:[eE][+-]?\d+)?$/.test(text)) {
        throw new LexError(`Invalid number '${text}' at position ${start}`)
      }
      push('number', text, start)
      continue
    }

    if (isLetter(ch)) {
      const start = i
      while (i < input.length && isLetter(input[i])) i++
      // Letters followed immediately by digits are a cell reference (A1); otherwise an identifier.
      if (i < input.length && isDigit(input[i])) {
        while (i < input.length && isDigit(input[i])) i++
        push('ref', input.slice(start, i), start)
      } else {
        push('ident', input.slice(start, i), start)
      }
      continue
    }

    const op = OPERATORS.find((o) => input.startsWith(o, i))
    if (op) {
      push('op', op, i)
      i += op.length
      continue
    }

    throw new LexError(`Unexpected character '${ch}' at position ${i}`)
  }

  push('eof', '', i)
  return tokens
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

function isLetter(ch: string): boolean {
  return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || ch === '_'
}
