import { Prisma, LedgerType } from "@prisma/client";
import { prisma } from "../../config/db";
import { logger } from "../../config/logger";

export class InsufficientCreditsError extends Error {
  public statusCode = 402;
  public workspaceId: string;
  public required: number;
  public available: number;

  constructor(workspaceId: string, required: number, available: number) {
    super(
      `Insufficient credits for workspace ${workspaceId}: required ${required}, available ${available}`
    );
    this.name = "InsufficientCreditsError";
    this.workspaceId = workspaceId;
    this.required = required;
    this.available = available;
  }
}

/**
 * Computes available credits: (CREDIT + REFUND) - (RESERVE + COMMIT)
 * Guarantees mathematical drift-free balance accounting.
 */
async function computeBalance(
  tx: Prisma.TransactionClient,
  workspaceId: string
): Promise<number> {
  const aggregates = await tx.creditLedger.groupBy({
    by: ["type"],
    where: { workspaceId },
    _sum: { amount: true },
  });

  let credits = 0;
  let refunds = 0;
  let reserves = 0;
  let commits = 0;

  for (const agg of aggregates) {
    const sum = agg._sum.amount || 0;
    if (agg.type === "CREDIT") credits = sum;
    else if (agg.type === "REFUND") refunds = sum;
    else if (agg.type === "RESERVE") reserves = sum;
    else if (agg.type === "COMMIT") commits = sum;
  }

  return credits + refunds - (reserves + commits);
}

export const creditLedgerService = {
  /**
   * Retrieves the current available balance in O(1) time from Workspace,
   * alongside aggregate breakdown for telemetry and audit display.
   */
  async getBalance(workspaceId: string): Promise<{
    available: number;
    totalCredited: number;
    totalReserved: number;
    totalCommitted: number;
  }> {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { creditBalance: true },
    });

    const aggregates = await prisma.creditLedger.groupBy({
      by: ["type"],
      where: { workspaceId },
      _sum: { amount: true },
    });

    let credits = 0;
    let refunds = 0;
    let reserves = 0;
    let commits = 0;

    for (const agg of aggregates) {
      const sum = agg._sum.amount || 0;
      if (agg.type === "CREDIT") credits = sum;
      else if (agg.type === "REFUND") refunds = sum;
      else if (agg.type === "RESERVE") reserves = sum;
      else if (agg.type === "COMMIT") commits = sum;
    }

    const available = workspace?.creditBalance ?? (credits + refunds - (reserves + commits));
    return {
      available,
      totalCredited: credits,
      totalReserved: Math.max(0, reserves - refunds),
      totalCommitted: commits,
    };
  },

  /**
   * Atomically checks available balance and reserves credits for a workflow run in O(1) time.
   * Employs an atomic conditional update:
   * UPDATE workspaces SET credit_balance = credit_balance - $amount WHERE id = $workspaceId AND credit_balance >= $amount RETURNING credit_balance
   * If 0 rows match, throws typed InsufficientCreditsError (402).
   * Persists an immutable RESERVE record in CreditLedger for auditable accounting.
   */
  async reserveCredits(
    workspaceId: string,
    runId: string,
    amount: number,
    referenceId: string
  ) {
    if (amount <= 0) return null;

    return prisma.$transaction(async (tx) => {
      // 1. Check idempotency first: if referenceId exists, return the existing reservation
      const existing = await tx.creditLedger.findUnique({
        where: { referenceId },
      });
      if (existing) {
        return existing;
      }

      // 2. O(1) Atomic conditional update with row lock
      const updated = await tx.$queryRaw<{ credit_balance: number }[]>`
        UPDATE workspaces
        SET credit_balance = credit_balance - ${amount}
        WHERE id = ${workspaceId} AND credit_balance >= ${amount}
        RETURNING credit_balance
      `;

      if (!updated || updated.length === 0) {
        const ws = await tx.workspace.findUnique({
          where: { id: workspaceId },
          select: { creditBalance: true },
        });
        const currentAvailable = ws?.creditBalance ?? 0;
        logger.warn(
          `Insufficient credits in workspace ${workspaceId}: required ${amount}, available ${currentAvailable}`
        );
        throw new InsufficientCreditsError(workspaceId, amount, currentAvailable);
      }

      // 3. Persist immutable RESERVE entry in the credit ledger
      const record = await tx.creditLedger.create({
        data: {
          workspaceId,
          runId,
          type: "RESERVE",
          amount,
          referenceId,
        },
      });

      logger.info(
        `Reserved ${amount} credits for run ${runId} in workspace ${workspaceId}. Remaining: ${updated[0].credit_balance}`
      );
      return record;
    });
  },

  /**
   * Settles the credits for a completed workflow run.
   * Atomically releases the reservation hold (REFUND) and commits actual token cost (COMMIT),
   * while adjusting workspace.credit_balance by the net difference (reservedAmount - actualAmount).
   */
  async settleRunCredits(
    workspaceId: string,
    runId: string,
    reservedAmount: number,
    actualAmount: number
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Release reserved hold if previously reserved
      if (reservedAmount > 0) {
        const releaseRef = `settle-release-${runId}`;
        const existingRelease = await tx.creditLedger.findUnique({
          where: { referenceId: releaseRef },
        });
        if (!existingRelease) {
          await tx.creditLedger.create({
            data: {
              workspaceId,
              runId,
              type: "REFUND",
              amount: reservedAmount,
              referenceId: releaseRef,
            },
          });
        }
      }

      // 2. Commit actual charge
      const commitRef = `settle-commit-${runId}`;
      const existingCommit = await tx.creditLedger.findUnique({
        where: { referenceId: commitRef },
      });
      if (!existingCommit && actualAmount > 0) {
        await tx.creditLedger.create({
          data: {
            workspaceId,
            runId,
            type: "COMMIT",
            amount: actualAmount,
            referenceId: commitRef,
          },
        });
      }

      // 3. Atomically adjust workspace credit_balance by the net delta (hold refund - actual commit)
      const netDelta = reservedAmount - actualAmount;
      let newBalance = 0;
      if (netDelta !== 0) {
        const updated = await tx.$queryRaw<{ credit_balance: number }[]>`
          UPDATE workspaces
          SET credit_balance = credit_balance + ${netDelta}
          WHERE id = ${workspaceId}
          RETURNING credit_balance
        `;
        newBalance = updated?.[0]?.credit_balance ?? 0;
      } else {
        const ws = await tx.workspace.findUnique({
          where: { id: workspaceId },
          select: { creditBalance: true },
        });
        newBalance = ws?.creditBalance ?? 0;
      }

      logger.info(
        `Settled credits for run ${runId}: reserved=${reservedAmount}, actual=${actualAmount}, netDelta=${netDelta}, newBalance=${newBalance}`
      );
      return newBalance;
    });
  },

  /**
   * Fully refunds reservation hold if a run fails before consuming tokens,
   * atomically restoring workspace.credit_balance.
   */
  async refundReservation(
    workspaceId: string,
    runId: string,
    reservedAmount: number
  ) {
    if (reservedAmount <= 0) return;

    return prisma.$transaction(async (tx) => {
      const refundRef = `refund-reservation-${runId}`;
      const existing = await tx.creditLedger.findUnique({
        where: { referenceId: refundRef },
      });
      if (existing) return existing;

      // 1. Atomically restore credit_balance
      await tx.$queryRaw`
        UPDATE workspaces
        SET credit_balance = credit_balance + ${reservedAmount}
        WHERE id = ${workspaceId}
      `;

      // 2. Persist immutable REFUND ledger entry
      const record = await tx.creditLedger.create({
        data: {
          workspaceId,
          runId,
          type: "REFUND",
          amount: reservedAmount,
          referenceId: refundRef,
        },
      });

      logger.info(
        `Refunded full reservation of ${reservedAmount} credits for run ${runId}`
      );
      return record;
    });
  },

  /**
   * Adds credits to a workspace (e.g. from payment webhook or manual top-up).
   * Idempotent via unique referenceId, atomically updating workspace.credit_balance.
   */
  async addCredit(
    workspaceId: string,
    amount: number,
    referenceId: string
  ) {
    if (amount <= 0) return null;

    return prisma.$transaction(async (tx) => {
      const existing = await tx.creditLedger.findUnique({
        where: { referenceId },
      });
      if (existing) return existing;

      // 1. Atomically increment workspace credit_balance
      const updated = await tx.$queryRaw<{ credit_balance: number }[]>`
        UPDATE workspaces
        SET credit_balance = credit_balance + ${amount}
        WHERE id = ${workspaceId}
        RETURNING credit_balance
      `;

      // 2. Persist immutable CREDIT ledger entry
      const record = await tx.creditLedger.create({
        data: {
          workspaceId,
          type: "CREDIT",
          amount,
          referenceId,
        },
      });

      const newBalance = updated && updated.length > 0 ? updated[0].credit_balance : 0;
      logger.info(
        `Credited ${amount} to workspace ${workspaceId} via ref ${referenceId}. New balance: ${newBalance}`
      );
      return record;
    });
  },
};
