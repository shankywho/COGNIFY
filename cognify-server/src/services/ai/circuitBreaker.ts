import { logger } from "../../config/logger";
import { MeshProvider } from "./providers/mesh.provider";
import { GroqProvider } from "./providers/groq.provider";
import { AIProvider } from "./providers/base.providers";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  name?: string;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  requestTimeoutMs?: number;
}

export class CircuitBreakerOpenError extends Error {
  public state: CircuitState = "OPEN";
  public nextAttempt: number;

  constructor(name: string, nextAttempt: number) {
    super(`Circuit breaker [${name}] is OPEN. Fast-failing request until ${new Date(nextAttempt).toISOString()}`);
    this.name = "CircuitBreakerOpenError";
    this.nextAttempt = nextAttempt;
  }
}

export class CircuitBreakerTimeoutError extends Error {
  constructor(name: string, timeoutMs: number) {
    super(`Request to [${name}] timed out after ${timeoutMs}ms`);
    this.name = "CircuitBreakerTimeoutError";
  }
}

/**
 * Deterministic Circuit Breaker state machine (CLOSED -> OPEN -> HALF_OPEN).
 * Prevents cascading failures and hung sockets during upstream LLM provider outages.
 */
export class CircuitBreaker {
  public name: string;
  public failureThreshold: number;
  public resetTimeoutMs: number;
  public requestTimeoutMs: number;

  private state: CircuitState = "CLOSED";
  private failureCount: number = 0;
  private nextAttempt: number = 0;

  constructor(options: CircuitBreakerOptions = {}) {
    this.name = options.name || "DefaultBreaker";
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 25000;
  }

  getState(): CircuitState {
    if (this.state === "OPEN" && Date.now() >= this.nextAttempt) {
      this.state = "HALF_OPEN";
    }
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  getNextAttempt(): number {
    return this.nextAttempt;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === "OPEN") {
      throw new CircuitBreakerOpenError(this.name, this.nextAttempt);
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (err: any) {
      this.onFailure(err);
      throw err;
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new CircuitBreakerTimeoutError(this.name, this.requestTimeoutMs));
      }, this.requestTimeoutMs);
    });

    try {
      return await Promise.race([fn(), timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      logger.info(`Circuit breaker [${this.name}] recovered from HALF_OPEN -> CLOSED`);
    }
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  private onFailure(err: any): void {
    this.failureCount += 1;
    logger.warn(
      `Circuit breaker [${this.name}] recorded failure #${this.failureCount}/${this.failureThreshold} (state: ${this.state}): ${err?.message || err}`
    );

    if (this.state === "HALF_OPEN" || this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
      logger.error(
        `Circuit breaker [${this.name}] TRIPPED -> OPEN until ${new Date(this.nextAttempt).toISOString()}`
      );
    }
  }

  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.nextAttempt = 0;
  }
}

/**
 * Enterprise Multi-LLM Gateway with Circuit Breaker and automated fallback routing.
 */
export class LLMGateway {
  public primaryProvider: AIProvider;
  public fallbackProvider: AIProvider;
  public primaryBreaker: CircuitBreaker;
  public fallbackBreaker: CircuitBreaker;

  constructor(
    primaryProvider: AIProvider = new MeshProvider(),
    fallbackProvider: AIProvider = new GroqProvider(),
    options?: { primaryBreaker?: CircuitBreaker; fallbackBreaker?: CircuitBreaker }
  ) {
    this.primaryProvider = primaryProvider;
    this.fallbackProvider = fallbackProvider;
    this.primaryBreaker =
      options?.primaryBreaker ||
      new CircuitBreaker({
        name: "PrimaryLLMProvider",
        failureThreshold: 5,
        resetTimeoutMs: 30000,
        requestTimeoutMs: 25000,
      });
    this.fallbackBreaker =
      options?.fallbackBreaker ||
      new CircuitBreaker({
        name: "FallbackLLMProvider",
        failureThreshold: 5,
        resetTimeoutMs: 30000,
        requestTimeoutMs: 25000,
      });
  }

  async generate(prompt: string): Promise<string> {
    try {
      return await this.primaryBreaker.execute(() =>
        this.primaryProvider.generateResponse(prompt)
      );
    } catch (primaryErr: any) {
      logger.warn(
        `Primary LLM provider failed or breaker OPEN (${primaryErr.message}). Routing request to fallback provider...`
      );
      return await this.fallbackBreaker.execute(() =>
        this.fallbackProvider.generateResponse(prompt)
      );
    }
  }
}

export const llmGateway = new LLMGateway();
