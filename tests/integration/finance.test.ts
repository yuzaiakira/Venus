import { beforeEach, describe, expect, it } from "vitest";
import { createFinance } from "../../src/application/finance";
import {
  createWorkspace,
  memoryPreferences,
} from "../../src/application/workspace";
import { db, financeDb } from "../../src/infrastructure/db";

beforeEach(async () => {
  if (!db.isOpen()) await db.open();
  await Promise.all([
    db.profiles.clear(),
    db.widgets.clear(),
    db.financeAccounts.clear(),
    db.financeCategories.clear(),
    db.financeTransactions.clear(),
    db.financeBudgets.clear(),
    db.financeBills.clear(),
    db.financeBillPayments.clear(),
  ]);
});
async function harness() {
  const workspace = createWorkspace(memoryPreferences());
  const profile = (await workspace.load()).profiles[0];
  if (!profile) throw new Error("profile");
  return { profile, workspace, finance: createFinance(financeDb) };
}

describe("Finance Snapshot persistence and safety", () => {
  it("keeps balances and monthly totals exact across income, expense, transfer, budget and reversal", async () => {
    const { profile, finance } = await harness();
    const cash = await finance.createAccount(profile.id, {
      name: "Cash",
      type: "cash",
      currency: "USD",
      openingBalanceMinor: 1000,
    });
    const bank = await finance.createAccount(profile.id, {
      name: "Bank",
      type: "bank",
      currency: "USD",
      openingBalanceMinor: 0,
    });
    const expense = await finance.createCategory(profile.id, {
      name: "Food",
      kind: "expense",
    });
    const income = await finance.createCategory(profile.id, {
      name: "Pay",
      kind: "income",
    });
    await finance.createTransaction(profile.id, {
      kind: "income",
      amountMinor: 5000,
      currency: "USD",
      accountId: cash.id,
      toAccountId: null,
      categoryId: income.id,
      date: "2026-10-01",
      description: "Salary",
    });
    const lunch = await finance.createTransaction(profile.id, {
      kind: "expense",
      amountMinor: 1250,
      currency: "USD",
      accountId: cash.id,
      toAccountId: null,
      categoryId: expense.id,
      date: "2026-10-02",
      description: "Lunch",
    });
    await finance.createTransaction(profile.id, {
      kind: "transfer",
      amountMinor: 1000,
      currency: "USD",
      accountId: cash.id,
      toAccountId: bank.id,
      categoryId: null,
      date: "2026-10-03",
      description: "Move",
    });
    await finance.saveBudget(profile.id, {
      categoryId: expense.id,
      month: "2026-10",
      currency: "USD",
      limitMinor: 1000,
    });
    let loaded = await finance.load(profile.id, "2026-10", "2026-10-04");
    expect(loaded.summaries).toEqual([
      expect.objectContaining({
        currency: "USD",
        incomeMinor: 5000,
        expenseMinor: 1250,
        balanceMinor: 4750,
        budgetSpentMinor: 1250,
        remainingMinor: -250,
      }),
    ]);
    await finance.reverseTransaction(profile.id, lunch.id, lunch.revision);
    loaded = await finance.load(profile.id, "2026-10", "2026-10-04");
    expect(loaded.summaries[0]).toMatchObject({
      expenseMinor: 0,
      budgetSpentMinor: 0,
      balanceMinor: 6000,
    });
  });
  it("does not convert currencies, rejects stale writes, and preserves finance after reopening", async () => {
    const { profile, finance } = await harness();
    const usd = await finance.createAccount(profile.id, {
      name: "USD",
      type: "cash",
      currency: "USD",
      openingBalanceMinor: 0,
    });
    const jpy = await finance.createAccount(profile.id, {
      name: "JPY",
      type: "cash",
      currency: "JPY",
      openingBalanceMinor: 0,
    });
    await expect(
      finance.createTransaction(profile.id, {
        kind: "transfer",
        amountMinor: 1,
        currency: "USD",
        accountId: usd.id,
        toAccountId: jpy.id,
        categoryId: null,
        date: "2026-10-01",
        description: "No conversion",
      }),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(
      finance.updateAccount(profile.id, usd.id, usd.revision - 1, {
        name: "stale",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    db.close();
    await db.open();
    expect(
      (await finance.load(profile.id, "2026-10")).accounts
        .map((row) => row.name)
        .sort(),
    ).toEqual(["JPY", "USD"]);
  });
  it("makes bill payment idempotent, links exactly one expense, exports safely, and clears only finance data", async () => {
    const { profile, workspace, finance } = await harness();
    const account = await finance.createAccount(profile.id, {
      name: "Bills",
      type: "bank",
      currency: "USD",
      openingBalanceMinor: 0,
    });
    const category = await finance.createCategory(profile.id, {
      name: "Utilities",
      kind: "expense",
    });
    const bill = await finance.saveBill(profile.id, {
      title: "=Electric",
      amountMinor: 999,
      currency: "USD",
      dueDate: "2026-01-31",
      recurrence: "monthly",
      categoryId: category.id,
      accountId: account.id,
    });
    const first = await finance.markBillPaid(
      profile.id,
      bill.id,
      bill.revision,
      "2026-02-28",
      "paid",
      true,
    );
    const replay = await finance.markBillPaid(
      profile.id,
      bill.id,
      bill.revision,
      "2026-02-28",
      "paid",
      true,
    );
    expect(replay.payment.id).toBe(first.payment.id);
    const loaded = await finance.load(profile.id, "2026-02", "2026-03-01");
    expect(loaded.payments).toHaveLength(1);
    expect(loaded.transactions).toHaveLength(1);
    expect(await finance.csv(profile.id)).toContain("'=Electric");
    const other = await workspace.createProfile("minimal", "Other");
    const otherAccount = await finance.createAccount(other.id, {
      name: "Keep",
      type: "cash",
      currency: "USD",
      openingBalanceMinor: 1,
    });
    await finance.clearProfile(profile.id);
    expect((await finance.load(profile.id, "2026-02")).accounts).toHaveLength(
      0,
    );
    expect((await finance.load(other.id, "2026-02")).accounts[0]?.id).toBe(
      otherAccount.id,
    );
  });
});
