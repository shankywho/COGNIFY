import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { creditLedgerService, InsufficientCreditsError } from "../src/services/billing/creditLedger.service";
import { prisma } from "../src/config/db";

describe("CreditLedgerService - O(1) Atomic Credit Balance & Row Locking", () => {
  let originalTransaction: any;
  let originalFindUnique: any;
  let originalGroupBy: any;

  beforeEach(() => {
    originalTransaction = prisma.$transaction;
    originalFindUnique = (prisma.workspace as any).findUnique;
    originalGroupBy = (prisma.creditLedger as any).groupBy;
  });

  afterEach(() => {
    prisma.$transaction = originalTransaction;
    (prisma.workspace as any).findUnique = originalFindUnique;
    (prisma.creditLedger as any).groupBy = originalGroupBy;
  });

  test("getBalance reads creditBalance directly from Workspace in O(1) time", async () => {
    (prisma.workspace as any).findUnique = async () => ({
      creditBalance: 8500,
    });
    (prisma.creditLedger as any).groupBy = async () => [
      { type: "CREDIT", _sum: { amount: 10000 } },
      { type: "COMMIT", _sum: { amount: 1500 } },
    ];

    const balance = await creditLedgerService.getBalance("ws-test-123");
    assert.strictEqual(balance.available, 8500);
    assert.strictEqual(balance.totalCredited, 10000);
    assert.strictEqual(balance.totalCommitted, 1500);
  });

  test("reserveCredits executes conditional atomic decrement and returns ledger record", async () => {
    let rawQueryExecuted = false;
    let ledgerCreated = false;

    prisma.$transaction = (async (callback: any) => {
      const mockTx: any = {
        creditLedger: {
          findUnique: async () => null,
          create: async (args: any) => {
            ledgerCreated = true;
            return { id: "ledger-1", ...args.data };
          },
        },
        $queryRaw: async (query: any, ...args: any[]) => {
          rawQueryExecuted = true;
          // Return simulated updated row with new balance
          return [{ credit_balance: 9500 }];
        },
      };
      return callback(mockTx);
    }) as any;

    const record = await creditLedgerService.reserveCredits("ws-1", "run-1", 500, "ref-reserve-1");
    assert.strictEqual(rawQueryExecuted, true);
    assert.strictEqual(ledgerCreated, true);
    assert.strictEqual(record?.amount, 500);
    assert.strictEqual(record?.type, "RESERVE");
  });

  test("reserveCredits throws InsufficientCreditsError (402) when balance is inadequate (0 rows returned)", async () => {
    prisma.$transaction = (async (callback: any) => {
      const mockTx: any = {
        creditLedger: {
          findUnique: async () => null,
        },
        workspace: {
          findUnique: async () => ({ creditBalance: 200 }),
        },
        $queryRaw: async () => {
          // 0 rows updated because credit_balance < amount
          return [];
        },
      };
      return callback(mockTx);
    }) as any;

    await assert.rejects(
      async () => {
        await creditLedgerService.reserveCredits("ws-1", "run-1", 500, "ref-reserve-fail");
      },
      (err: any) => {
        assert.ok(err instanceof InsufficientCreditsError);
        assert.strictEqual(err.statusCode, 402);
        assert.strictEqual(err.required, 500);
        assert.strictEqual(err.available, 200);
        return true;
      }
    );
  });

  test("reserveCredits returns existing record if referenceId was previously reserved (idempotency)", async () => {
    const existingRecord = {
      id: "ledger-existing",
      workspaceId: "ws-1",
      runId: "run-1",
      type: "RESERVE",
      amount: 500,
      referenceId: "ref-idempotent-1",
    };

    prisma.$transaction = (async (callback: any) => {
      const mockTx: any = {
        creditLedger: {
          findUnique: async ({ where }: any) => {
            if (where.referenceId === "ref-idempotent-1") return existingRecord;
            return null;
          },
        },
        $queryRaw: async () => {
          throw new Error("Must not run UPDATE query on idempotent duplicate");
        },
      };
      return callback(mockTx);
    }) as any;

    const record = await creditLedgerService.reserveCredits("ws-1", "run-1", 500, "ref-idempotent-1");
    assert.deepStrictEqual(record, existingRecord);
  });

  test("settleRunCredits adjusts credit_balance by net difference (reservedAmount - actualAmount)", async () => {
    let netAdjusted: number | null = null;

    prisma.$transaction = (async (callback: any) => {
      const mockTx: any = {
        creditLedger: {
          findUnique: async () => null,
          create: async (args: any) => ({ id: "leg-1", ...args.data }),
        },
        $queryRaw: async (query: any, ...values: any[]) => {
          // values[0] is netDelta
          netAdjusted = values[0];
          return [{ credit_balance: 9860 }];
        },
      };
      return callback(mockTx);
    }) as any;

    // Reserved 500, but actually only consumed 140 -> net adjustment is +(500 - 140) = +360
    const newBalance = await creditLedgerService.settleRunCredits("ws-1", "run-1", 500, 140);
    assert.strictEqual(netAdjusted, 360);
    assert.strictEqual(newBalance, 9860);
  });
});
