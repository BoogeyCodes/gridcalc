export type ErrorCode = '#CIRCULAR!' | '#REF!' | '#DIV/0!' | '#NAME?' | '#VALUE!' | '#N/A'

/** A spreadsheet error value, e.g. the result of dividing by zero. */
export class CellError {
  constructor(
    public readonly code: ErrorCode,
    public readonly detail?: string,
  ) {}

  toString(): string {
    return this.code
  }
}

/** The value a cell can hold or a formula can produce. */
export type Value = number | string | boolean | CellError

export function isError(value: unknown): value is CellError {
  return value instanceof CellError
}
