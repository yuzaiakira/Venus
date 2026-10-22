import { WorkspaceError, type ProfileRecord } from "../domain/dashboard";
import {
  accountSchema,
  billOccurrence,
  billPaymentSchema,
  billSchema,
  budgetSchema,
  categorySchema,
  escapeCsv,
  transactionSchema,
  type AccountRecord,
  type BillPaymentRecord,
  type BillRecord,
  type BudgetRecord,
  type CategoryRecord,
  type FinanceTransactionRecord,
} from "../domain/finance";
import type { RowTable } from "./productivity";
import type { WorkspaceChange } from "./workspace";

export interface FinanceDatabase {
  profiles: RowTable<ProfileRecord>;
  accounts: RowTable<AccountRecord>;
  financeCategories: RowTable<CategoryRecord>;
  financeTransactions: RowTable<FinanceTransactionRecord>;
  budgets: RowTable<BudgetRecord>;
  bills: RowTable<BillRecord>;
  billPayments: RowTable<BillPaymentRecord>;
  transaction<T>(
    mode: "rw",
    tables: RowTable<unknown>[],
    work: () => Promise<T>,
  ): Promise<T>;
}
export type CurrencySummary = {
  currency: string;
  incomeMinor: number;
  expenseMinor: number;
  balanceMinor: number;
  budgetLimitMinor: number;
  budgetSpentMinor: number;
  remainingMinor: number;
};
export type DueBill = {
  bill: BillRecord;
  occurrenceDate: string;
  paid: boolean;
  overdue: boolean;
  payment: BillPaymentRecord | null;
};
export type BudgetProgress = {
  budgetId: string;
  spentMinor: number;
};
export type FinanceWorkspace = {
  accounts: AccountRecord[];
  categories: CategoryRecord[];
  transactions: FinanceTransactionRecord[];
  budgets: BudgetRecord[];
  bills: BillRecord[];
  payments: BillPaymentRecord[];
  summaries: CurrencySummary[];
  budgetProgress: BudgetProgress[];
  dueBills: DueBill[];
  month: string;
};
const stamp = (revision = 1) => {
  const now = new Date().toISOString();
  return { revision, createdAt: now, updatedAt: now };
};
const bump = <T extends { revision: number; updatedAt: string }>(
  row: T,
  patch: Partial<T>,
) => ({
  ...row,
  ...patch,
  revision: row.revision + 1,
  updatedAt: new Date().toISOString(),
});
export function createFinance(
  database: FinanceDatabase,
  notify: (change: WorkspaceChange) => void = () => {},
) {
  const changed = (id: string, revision: number) =>
    notify({ type: "workspace", id, revision });
  const profile = async (id: string) => {
    if (!(await database.profiles.get(id)))
      throw new WorkspaceError("notFound");
  };
  const own = async <T extends { profileId: string; revision: number }>(
    table: RowTable<T>,
    profileId: string,
    id: string,
    expected: number,
  ) => {
    const row = await table.get(id);
    if (!row || row.profileId !== profileId)
      throw new WorkspaceError("notFound");
    if (row.revision !== expected) throw new WorkspaceError("conflict");
    return row;
  };
  const account = async (profileId: string, id: string) => {
    const row = await database.accounts.get(id);
    if (!row || row.profileId !== profileId || row.archived)
      throw new WorkspaceError("invalidInput");
    return row;
  };
  const category = async (
    profileId: string,
    id: string | null,
    kind: "income" | "expense",
  ) => {
    if (!id) return null;
    const row = await database.financeCategories.get(id);
    if (
      !row ||
      row.profileId !== profileId ||
      row.archived ||
      row.kind !== kind
    )
      throw new WorkspaceError("invalidInput");
    return row;
  };
  async function load(
    profileId: string,
    month: string,
    today = todayUTC(),
  ): Promise<FinanceWorkspace> {
    await profile(profileId);
    const [accounts, categories, transactions, budgets, bills, payments] =
      await Promise.all([
        database.accounts.toArray(),
        database.financeCategories.toArray(),
        database.financeTransactions.toArray(),
        database.budgets.toArray(),
        database.bills.toArray(),
        database.billPayments.toArray(),
      ]);
    const scoped = <T extends { profileId: string }>(rows: T[]) =>
      rows.filter((row) => row.profileId === profileId);
    const ownAccounts = scoped(accounts),
      ownCategories = scoped(categories),
      ownTransactions = scoped(transactions).sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
      ownBudgets = scoped(budgets).filter((row) => row.month === month),
      ownBills = scoped(bills),
      ownPayments = scoped(payments);
    const byCurrency = new Map<string, CurrencySummary>();
    const ensure = (currency: string) =>
      byCurrency.get(currency) ??
      (byCurrency.set(currency, {
        currency,
        incomeMinor: 0,
        expenseMinor: 0,
        balanceMinor: 0,
        budgetLimitMinor: 0,
        budgetSpentMinor: 0,
        remainingMinor: 0,
      }),
      byCurrency.get(currency)!);
    for (const row of ownAccounts)
      ensure(row.currency).balanceMinor += row.openingBalanceMinor;
    const originals = new Map(ownTransactions.map((row) => [row.id, row]));
    const periodTransactions = ownTransactions.filter(
      (row) => row.date.slice(0, 7) === month,
    );
    for (const row of ownTransactions) {
      const sum = ensure(row.currency);
      if (row.kind === "income") {
        sum.balanceMinor += row.amountMinor;
      } else if (row.kind === "expense") {
        sum.balanceMinor -= row.amountMinor;
      } else if (row.kind === "transfer") {
        sum.balanceMinor -= row.amountMinor;
      } else {
        const original = originals.get(row.reversedTransactionId ?? "");
        if (original?.kind === "income") sum.balanceMinor -= row.amountMinor;
        if (original?.kind === "expense") sum.balanceMinor += row.amountMinor;
      }
    }
    /**
     * A reversal copies its original transaction date when it is created. It
     * therefore adjusts that original accounting period rather than today.
     * Balances remain lifetime-based; period income, expense, and budgets use
     * the same immutable transaction-date rule.
     */
    for (const row of periodTransactions) {
      const sum = ensure(row.currency);
      if (row.kind === "income") sum.incomeMinor += row.amountMinor;
      if (row.kind === "expense") sum.expenseMinor += row.amountMinor;
      if (row.kind === "reversal") {
        const original = originals.get(row.reversedTransactionId ?? "");
        if (original?.kind === "income") sum.incomeMinor -= row.amountMinor;
        if (original?.kind === "expense") sum.expenseMinor -= row.amountMinor;
      }
    }
    for (const row of ownTransactions.filter((row) => row.kind === "transfer"))
      ensure(row.currency).balanceMinor += row.amountMinor;
    const budgetProgress: BudgetProgress[] = [];
    for (const row of ownBudgets) {
      const sum = ensure(row.currency);
      sum.budgetLimitMinor += row.limitMinor;
      const spent = periodTransactions
        .filter((tx) => tx.currency === row.currency)
        .reduce((total, tx) => {
          if (tx.kind === "expense" && tx.categoryId === row.categoryId)
            return total + tx.amountMinor;
          if (tx.kind === "reversal") {
            const original = originals.get(tx.reversedTransactionId ?? "");
            if (
              original?.kind === "expense" &&
              original.categoryId === row.categoryId
            )
              return total - tx.amountMinor;
          }
          return total;
        }, 0);
      budgetProgress.push({ budgetId: row.id, spentMinor: spent });
      sum.budgetSpentMinor += spent;
    }
    for (const sum of byCurrency.values())
      sum.remainingMinor = sum.budgetLimitMinor - sum.budgetSpentMinor;
    const dueBills: DueBill[] = [];
    for (const bill of ownBills.filter((row) => row.status === "active"))
      for (const occurrenceDate of bill.recurrence === "none"
        ? [bill.dueDate]
        : [
            billOccurrence(bill.dueDate, bill.recurrence, month),
            billOccurrence(bill.dueDate, bill.recurrence, nextMonth(month)),
          ].filter((value): value is string => Boolean(value))) {
        if (occurrenceDate > nextMonth(month) + "-31") continue;
        const payment =
          ownPayments.find(
            (row) =>
              row.billId === bill.id && row.occurrenceDate === occurrenceDate,
          ) ?? null;
        dueBills.push({
          bill,
          occurrenceDate,
          payment,
          paid: Boolean(payment),
          overdue: !payment && occurrenceDate < today,
        });
      }
    return {
      accounts: ownAccounts,
      categories: ownCategories,
      transactions: ownTransactions,
      budgets: ownBudgets,
      bills: ownBills,
      payments: ownPayments,
      summaries: [...byCurrency.values()].sort((a, b) =>
        a.currency.localeCompare(b.currency),
      ),
      budgetProgress,
      dueBills: dueBills.sort((a, b) =>
        a.occurrenceDate.localeCompare(b.occurrenceDate),
      ),
      month,
    };
  }
  async function createAccount(
    profileId: string,
    draft: Pick<
      AccountRecord,
      "name" | "type" | "currency" | "openingBalanceMinor"
    >,
  ) {
    const row = await database.transaction(
      "rw",
      [database.profiles, database.accounts],
      async () => {
        await profile(profileId);
        const next = accountSchema.parse({
          id: crypto.randomUUID(),
          profileId,
          name: draft.name.trim(),
          type: draft.type,
          currency: draft.currency,
          openingBalanceMinor: draft.openingBalanceMinor,
          archived: false,
          ...stamp(),
        });
        await database.accounts.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function updateAccount(
    profileId: string,
    id: string,
    expected: number,
    patch: Partial<
      Pick<AccountRecord, "name" | "type" | "openingBalanceMinor" | "archived">
    >,
  ) {
    const row = await database.transaction(
      "rw",
      [database.accounts],
      async () => {
        const current = await own(database.accounts, profileId, id, expected);
        const next = accountSchema.parse(
          bump(current, {
            ...patch,
            name: patch.name === undefined ? current.name : patch.name.trim(),
          }),
        );
        await database.accounts.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function deleteAccount(
    profileId: string,
    id: string,
    expected: number,
  ) {
    const row = await database.transaction(
      "rw",
      [database.accounts, database.financeTransactions, database.bills],
      async () => {
        const current = await own(database.accounts, profileId, id, expected);
        if (
          (await database.financeTransactions.toArray()).some(
            (tx) => tx.accountId === id || tx.toAccountId === id,
          ) ||
          (await database.bills.toArray()).some((bill) => bill.accountId === id)
        )
          throw new WorkspaceError("conflict");
        await database.accounts.delete(id);
        return current;
      },
    );
    changed(row.id, row.revision + 1);
  }
  async function createCategory(
    profileId: string,
    draft: Pick<CategoryRecord, "name" | "kind">,
  ) {
    const row = await database.transaction(
      "rw",
      [database.profiles, database.financeCategories],
      async () => {
        await profile(profileId);
        const next = categorySchema.parse({
          id: crypto.randomUUID(),
          profileId,
          name: draft.name.trim(),
          kind: draft.kind,
          archived: false,
          ...stamp(),
        });
        await database.financeCategories.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function updateCategory(
    profileId: string,
    id: string,
    expected: number,
    patch: Partial<Pick<CategoryRecord, "name" | "archived">>,
  ) {
    const row = await database.transaction(
      "rw",
      [database.financeCategories],
      async () => {
        const current = await own(
          database.financeCategories,
          profileId,
          id,
          expected,
        );
        const next = categorySchema.parse(
          bump(current, {
            ...patch,
            name: patch.name === undefined ? current.name : patch.name.trim(),
          }),
        );
        await database.financeCategories.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function deleteCategory(
    profileId: string,
    id: string,
    expected: number,
  ) {
    const row = await database.transaction(
      "rw",
      [
        database.financeCategories,
        database.financeTransactions,
        database.budgets,
        database.bills,
      ],
      async () => {
        const current = await own(
          database.financeCategories,
          profileId,
          id,
          expected,
        );
        const linked = [
          ...(await database.financeTransactions.toArray()),
          ...(await database.budgets.toArray()),
          ...(await database.bills.toArray()),
        ].some(
          (item) => item.profileId === profileId && item.categoryId === id,
        );
        if (linked) throw new WorkspaceError("conflict");
        await database.financeCategories.delete(id);
        return current;
      },
    );
    changed(row.id, row.revision + 1);
  }
  async function createTransaction(
    profileId: string,
    draft: Omit<
      Pick<
        FinanceTransactionRecord,
        | "kind"
        | "amountMinor"
        | "currency"
        | "accountId"
        | "toAccountId"
        | "categoryId"
        | "date"
        | "description"
      >,
      "toAccountId" | "categoryId"
    > & {
      toAccountId?: string | null;
      categoryId?: string | null;
      billPaymentId?: string | null;
    },
  ) {
    const row = await database.transaction(
      "rw",
      [
        database.profiles,
        database.accounts,
        database.financeCategories,
        database.financeTransactions,
      ],
      async () => {
        await profile(profileId);
        const from = await account(profileId, draft.accountId);
        const to =
          draft.kind === "transfer"
            ? await account(profileId, draft.toAccountId ?? "")
            : null;
        if (
          draft.kind === "transfer" &&
          (!to || to.id === from.id || to.currency !== from.currency)
        )
          throw new WorkspaceError("invalidInput");
        await category(
          profileId,
          draft.categoryId ?? null,
          draft.kind === "income" ? "income" : "expense",
        );
        const next = transactionSchema.parse({
          id: crypto.randomUUID(),
          profileId,
          kind: draft.kind,
          amountMinor: draft.amountMinor,
          currency: draft.currency,
          accountId: from.id,
          toAccountId: to?.id ?? null,
          categoryId:
            draft.kind === "transfer" ? null : (draft.categoryId ?? null),
          date: draft.date,
          description: draft.description.trim(),
          reversedTransactionId: null,
          billPaymentId: draft.billPaymentId ?? null,
          ...stamp(),
        });
        if (next.currency !== from.currency)
          throw new WorkspaceError("invalidInput");
        await database.financeTransactions.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function updateTransaction(
    profileId: string,
    id: string,
    expected: number,
    patch: Partial<
      Pick<
        FinanceTransactionRecord,
        "amountMinor" | "categoryId" | "date" | "description"
      >
    >,
  ) {
    const row = await database.transaction(
      "rw",
      [database.financeTransactions, database.financeCategories],
      async () => {
        const current = await own(
          database.financeTransactions,
          profileId,
          id,
          expected,
        );
        if (current.kind === "transfer" || current.kind === "reversal")
          throw new WorkspaceError("conflict");
        await category(
          profileId,
          patch.categoryId === undefined
            ? current.categoryId
            : patch.categoryId,
          current.kind,
        );
        const next = transactionSchema.parse(
          bump(current, {
            ...patch,
            description:
              patch.description === undefined
                ? current.description
                : patch.description.trim(),
          }),
        );
        await database.financeTransactions.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function reverseTransaction(
    profileId: string,
    id: string,
    expected: number,
  ) {
    const row = await database.transaction(
      "rw",
      [database.financeTransactions],
      async () => {
        const current = await own(
          database.financeTransactions,
          profileId,
          id,
          expected,
        );
        if (
          current.kind === "transfer" ||
          current.kind === "reversal" ||
          (await database.financeTransactions.toArray()).some(
            (tx) => tx.reversedTransactionId === id,
          )
        )
          throw new WorkspaceError("conflict");
        const next = transactionSchema.parse({
          ...current,
          id: crypto.randomUUID(),
          kind: "reversal",
          reversedTransactionId: id,
          billPaymentId: null,
          ...stamp(),
        });
        await database.financeTransactions.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function deleteTransaction(
    profileId: string,
    id: string,
    expected: number,
  ) {
    const row = await database.transaction(
      "rw",
      [database.financeTransactions, database.billPayments],
      async () => {
        const current = await own(
          database.financeTransactions,
          profileId,
          id,
          expected,
        );
        if (
          (await database.billPayments.toArray()).some(
            (payment) => payment.transactionId === id,
          )
        )
          throw new WorkspaceError("conflict");
        await database.financeTransactions.delete(id);
        return current;
      },
    );
    changed(row.id, row.revision + 1);
  }
  async function saveBudget(
    profileId: string,
    draft: {
      id?: string;
      expected?: number;
      categoryId: string;
      month: string;
      currency: string;
      limitMinor: number;
    },
  ) {
    const row = await database.transaction(
      "rw",
      [database.budgets, database.financeCategories],
      async () => {
        await category(profileId, draft.categoryId, "expense");
        const old = draft.id
          ? await own(
              database.budgets,
              profileId,
              draft.id,
              draft.expected ?? -1,
            )
          : ((await database.budgets.toArray()).find(
              (item) =>
                item.profileId === profileId &&
                item.categoryId === draft.categoryId &&
                item.month === draft.month &&
                item.currency === draft.currency,
            ) ?? null);
        if (old && draft.expected === undefined)
          throw new WorkspaceError("conflict");
        const next = budgetSchema.parse(
          old
            ? bump(old, { limitMinor: draft.limitMinor })
            : {
                id: crypto.randomUUID(),
                profileId,
                categoryId: draft.categoryId,
                month: draft.month,
                currency: draft.currency,
                limitMinor: draft.limitMinor,
                ...stamp(),
              },
        );
        await database.budgets.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function saveBill(
    profileId: string,
    draft: {
      id?: string;
      expected?: number;
      title: string;
      amountMinor: number;
      currency: string;
      dueDate: string;
      recurrence: BillRecord["recurrence"];
      categoryId: string | null;
      accountId: string | null;
    },
  ) {
    const row = await database.transaction(
      "rw",
      [database.bills, database.accounts, database.financeCategories],
      async () => {
        if (draft.accountId) {
          const a = await account(profileId, draft.accountId);
          if (a.currency !== draft.currency)
            throw new WorkspaceError("invalidInput");
        }
        await category(profileId, draft.categoryId, "expense");
        const old = draft.id
          ? await own(database.bills, profileId, draft.id, draft.expected ?? -1)
          : null;
        const patch = {
          title: draft.title.trim(),
          amountMinor: draft.amountMinor,
          currency: draft.currency,
          dueDate: draft.dueDate,
          recurrence: draft.recurrence,
          categoryId: draft.categoryId,
          accountId: draft.accountId,
        };
        const next = billSchema.parse(
          old
            ? bump(old, patch)
            : {
                id: crypto.randomUUID(),
                profileId,
                ...patch,
                status: "active",
                ...stamp(),
              },
        );
        await database.bills.put(next);
        return next;
      },
    );
    changed(row.id, row.revision);
    return row;
  }
  async function markBillPaid(
    profileId: string,
    billId: string,
    expected: number,
    occurrenceDate: string,
    reference: string | null,
    createExpense = true,
  ) {
    const result = await database.transaction(
      "rw",
      [
        database.bills,
        database.billPayments,
        database.financeTransactions,
        database.accounts,
        database.financeCategories,
      ],
      async () => {
        const bill = await own(database.bills, profileId, billId, expected);
        if (bill.status !== "active") throw new WorkspaceError("conflict");
        if (
          !billOccurrence(
            bill.dueDate,
            bill.recurrence,
            occurrenceDate.slice(0, 7),
          ) ||
          occurrenceDate !==
            billOccurrence(
              bill.dueDate,
              bill.recurrence,
              occurrenceDate.slice(0, 7),
            )
        )
          throw new WorkspaceError("invalidInput");
        const exists = (await database.billPayments.toArray()).find(
          (item) =>
            item.billId === billId && item.occurrenceDate === occurrenceDate,
        );
        if (exists) return { payment: exists, transaction: null };
        if (createExpense && bill.accountId) {
          const a = await account(profileId, bill.accountId);
          if (a.currency !== bill.currency)
            throw new WorkspaceError("invalidInput");
          await category(profileId, bill.categoryId, "expense");
          const paymentId = crypto.randomUUID();
          const tx = transactionSchema.parse({
            id: crypto.randomUUID(),
            profileId,
            kind: "expense",
            amountMinor: bill.amountMinor,
            currency: bill.currency,
            accountId: bill.accountId,
            toAccountId: null,
            categoryId: bill.categoryId,
            date: occurrenceDate,
            description: bill.title,
            reversedTransactionId: null,
            billPaymentId: paymentId,
            ...stamp(),
          });
          const payment = billPaymentSchema.parse({
            id: paymentId,
            profileId,
            billId,
            occurrenceDate,
            paidAt: new Date().toISOString(),
            transactionId: tx.id,
            reference: reference?.trim() || null,
            ...stamp(),
          });
          await database.financeTransactions.put(tx);
          await database.billPayments.put(payment);
          return { payment, transaction: tx };
        }
        const payment = billPaymentSchema.parse({
          id: crypto.randomUUID(),
          profileId,
          billId,
          occurrenceDate,
          paidAt: new Date().toISOString(),
          transactionId: null,
          reference: reference?.trim() || null,
          ...stamp(),
        });
        await database.billPayments.put(payment);
        return { payment, transaction: null };
      },
    );
    changed(result.payment.id, result.payment.revision);
    return result;
  }
  async function postponeBill(
    profileId: string,
    id: string,
    expected: number,
    dueDate: string,
  ) {
    const current = await own(database.bills, profileId, id, expected);
    return saveBill(profileId, {
      id,
      expected,
      title: current.title,
      amountMinor: current.amountMinor,
      currency: current.currency,
      dueDate,
      recurrence: current.recurrence,
      categoryId: current.categoryId,
      accountId: current.accountId,
    });
  }
  async function deleteBill(profileId: string, id: string, expected: number) {
    const row = await database.transaction(
      "rw",
      [database.bills, database.billPayments],
      async () => {
        const current = await own(database.bills, profileId, id, expected);
        if (
          (await database.billPayments.toArray()).some(
            (payment) => payment.billId === id,
          )
        )
          throw new WorkspaceError("conflict");
        await database.bills.delete(id);
        return current;
      },
    );
    changed(row.id, row.revision + 1);
  }
  async function clearProfile(profileId: string) {
    await database.transaction(
      "rw",
      [
        database.accounts,
        database.financeCategories,
        database.financeTransactions,
        database.budgets,
        database.bills,
        database.billPayments,
      ],
      async () => {
        for (const table of [
          database.accounts,
          database.financeCategories,
          database.financeTransactions,
          database.budgets,
          database.bills,
          database.billPayments,
        ])
          for (const row of await table.toArray())
            if ((row as { profileId: string }).profileId === profileId)
              await table.delete((row as { id: string }).id);
      },
    );
    changed(profileId, Date.now());
  }
  async function exported(profileId: string) {
    const data = await load(profileId, "0000-00");
    return {
      schemaVersion: 1,
      profileId,
      exportedAt: new Date().toISOString(),
      accounts: data.accounts,
      categories: data.categories,
      transactions: data.transactions,
      budgets: (await database.budgets.toArray()).filter(
        (row) => row.profileId === profileId,
      ),
      bills: data.bills,
      payments: data.payments,
    };
  }
  async function csv(profileId: string) {
    const data = await exported(profileId);
    const rows = [
      [
        "recordType",
        "date",
        "kind",
        "amountMinor",
        "currency",
        "accountId",
        "categoryId",
        "description",
        "name",
        "title",
        "reference",
      ],
      ...data.accounts.map((row) => [
        "account",
        "",
        "",
        String(row.openingBalanceMinor),
        row.currency,
        row.id,
        "",
        "",
        row.name,
        "",
        "",
      ]),
      ...data.categories.map((row) => [
        "category",
        "",
        row.kind,
        "",
        "",
        "",
        row.id,
        "",
        row.name,
        "",
        "",
      ]),
      ...data.transactions.map((row) => [
        "transaction",
        row.date,
        row.kind,
        String(row.amountMinor),
        row.currency,
        row.accountId,
        row.categoryId ?? "",
        row.description,
        "",
        "",
        "",
      ]),
      ...data.bills.map((row) => [
        "bill",
        row.dueDate,
        row.recurrence,
        String(row.amountMinor),
        row.currency,
        row.accountId ?? "",
        row.categoryId ?? "",
        "",
        "",
        row.title,
        "",
      ]),
      ...data.payments.map((row) => [
        "billPayment",
        row.occurrenceDate,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        row.reference ?? "",
      ]),
    ];
    return [...rows.map((row) => row.map(escapeCsv).join(","))].join("\n");
  }
  return {
    load,
    createAccount,
    updateAccount,
    deleteAccount,
    createCategory,
    updateCategory,
    deleteCategory,
    createTransaction,
    updateTransaction,
    reverseTransaction,
    deleteTransaction,
    saveBudget,
    saveBill,
    markBillPaid,
    postponeBill,
    deleteBill,
    clearProfile,
    exported,
    csv,
  };
}
function nextMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year!, mon!, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function todayUTC() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(
    new Date(),
  );
}
export type Finance = ReturnType<typeof createFinance>;
