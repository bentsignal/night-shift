export class AuthorityLeaseGuard {
  readonly #now: () => number;
  readonly #safetyMarginMs: number;
  #leaseExpiresAt: number;
  #available = true;

  constructor(options: {
    leaseExpiresAt: number;
    now?: () => number;
    safetyMarginMs?: number;
  }) {
    this.#leaseExpiresAt = options.leaseExpiresAt;
    this.#now = options.now ?? Date.now;
    this.#safetyMarginMs = options.safetyMarginMs ?? 5_000;
  }

  canStartOperation(): boolean {
    return (
      this.#available &&
      this.#now() < this.#leaseExpiresAt - this.#safetyMarginMs
    );
  }

  refresh(leaseExpiresAt: number): void {
    this.#leaseExpiresAt = leaseExpiresAt;
    this.#available = true;
  }

  revoke(): void {
    this.#available = false;
  }
}
