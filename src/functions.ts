import { CellError, isError, type Value } from './errors.js'

/** A function argument is either a scalar value or, for a range, a list of values. */
export type Arg = Value | Value[]
export type FunctionImpl = (args: Arg[]) => Value

function flatten(arg: Arg): Value[] {
  return Array.isArray(arg) ? arg : [arg]
}

export function toNumber(value: Value): number | CellError {
  if (isError(value)) return value
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  const text = value.trim()
  if (text === '') return 0 // a blank cell behaves as 0 in arithmetic
  const n = Number(text)
  return Number.isNaN(n) ? new CellError('#VALUE!', `'${value}' is not a number`) : n
}

export function toText(value: Value): string {
  if (isError(value)) return value.code
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  return String(value)
}

export function toBoolean(value: Value): boolean | CellError {
  if (isError(value)) return value
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const text = value.trim().toUpperCase()
  if (text === 'TRUE') return true
  if (text === 'FALSE' || text === '') return false
  const n = Number(text)
  return Number.isNaN(n) ? new CellError('#VALUE!', `'${value}' is not a boolean`) : n !== 0
}

/** Collect numeric values for aggregation: errors propagate, text is ignored, booleans count as 0/1. */
function numbers(args: Arg[]): number[] | CellError {
  const out: number[] = []
  for (const arg of args) {
    for (const value of flatten(arg)) {
      if (isError(value)) return value
      if (typeof value === 'number') out.push(value)
      else if (typeof value === 'boolean') out.push(value ? 1 : 0)
      else if (value.trim() !== '' && !Number.isNaN(Number(value))) out.push(Number(value))
      // non-numeric text is ignored, matching how spreadsheets treat text inside ranges
    }
  }
  return out
}

function firstError(args: Arg[]): CellError | null {
  for (const arg of args) {
    for (const value of flatten(arg)) {
      if (isError(value)) return value
    }
  }
  return null
}

function scalar(arg: Arg): Value {
  return Array.isArray(arg) ? new CellError('#VALUE!', 'expected a single value, got a range') : arg
}

function requireArgs(args: Arg[], min: number, max = min): CellError | null {
  if (args.length < min || args.length > max) {
    return new CellError('#VALUE!', `wrong number of arguments (${args.length})`)
  }
  return null
}

function numericUnary(fn: (n: number) => number): FunctionImpl {
  return (args) => {
    const bad = requireArgs(args, 1)
    if (bad) return bad
    const n = toNumber(scalar(args[0]))
    return isError(n) ? n : fn(n)
  }
}

export const FUNCTIONS: Record<string, FunctionImpl> = {
  SUM: (args) => {
    const nums = numbers(args)
    return isError(nums) ? nums : nums.reduce((a, b) => a + b, 0)
  },
  AVERAGE: (args) => {
    const nums = numbers(args)
    if (isError(nums)) return nums
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : new CellError('#DIV/0!', 'AVERAGE of no numbers')
  },
  MIN: (args) => {
    const nums = numbers(args)
    if (isError(nums)) return nums
    return nums.length ? Math.min(...nums) : 0
  },
  MAX: (args) => {
    const nums = numbers(args)
    if (isError(nums)) return nums
    return nums.length ? Math.max(...nums) : 0
  },
  PRODUCT: (args) => {
    const nums = numbers(args)
    return isError(nums) ? nums : nums.reduce((a, b) => a * b, 1)
  },
  COUNT: (args) => {
    // Count numeric values; errors are ignored rather than propagated (as in spreadsheets).
    let count = 0
    for (const arg of args) {
      for (const value of flatten(arg)) {
        if (typeof value === 'number') count++
        else if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) count++
      }
    }
    return count
  },
  IF: (args) => {
    const bad = requireArgs(args, 2, 3)
    if (bad) return bad
    const condition = toBoolean(scalar(args[0]))
    if (isError(condition)) return condition
    return condition ? scalar(args[1]) : args.length === 3 ? scalar(args[2]) : false
  },
  AND: (args) => {
    const err = firstError(args)
    if (err) return err
    const values = args.flatMap(flatten).map(toBoolean)
    const bad = values.find(isError)
    if (bad) return bad
    return (values as boolean[]).every(Boolean)
  },
  OR: (args) => {
    const err = firstError(args)
    if (err) return err
    const values = args.flatMap(flatten).map(toBoolean)
    const bad = values.find(isError)
    if (bad) return bad
    return (values as boolean[]).some(Boolean)
  },
  NOT: (args) => {
    const bad = requireArgs(args, 1)
    if (bad) return bad
    const b = toBoolean(scalar(args[0]))
    return isError(b) ? b : !b
  },
  ABS: numericUnary(Math.abs),
  SQRT: numericUnary((n) => (n < 0 ? NaN : Math.sqrt(n))),
  INT: numericUnary(Math.floor),
  ROUND: (args) => {
    const bad = requireArgs(args, 1, 2)
    if (bad) return bad
    const n = toNumber(scalar(args[0]))
    if (isError(n)) return n
    const digits = args.length === 2 ? toNumber(scalar(args[1])) : 0
    if (isError(digits)) return digits
    const factor = 10 ** Math.trunc(digits)
    return Math.round(n * factor) / factor
  },
  MOD: (args) => {
    const bad = requireArgs(args, 2)
    if (bad) return bad
    const a = toNumber(scalar(args[0]))
    const b = toNumber(scalar(args[1]))
    if (isError(a)) return a
    if (isError(b)) return b
    if (b === 0) return new CellError('#DIV/0!', 'MOD by zero')
    return ((a % b) + b) % b
  },
  CONCAT: (args) => args.flatMap(flatten).map(toText).join(''),
  CONCATENATE: (args) => args.flatMap(flatten).map(toText).join(''),
  LEN: (args) => {
    const bad = requireArgs(args, 1)
    if (bad) return bad
    const v = scalar(args[0])
    return isError(v) ? v : toText(v).length
  },
  UPPER: (args) => {
    const v = scalar(args[0])
    return isError(v) ? v : toText(v).toUpperCase()
  },
  LOWER: (args) => {
    const v = scalar(args[0])
    return isError(v) ? v : toText(v).toLowerCase()
  },
  TRIM: (args) => {
    const v = scalar(args[0])
    return isError(v) ? v : toText(v).trim()
  },
  COUNTA: (args) => {
    // Count non-empty values (numbers, non-blank text, booleans), like a spreadsheet COUNTA.
    let count = 0
    for (const arg of args) {
      for (const value of flatten(arg)) {
        if (typeof value === 'string') {
          if (value.trim() !== '') count++
        } else if (value !== null && value !== undefined) {
          count++
        }
      }
    }
    return count
  },
  MEDIAN: (args) => {
    const nums = numbers(args)
    if (isError(nums)) return nums
    if (!nums.length) return new CellError('#VALUE!', 'MEDIAN of no numbers')
    const sorted = [...nums].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
  },
  POWER: (args) => {
    const bad = requireArgs(args, 2)
    if (bad) return bad
    const base = toNumber(scalar(args[0]))
    const exponent = toNumber(scalar(args[1]))
    if (isError(base)) return base
    if (isError(exponent)) return exponent
    const result = base ** exponent
    return Number.isFinite(result) ? result : new CellError('#VALUE!', 'POWER result is not finite')
  },
}
