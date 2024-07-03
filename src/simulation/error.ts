import { EnhancedEvmError } from './types'

export class SimulationError extends Error {
  constructor(
    message: string,
    readonly data?: EnhancedEvmError,
  ) {
    super(message)
    this.name = 'SimulationError'
  }
}
