import { beforeEach, describe, expect, it } from "vitest";
import { createFinance } from "../../src/application/finance";
import { parseSignedMinor } from "../../src/domain/finance";
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
  it("scopes income, expenses, reversals, and budgets to the selected month while balances remain lifetime-based", async () => {
    const { profile, finance } = await harness();
    const account = await finance.createAccount(profile.id, {
      name: "Main",
      type: "bank",
      currency: "USD",
      openingBalanceMinor: parseSignedMinor("0", "USD"),
    });
    const positive = await finance.createAccount(profile.id, {
      name: "Credit",
      type: "card",
      currency: "USD",
      openingBalanceMinor: parseSignedMinor("12.34", "USD"),
    });
    const negative = await finance.createAccount(profile.id, {
      name: "Overdraft",
      type: "bank",
      currency: "USD",
      openingBalanceMinor: parseSignedMinor("-5.50", "USD"),
    });
    const income = await finance.createCategory(profile.id, {
      name: "Pay",
      kind: "income",
    });
    const expense = await finance.createCategory(profile.id, {
      name: "Food",
      kind: "expense",
    });
    await finance.createTransaction(profile.id, {
      kind: "income",
      amountMinor: 1000,
      currency: "USD",
      accountId: account.id,
      categoryId: income.id,
      date: "2026-09-15",
      description: "September pay",
    });
    await finance.createTransaction(profile.id, {
      kind: "income",
      amountMinor: 2000,
      currency: "USD",
      accountId: account.id,
      categoryId: income.id,
      date: "2026-10-15",
      description: "October pay",
    });
    const octoberExpense = await finance.createTransaction(profile.id, {
      kind: "expense",
      amountMinor: 500,
      currency: "USD",
      accountId: account.id,
      categoryId: expense.id,
      date: "2026-10-16",
      description: "October food",
    });
    await finance.createTransaction(profile.id, {
      kind: "expense",
      amountMinor: 300,
      currency: "USD",
      accountId: account.id,
      categoryId: expense.id,
      date: "2026-11-16",
      description: "November food",
    });
    await finance.saveBudget(profile.id, {
      categoryId: expense.id,
      month: "2026-10",
      currency: "USD",
      limitMinor: 1000,
    });
    const september = await finance.load(profile.id, "2026-09");
    const october = await finance.load(profile.id, "2026-10");
    const november = await finance.load(profile.id, "2026-11");
    expect(september.summaries[0]).toMatchObject({
      incomeMinor: 1000,
      expenseMinor: 0,
      balanceMinor: 2884,
    });
    expect(october.summaries[0]).toMatchObject({
      incomeMinor: 2000,
      expenseMinor: 500,
      balanceMinor: 2884,
      budgetSpentMinor: 500,
    });
    expect(november.summaries[0]).toMatchObject({
      incomeMinor: 0,
      expenseMinor: 300,
      balanceMinor: 2884,
    });
    expect(october.budgetProgress).toEqual([
      expect.objectContaining({ spentMinor: 500 }),
    ]);
    await finance.reverseTransaction(
      profile.id,
      octoberExpense.id,
      octoberExpense.revision,
    );
    const adjustedOctober = await finance.load(profile.id, "2026-10");
    const adjustedNovember = await finance.load(profile.id, "2026-11");
    expect(adjustedOctober.summaries[0]).toMatchObject({
      incomeMinor: 2000,
      expenseMinor: 0,
      balanceMinor: 3384,
      budgetSpentMinor: 0,
    });
    expect(adjustedNovember.summaries[0]).toMatchObject({
      incomeMinor: 0,
      expenseMinor: 300,
      balanceMinor: 3384,
    });
    expect(
      (await finance.load(profile.id, "2026-10")).accounts
        .map((row) => row.openingBalanceMinor)
        .sort((a, b) => a - b),
    ).toEqual([-550, 0, 1234]);
    expect(positive.openingBalanceMinor).toBe(1234);
    expect(negative.openingBalanceMinor).toBe(-550);
  });
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
      name: " \t=Bills",
      type: "bank",
      currency: "USD",
      openingBalanceMinor: 0,
    });
    const category = await finance.createCategory(profile.id, {
      name: "\u200b@Utilities",
      kind: "expense",
    });
    const bill = await finance.saveBill(profile.id, {
      title: "\r\n-Electric",
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
      "\t=paid",
      true,
    );
    const replay = await finance.markBillPaid(
      profile.id,
      bill.id,
      bill.revision,
      "2026-02-28",
      "\t=paid",
      true,
    );
    expect(replay.payment.id).toBe(first.payment.id);
    const loaded = await finance.load(profile.id, "2026-02", "2026-03-01");
    expect(loaded.payments).toHaveLength(1);
    expect(loaded.transactions).toHaveLength(1);
    await finance.createTransaction(profile.id, {
      kind: "expense",
      amountMinor: 1,
      currency: "USD",
      accountId: account.id,
      categoryId: category.id,
      date: "2026-02-28",
      description: " \t=Manual description",
    });
    const csv = await finance.csv(profile.id);
    expect(csv).toContain("'=Bills");
    expect(csv).toContain("'\u200b@Utilities");
    expect(csv).toContain("'-Electric");
    expect(csv).toContain("'=paid");
    expect(csv).toContain("'=Manual description");
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
