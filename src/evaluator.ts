import type { BinaryOp, Node } from './ast.js'
import { CellError, isError, type Value } from './errors.js'
import { type Arg, FUNCTIONS, toNumber, toText } from './functions.js'
import { expandRange } from './references.js'

export type Resolver = (ref: string) => Value

type EvalResult = Value | Value[]

/** Evaluate an AST, resolving cell references through `resolve`. */
export function evaluate(node: Node, resolve: Resolver): Value {
  const result = evalNode(node, resolve)
  return Array.isArray(result) ? new CellError('#VALUE!', 'a range is not valid here') : result
}

/** Cells a formula depends on (refs plus every cell in each range), for dependency tracking. */
export function collectReferences(node: Node, into: Set<string> = new Set()): Set<string> {
  switch (node.type) {
    case 'ref':
      into.add(node.ref)
      break
    case 'range':
      for (const cell of expandRange(node.from, node.to)) into.add(cell)
      break
    case 'unary':
      collectReferences(node.operand, into)
      break
    case 'binary':
      collectReferences(node.left, into)
      collectReferences(node.right, into)
      break
    case 'call':
      for (const arg of node.args) collectReferences(arg, into)
      break
  }
  return into
}

function evalNode(node: Node, resolve: Resolver): EvalResult {
  switch (node.type) {
    case 'number':
      return node.value
    case 'string':
      return node.value
    case 'boolean':
      return node.value
    case 'name':
      return new CellError('#NAME?', `unknown name '${node.name}'`)
    case 'ref':
      return resolve(node.ref)
    case 'range':
      return expandRange(node.from, node.to).map(resolve)
    case 'unary': {
      const operand = evalScalar(node.operand, resolve)
      const n = toNumber(operand)
      if (isError(n)) return n
      return node.op === '-' ? -n : n
    }
    case 'binary':
      return evalBinary(node.op, node.left, node.right, resolve)
    case 'call': {
      const impl = FUNCTIONS[node.name]
      if (!impl) return new CellError('#NAME?', `unknown function ${node.name}`)
      const args: Arg[] = node.args.map((arg) => evalNode(arg, resolve))
      return impl(args)
    }
  }
}

function evalScalar(node: Node, resolve: Resolver): Value {
  const result = evalNode(node, resolve)
  return Array.isArray(result) ? new CellError('#VALUE!', 'a range is not valid here') : result
}

function evalBinary(op: BinaryOp, leftNode: Node, rightNode: Node, resolve: Resolver): Value {
  const left = evalScalar(leftNode, resolve)
  const right = evalScalar(rightNode, resolve)
  if (isError(left)) return left
  if (isError(right)) return right

  if (op === '&') return toText(left) + toText(right)

  if (op === '=' || op === '<>' || op === '<' || op === '<=' || op === '>' || op === '>=') {
    return compare(op, left, right)
  }

  const a = toNumber(left)
  const b = toNumber(right)
  if (isError(a)) return a
  if (isError(b)) return b

  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '*':
      return a * b
    case '/':
      return b === 0 ? new CellError('#DIV/0!', 'division by zero') : a / b
    case '^':
      return a ** b
  }
}

function compare(op: BinaryOp, left: Value, right: Value): boolean {
  let cmp: number
  if (typeof left === 'number' && typeof right === 'number') {
    cmp = left < right ? -1 : left > right ? 1 : 0
  } else {
    // Text comparison is case-insensitive, matching spreadsheet behaviour.
    const a = toText(left).toUpperCase()
    const b = toText(right).toUpperCase()
    cmp = a < b ? -1 : a > b ? 1 : 0
  }
  switch (op) {
    case '=':
      return cmp === 0
    case '<>':
      return cmp !== 0
    case '<':
      return cmp < 0
    case '<=':
      return cmp <= 0
    case '>':
      return cmp > 0
    case '>=':
      return cmp >= 0
    default:
      return false
  }
}
