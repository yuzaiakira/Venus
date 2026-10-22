import { useMemo, useState } from "react";
import type { Finance, FinanceWorkspace } from "../application/finance";
import {
  formatMoney,
  parseMinor,
  parseSignedMinor,
  currencyPrecision,
  type AccountRecord,
  type FinanceKind,
} from "../domain/finance";
import { translate, type MessageKey } from "../locales/messages";

type Locale = "en" | "fa";
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
function shiftMonth(month: string, change: number) {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year!, mon! - 1 + change, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function download(name: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
export function FinanceScreen(props: {
  profileId: string;
  data: FinanceWorkspace;
  finance: Finance;
  locale: Locale;
  online: boolean;
  onChanged: () => Promise<void>;
  onMonth: (month: string) => Promise<void>;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<AccountRecord["type"]>("bank");
  const [currency, setCurrency] = useState("USD");
  const [opening, setOpening] = useState("0");
  const [categoryName, setCategoryName] = useState("");
  const [categoryKind, setCategoryKind] = useState<"income" | "expense">(
    "expense",
  );
  const [kind, setKind] = useState<FinanceKind>("expense");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");
  const [budgetCategory, setBudgetCategory] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("USD");
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [billTitle, setBillTitle] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDate, setBillDate] = useState(today());
  const [billRecurrence, setBillRecurrence] = useState<
    "none" | "monthly" | "yearly"
  >("monthly");
  const [billAccount, setBillAccount] = useState("");
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const accounts = props.data.accounts.filter((row) => !row.archived);
  const categories = props.data.categories.filter((row) => !row.archived);
  const editingBudget =
    props.data.budgets.find((row) => row.id === editingBudgetId) ?? null;
  const editingBill =
    props.data.bills.find((row) => row.id === editingBillId) ?? null;
  const currencies = [...new Set(accounts.map((row) => row.currency))];
  const balances = useMemo(
    () => new Map(accounts.map((row) => [row.id, row.openingBalanceMinor])),
    [accounts],
  );
  for (const tx of props.data.transactions) {
    if (tx.kind === "income")
      balances.set(
        tx.accountId,
        (balances.get(tx.accountId) ?? 0) + tx.amountMinor,
      );
    if (tx.kind === "expense")
      balances.set(
        tx.accountId,
        (balances.get(tx.accountId) ?? 0) - tx.amountMinor,
      );
    if (tx.kind === "transfer") {
      balances.set(
        tx.accountId,
        (balances.get(tx.accountId) ?? 0) - tx.amountMinor,
      );
      if (tx.toAccountId)
        balances.set(
          tx.toAccountId,
          (balances.get(tx.toAccountId) ?? 0) + tx.amountMinor,
        );
    }
    if (tx.kind === "reversal") {
      const original = props.data.transactions.find(
        (row) => row.id === tx.reversedTransactionId,
      );
      if (original?.kind === "income")
        balances.set(
          tx.accountId,
          (balances.get(tx.accountId) ?? 0) - tx.amountMinor,
        );
      if (original?.kind === "expense")
        balances.set(
          tx.accountId,
          (balances.get(tx.accountId) ?? 0) + tx.amountMinor,
        );
    }
  }
  async function run(work: () => Promise<unknown>, success = "finance.saved") {
    setBusy(true);
    setError("");
    try {
      await work();
      await props.onChanged();
      setNotice(t(success as MessageKey));
    } catch {
      setError(t("finance.failed"));
    } finally {
      setBusy(false);
    }
  }
  const usableCategories = categories.filter((row) =>
    kind === "income" ? row.kind === "income" : row.kind === "expense",
  );
  return (
    <section className="content-card module" aria-labelledby="finance-heading">
      <div className="page-header">
        <div>
          <h1 id="finance-heading">{t("finance.heading")}</h1>
          <p className="muted">{t("finance.intro")}</p>
        </div>
        <div className="cluster">
          <button
            className="btn"
            type="button"
            onClick={() => void props.onMonth(shiftMonth(props.data.month, -1))}
          >
            {t("finance.previous")}
          </button>
          <strong>{props.data.month}</strong>
          <button
            className="btn"
            type="button"
            onClick={() => void props.onMonth(shiftMonth(props.data.month, 1))}
          >
            {t("finance.next")}
          </button>
        </div>
      </div>
      {!props.online ? (
        <p className="muted" role="status">
          {t("finance.localOnly")}
        </p>
      ) : null}
      {busy ? (
        <p className="muted" role="status">
          {t("finance.loading")}
        </p>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="muted" role="status">
          {notice}
        </p>
      ) : null}
      <div className="board-cards">
        {props.data.summaries.map((sum) => (
          <article className="task-card card-glass" key={sum.currency}>
            <strong>{sum.currency}</strong>
            <p>
              {t("finance.income")}:{" "}
              {formatMoney(sum.incomeMinor, sum.currency, props.locale)}
            </p>
            <p>
              {t("finance.expense")}:{" "}
              {formatMoney(sum.expenseMinor, sum.currency, props.locale)}
            </p>
            <p>
              {t("finance.remaining")}:{" "}
              {formatMoney(sum.remainingMinor, sum.currency, props.locale)}
            </p>
          </article>
        ))}
      </div>
      {!accounts.length ? <p className="muted">{t("finance.empty")}</p> : null}
      <section className="task-card card-glass">
        <h2>{t("finance.accounts")}</h2>
        <div className="form-grid">
          <label>
            {t("finance.accountName")}
            <input
              className="field"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </label>
          <label>
            {t("finance.currency")}
            <input
              className="field"
              value={currency}
              maxLength={3}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
          </label>
          <label>
            {t("finance.accountType")}
            <select
              className="select"
              value={accountType}
              onChange={(event) =>
                setAccountType(
                  event.currentTarget.value as AccountRecord["type"],
                )
              }
            >
              {(["cash", "bank", "card", "other"] as const).map((type) => (
                <option key={type} value={type}>
                  {t(`finance.${type}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("finance.opening")}
            <input
              className="field"
              inputMode="decimal"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
            />
          </label>
        </div>
        <button
          className="btn primary"
          type="button"
          disabled={busy || !accountName.trim()}
          onClick={() =>
            void run(async () => {
              await props.finance.createAccount(props.profileId, {
                name: accountName,
                type: accountType,
                currency,
                openingBalanceMinor: parseSignedMinor(opening, currency),
              });
              setAccountName("");
            })
          }
        >
          {t("finance.addAccount")}
        </button>
        <div className="board-cards">
          {accounts.map((row) => (
            <article className="task-card card-glass" key={row.id}>
              <strong>
                <bdi>{row.name}</bdi>
              </strong>
              <p>
                {formatMoney(
                  balances.get(row.id) ?? 0,
                  row.currency,
                  props.locale,
                )}
              </p>
              <button
                className="btn"
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    props.finance.updateAccount(
                      props.profileId,
                      row.id,
                      row.revision,
                      { archived: true },
                    ),
                  )
                }
              >
                {t("finance.archive")}
              </button>
              <button
                className="btn"
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    props.finance.deleteAccount(
                      props.profileId,
                      row.id,
                      row.revision,
                    ),
                  )
                }
              >
                {t("finance.delete")}
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="task-card card-glass">
        <h2>{t("finance.category")}</h2>
        <div className="cluster">
          <label>
            {t("finance.description")}
            <input
              className="field"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            />
          </label>
          <select
            className="select"
            value={categoryKind}
            onChange={(e) =>
              setCategoryKind(e.currentTarget.value as "income" | "expense")
            }
          >
            <option value="expense">{t("finance.expense")}</option>
            <option value="income">{t("finance.income")}</option>
          </select>
          <button
            className="btn primary"
            type="button"
            disabled={busy || !categoryName.trim()}
            onClick={() =>
              void run(async () => {
                await props.finance.createCategory(props.profileId, {
                  name: categoryName,
                  kind: categoryKind,
                });
                setCategoryName("");
              })
            }
          >
            {t("finance.category")}
          </button>
        </div>
        <p className="muted">{categories.map((row) => row.name).join(" · ")}</p>
      </section>
      <section className="task-card card-glass">
        <h2>{t("finance.transactions")}</h2>
        <div className="form-grid">
          <label>
            {t("finance.transactions")}
            <select
              className="select"
              value={kind}
              onChange={(e) => setKind(e.currentTarget.value as FinanceKind)}
            >
              {(["income", "expense", "transfer"] as const).map((value) => (
                <option value={value} key={value}>
                  {t(`finance.${value}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("finance.account")}
            <select
              className="select"
              value={accountId}
              onChange={(e) => setAccountId(e.currentTarget.value)}
            >
              <option value="" />
              {accounts.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} · {row.currency}
                </option>
              ))}
            </select>
          </label>
          {kind === "transfer" ? (
            <label>
              {t("finance.toAccount")}
              <select
                className="select"
                value={toAccountId}
                onChange={(e) => setToAccountId(e.currentTarget.value)}
              >
                <option value="" />
                {accounts
                  .filter((row) => row.id !== accountId)
                  .map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <label>
              {t("finance.category")}
              <select
                className="select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.currentTarget.value)}
              >
                <option value="" />
                {usableCategories.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {t("finance.amount")}
            <input
              className="field"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label>
            {t("finance.date")}
            <input
              className="field"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            {t("finance.description")}
            <input
              className="field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
        <button
          className="btn primary"
          type="button"
          disabled={
            busy ||
            !accountId ||
            !amount ||
            (kind === "transfer" && !toAccountId)
          }
          onClick={() =>
            void run(async () => {
              const current = accounts.find((row) => row.id === accountId);
              if (!current) throw new Error();
              await props.finance.createTransaction(props.profileId, {
                kind,
                amountMinor: parseMinor(amount, current.currency),
                currency: current.currency,
                accountId,
                toAccountId: kind === "transfer" ? toAccountId : null,
                categoryId: kind === "transfer" ? null : categoryId || null,
                date,
                description,
              });
              setAmount("");
              setDescription("");
            })
          }
        >
          {t("finance.record")}
        </button>
        <div className="board-cards">
          {props.data.transactions.slice(0, 12).map((row) => (
            <article className="task-card card-glass" key={row.id}>
              <strong>
                {t(
                  `finance.${row.kind === "reversal" ? "expense" : row.kind}` as MessageKey,
                )}{" "}
                · {formatMoney(row.amountMinor, row.currency, props.locale)}
              </strong>
              <p className="muted">
                {row.date} · <bdi>{row.description}</bdi>
              </p>
              {row.kind !== "transfer" && row.kind !== "reversal" ? (
                <button
                  className="btn"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      props.finance.reverseTransaction(
                        props.profileId,
                        row.id,
                        row.revision,
                      ),
                    )
                  }
                >
                  {t("finance.archive")}
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </section>
      <section className="task-card card-glass">
        <h2>{t("finance.budgets")}</h2>
        <div className="form-grid">
          <label>
            {t("finance.category")}
            <select
              className="select"
              value={budgetCategory}
              onChange={(e) => setBudgetCategory(e.currentTarget.value)}
            >
              <option value="" />
              {categories
                .filter((row) => row.kind === "expense")
                .map((row) => (
                  <option value={row.id} key={row.id}>
                    {row.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {t("finance.limit")}
            <input
              className="field"
              inputMode="decimal"
              value={budgetAmount}
              onChange={(e) => setBudgetAmount(e.target.value)}
            />
          </label>
          <label>
            {t("finance.currency")}
            <select
              className="select"
              value={budgetCurrency}
              onChange={(event) => setBudgetCurrency(event.currentTarget.value)}
            >
              {currencies.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="btn primary"
          type="button"
          disabled={busy || !budgetCategory || !budgetAmount}
          onClick={() =>
            void run(async () => {
              const cat = categories.find((row) => row.id === budgetCategory);
              if (!cat) throw new Error();
              await props.finance.saveBudget(props.profileId, {
                ...(editingBudget
                  ? { id: editingBudget.id, expected: editingBudget.revision }
                  : {}),
                categoryId: cat.id,
                month: props.data.month,
                currency: budgetCurrency,
                limitMinor: parseMinor(budgetAmount, budgetCurrency),
              });
              setEditingBudgetId(null);
            })
          }
        >
          {t("finance.addBudget")}
        </button>
        <div className="board-cards">
          {props.data.budgets.map((row) => {
            const spent =
              props.data.budgetProgress.find(
                (progress) => progress.budgetId === row.id,
              )?.spentMinor ?? 0;
            return (
              <article className="task-card card-glass" key={row.id}>
                <strong>
                  {categories.find((cat) => cat.id === row.categoryId)?.name}
                </strong>
                <p>
                  {t("finance.spent")}:{" "}
                  {formatMoney(spent, row.currency, props.locale)} /{" "}
                  {formatMoney(row.limitMinor, row.currency, props.locale)}
                </p>
                {spent > row.limitMinor ? (
                  <p className="error">{t("finance.overBudget")}</p>
                ) : null}
                <button
                  className="btn"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBudgetCategory(row.categoryId);
                    setBudgetCurrency(row.currency);
                    setBudgetAmount(
                      String(
                        row.limitMinor / 10 ** currencyPrecision(row.currency),
                      ),
                    );
                    setEditingBudgetId(row.id);
                  }}
                >
                  {t("finance.edit")}
                </button>
              </article>
            );
          })}
        </div>
      </section>
      <section className="task-card card-glass">
        <h2>{t("finance.bills")}</h2>
        <div className="form-grid">
          <label>
            {t("finance.description")}
            <input
              className="field"
              value={billTitle}
              onChange={(e) => setBillTitle(e.target.value)}
            />
          </label>
          <label>
            {t("finance.amount")}
            <input
              className="field"
              inputMode="decimal"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
            />
          </label>
          <label>
            {t("finance.due")}
            <input
              className="field"
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
            />
          </label>
          <label>
            {t("finance.recurrence")}
            <select
              className="select"
              value={billRecurrence}
              onChange={(e) =>
                setBillRecurrence(
                  e.currentTarget.value as typeof billRecurrence,
                )
              }
            >
              {(["none", "monthly", "yearly"] as const).map((value) => (
                <option key={value} value={value}>
                  {t(`finance.${value}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("finance.account")}
            <select
              className="select"
              value={billAccount}
              onChange={(e) => setBillAccount(e.currentTarget.value)}
            >
              <option value="" />
              {accounts.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="btn primary"
          type="button"
          disabled={busy || !billTitle || !billAmount}
          onClick={() =>
            void run(async () => {
              const acc =
                accounts.find((row) => row.id === billAccount) ?? accounts[0];
              if (!acc) throw new Error();
              await props.finance.saveBill(props.profileId, {
                ...(editingBill
                  ? { id: editingBill.id, expected: editingBill.revision }
                  : {}),
                title: billTitle,
                amountMinor: parseMinor(billAmount, acc.currency),
                currency: acc.currency,
                dueDate: billDate,
                recurrence: billRecurrence,
                categoryId: null,
                accountId: billAccount || null,
              });
              setBillTitle("");
              setBillAmount("");
              setEditingBillId(null);
            })
          }
        >
          {t("finance.addBill")}
        </button>
        <div className="board-cards">
          {props.data.dueBills.map((row) => (
            <article
              className="task-card card-glass"
              key={`${row.bill.id}:${row.occurrenceDate}`}
            >
              <strong>
                <bdi>{row.bill.title}</bdi>
              </strong>
              <p>
                {row.occurrenceDate} ·{" "}
                {formatMoney(
                  row.bill.amountMinor,
                  row.bill.currency,
                  props.locale,
                )}
              </p>
              {row.overdue ? (
                <p className="error">{t("finance.overdue")}</p>
              ) : null}
              {row.paid ? (
                <p className="muted">{t("finance.paid")}</p>
              ) : (
                <button
                  className="btn primary"
                  disabled={busy}
                  type="button"
                  onClick={() =>
                    void run(() =>
                      props.finance.markBillPaid(
                        props.profileId,
                        row.bill.id,
                        row.bill.revision,
                        row.occurrenceDate,
                        null,
                        Boolean(row.bill.accountId),
                      ),
                    )
                  }
                >
                  {t("finance.pay")}
                </button>
              )}
              <button
                className="btn"
                type="button"
                disabled={busy || row.paid}
                onClick={() =>
                  void run(() =>
                    props.finance.deleteBill(
                      props.profileId,
                      row.bill.id,
                      row.bill.revision,
                    ),
                  )
                }
              >
                {t("finance.delete")}
              </button>
              <button
                className="btn"
                type="button"
                disabled={busy}
                onClick={() => {
                  setBillTitle(row.bill.title);
                  setBillAmount(
                    String(
                      row.bill.amountMinor /
                        10 ** currencyPrecision(row.bill.currency),
                    ),
                  );
                  setBillDate(row.bill.dueDate);
                  setBillRecurrence(row.bill.recurrence);
                  setBillAccount(row.bill.accountId ?? "");
                  setEditingBillId(row.bill.id);
                }}
              >
                {t("finance.edit")}
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="task-card card-glass">
        <h2>{t("finance.localOnly")}</h2>
        <p className="muted">{t("finance.deleteHint")}</p>
        <div className="cluster">
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () =>
                download(
                  `venus-finance-${props.data.month}.json`,
                  `application/json`,
                  JSON.stringify(
                    await props.finance.exported(props.profileId),
                    null,
                    2,
                  ),
                ),
              )
            }
          >
            {t("finance.exportJson")}
          </button>
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () =>
                download(
                  `venus-finance-${props.data.month}.csv`,
                  `text/csv;charset=utf-8`,
                  await props.finance.csv(props.profileId),
                ),
              )
            }
          >
            {t("finance.exportCsv")}
          </button>
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm(t("finance.deleteHint")))
                void run(() => props.finance.clearProfile(props.profileId));
            }}
          >
            {t("finance.deleteData")}
          </button>
        </div>
      </section>
    </section>
  );
}
