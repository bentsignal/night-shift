import { describe, expect, it } from "vitest";

import { AuthorityLeaseGuard } from "./authority-guard";

describe("AuthorityLeaseGuard", () => {
  it("stops new operations before the local lease deadline", () => {
    let now = 1_000;
    const guard = new AuthorityLeaseGuard({
      leaseExpiresAt: 10_000,
      safetyMarginMs: 2_000,
      now: () => now,
    });

    expect(guard.canStartOperation()).toBe(true);
    now = 8_000;
    expect(guard.canStartOperation()).toBe(false);
  });

  it("revokes immediately on authority loss and can refresh", () => {
    const guard = new AuthorityLeaseGuard({
      leaseExpiresAt: 10_000,
      now: () => 1_000,
    });
    guard.revoke();
    expect(guard.canStartOperation()).toBe(false);
    guard.refresh(20_000);
    expect(guard.canStartOperation()).toBe(true);
  });
});
