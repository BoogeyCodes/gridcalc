export type Node =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'ref'; ref: string }
  | { type: 'range'; from: string; to: string }
  | { type: 'name'; name: string } // a bare identifier that is not TRUE/FALSE or a call
  | { type: 'unary'; op: '-' | '+'; operand: Node }
  | { type: 'binary'; op: BinaryOp; left: Node; right: Node }
  | { type: 'call'; name: string; args: Node[] }

export type BinaryOp = '+' | '-' | '*' | '/' | '^' | '&' | '=' | '<>' | '<' | '<=' | '>' | '>='
