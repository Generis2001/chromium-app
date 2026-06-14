export class GenLayerError extends Error {
  contractName: string;
  timestamp: Date;

  constructor(message: string, contractName: string) {
    super(message);
    this.name = "GenLayerError";
    this.contractName = contractName;
    this.timestamp = new Date();
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ContractNotDeployedError extends GenLayerError {
  constructor(contractName: string) {
    super(
      `Contract ${contractName} is not deployed (address is placeholder)`,
      contractName,
    );
    this.name = "ContractNotDeployedError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ContractTimeoutError extends GenLayerError {
  timeoutMs: number;

  constructor(contractName: string, timeoutMs: number) {
    super(
      `Contract ${contractName} timed out after ${timeoutMs}ms`,
      contractName,
    );
    this.name = "ContractTimeoutError";
    this.timeoutMs = timeoutMs;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ContractValidationError extends GenLayerError {
  constructor(contractName: string, detail: string) {
    super(`Validation error on ${contractName}: ${detail}`, contractName);
    this.name = "ContractValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CircuitOpenError extends GenLayerError {
  constructor(contractName: string) {
    super(
      `Circuit breaker OPEN for ${contractName}: too many recent failures`,
      contractName,
    );
    this.name = "CircuitOpenError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ContractExecutionError extends GenLayerError {
  cause: unknown;

  constructor(contractName: string, cause: unknown) {
    const detail =
      cause instanceof Error ? cause.message : String(cause);
    super(`Contract ${contractName} threw: ${detail}`, contractName);
    this.name = "ContractExecutionError";
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const PLACEHOLDER_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000002",
  "0x0000000000000000000000000000000000000003",
  "0x0000000000000000000000000000000000000004",
]);

export function classifyError(
  err: unknown,
  contractName: string,
): GenLayerError {
  if (err instanceof GenLayerError) return err;

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();

    if (
      msg.includes("placeholder") ||
      PLACEHOLDER_ADDRESSES.has(
        (err as Error & { address?: string }).address ?? "",
      )
    ) {
      return new ContractNotDeployedError(contractName);
    }

    if (msg.includes("timeout") || msg.includes("timed out")) {
      return new ContractTimeoutError(contractName, 120_000);
    }

    // 4xx-equivalent: "invalid", "revert", "validation", "unauthorized"
    if (
      msg.includes("invalid") ||
      msg.includes("revert") ||
      msg.includes("validation") ||
      msg.includes("unauthorized") ||
      msg.includes("bad request")
    ) {
      return new ContractValidationError(contractName, err.message);
    }

    return new ContractExecutionError(contractName, err);
  }

  return new ContractExecutionError(contractName, err);
}
