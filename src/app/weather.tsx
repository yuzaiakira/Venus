import { useState } from "react";
import type { Weather, WeatherWorkspace } from "../application/weather";
import type { ProviderLocation } from "../domain/weather";
import { translate, type MessageKey } from "../locales/messages";

type Locale = "en" | "fa";
function when(value: number, locale: Locale, timeZone: string) {
  return new Intl.DateTimeFormat(locale === "fa" ? "fa" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}
function formatDay(value: string, locale: Locale) {
  const [year, month, date] = value.split("-").map(Number);
  if (!year || !month || !date) return value;
  return new Intl.DateTimeFormat(locale === "fa" ? "fa" : "en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}
function number(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "fa" ? "fa" : "en", {
    maximumFractionDigits: 1,
  }).format(value);
}
function weatherLabel(code: number) {
  if ([0, 1].includes(code)) return "weather.condition.clear" as const;
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code))
    return "weather.condition.rain" as const;
  if ([71, 73, 75, 85, 86].includes(code))
    return "weather.condition.snow" as const;
  return "weather.condition.cloudy" as const;
}

export function WeatherScreen(props: {
  profileId: string;
  data: WeatherWorkspace;
  weather: Weather;
  locale: Locale;
  timeZone: string;
  online: boolean;
  onChanged: () => Promise<void>;
  requestNetwork: () => Promise<
    "granted" | "denied" | "failed" | "unsupported"
  >;
  revokeNetwork: () => Promise<"revoked" | "failed" | "unsupported">;
}) {
  const t = (key: MessageKey) => translate(props.locale, key);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [key, setKey] = useState("");
  const [terms, setTerms] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProviderLocation[]>([]);
  const [choice, setChoice] = useState("");
  const [travel, setTravel] = useState(30);
  const [prep, setPrep] = useState(10);
  const [destination, setDestination] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing =
    props.data.commute.find((row) => row.plan.id === editingId)?.plan ?? null;
  const selected =
    props.data.upcoming.find(
      (row) => `${row.eventId}:${row.occurrenceKey}` === choice,
    ) ??
    props.data.upcoming[0] ??
    null;
  async function run(work: () => Promise<unknown>, message = "weather.saved") {
    setBusy(true);
    setError("");
    try {
      await work();
      await props.onChanged();
      setNotice(t(message as MessageKey));
    } catch {
      setError(t("weather.failed"));
    } finally {
      setBusy(false);
    }
  }
  async function device() {
    if (!navigator.geolocation) {
      setError(t("weather.locationUnavailable"));
      return;
    }
    setBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void props.weather
          .useDeviceLocation(
            props.profileId,
            props.data.preference.revision,
            position.coords.latitude,
            position.coords.longitude,
          )
          .then(props.onChanged)
          .then(() => setNotice(t("weather.saved")))
          .catch(() => setError(t("weather.failed")))
          .finally(() => setBusy(false));
      },
      () => {
        setError(t("weather.locationDenied"));
        setBusy(false);
      },
      { enableHighAccuracy: false, maximumAge: 0, timeout: 10_000 },
    );
  }
  const live = props.data.preference.networkConsent === "granted";
  return (
    <section className="content-card module" aria-labelledby="weather-heading">
      <div className="page-header">
        <div>
          <h1 id="weather-heading">{t("weather.heading")}</h1>
          <p className="muted">{t("weather.intro")}</p>
        </div>
      </div>
      {!props.online ? (
        <p className="muted" role="status">
          {t("weather.offline")}
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
      {busy ? (
        <p className="muted" role="status">
          {t("weather.loading")}
        </p>
      ) : null}
      {!live ? (
        <section
          className="task-card card-glass"
          aria-labelledby="weather-connect"
        >
          <h2 id="weather-connect">{t("weather.connect")}</h2>
          <p className="muted">{t("weather.license")}</p>
          <label>
            <input
              type="checkbox"
              checked={terms}
              onChange={(event) => setTerms(event.target.checked)}
            />{" "}
            {t("weather.acceptTerms")}
          </label>
          <label>
            {t("weather.apiKey")}
            <input
              className="field"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
          </label>
          <button
            className="btn primary"
            type="button"
            disabled={busy || !terms || !key.trim()}
            onClick={() =>
              void run(async () => {
                const permission = await props.requestNetwork();
                if (permission !== "granted") throw new Error("permission");
                await props.weather.grantNetwork(
                  props.profileId,
                  props.data.preference.revision,
                  key,
                );
              }, "weather.connected")
            }
          >
            {t("weather.connect")}
          </button>
          <p className="muted">{t("weather.noAutoRequest")}</p>
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => void device()}
          >
            {t("weather.useDevice")}
          </button>
        </section>
      ) : (
        <>
          <section
            className="task-card card-glass"
            aria-labelledby="weather-location"
          >
            <h2 id="weather-location">{t("weather.location")}</h2>
            {props.data.location ? (
              <p>
                <bdi>{props.data.location.label}</bdi>
                {props.data.location.country
                  ? ` · ${props.data.location.country}`
                  : ""}
              </p>
            ) : (
              <p className="muted">{t("weather.noLocation")}</p>
            )}
            <div className="cluster">
              <label>
                {t("weather.city")}
                <input
                  className="field"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button
                className="btn"
                type="button"
                disabled={busy || !props.online || !query.trim()}
                onClick={() =>
                  void run(
                    async () =>
                      setResults(
                        await props.weather.search(props.profileId, query),
                      ),
                    "weather.searchResults",
                  )
                }
              >
                {t("weather.search")}
              </button>
              <button
                className="btn"
                type="button"
                disabled={busy}
                onClick={() => void device()}
              >
                {t("weather.useDevice")}
              </button>
              {props.data.location ? (
                <button
                  className="btn"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      props.weather.clearLocation(
                        props.profileId,
                        props.data.location!.revision,
                      ),
                    )
                  }
                >
                  {t("weather.clearLocation")}
                </button>
              ) : null}
            </div>
            {results.length ? (
              <div className="cluster" aria-label={t("weather.searchResults")}>
                {results.map((row) => (
                  <button
                    className="btn"
                    type="button"
                    key={`${row.latitude}:${row.longitude}`}
                    onClick={() =>
                      void run(() =>
                        props.weather.setLocation(
                          props.profileId,
                          row,
                          "manual",
                        ),
                      )
                    }
                  >
                    <bdi>{row.label}</bdi>
                    {row.country ? ` · ${row.country}` : ""}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
          <section
            className="task-card card-glass"
            aria-labelledby="weather-now"
          >
            <div className="page-header">
              <div>
                <h2 id="weather-now">{t("weather.now")}</h2>
                {props.data.forecast ? (
                  <p className="muted">
                    {t(props.data.stale ? "weather.stale" : "weather.updated")}{" "}
                    ·{" "}
                    {when(
                      props.data.forecast.fetchedAt,
                      props.locale,
                      props.data.forecast.timezone,
                    )}
                  </p>
                ) : null}
              </div>
              <button
                className="btn primary"
                type="button"
                disabled={busy || !props.online || !props.data.location}
                onClick={() =>
                  void run(
                    () =>
                      props.weather.refresh(props.profileId, props.timeZone),
                    "weather.refreshed",
                  )
                }
              >
                {t("weather.refresh")}
              </button>
            </div>
            {props.data.forecast ? (
              <>
                <p className="hero-clock" style={{ fontSize: "1.8rem" }}>
                  {props.data.forecast.current.temperatureC}°C
                </p>
                <p>
                  {t(weatherLabel(props.data.forecast.current.weatherCode))} ·{" "}
                  {t("weather.wind")} {props.data.forecast.current.windSpeedKph}{" "}
                  km/h
                </p>
                <div className="board-cards">
                  {props.data.forecast.days.map((day) => (
                    <article className="task-card card-glass" key={day.date}>
                      <strong>{formatDay(day.date, props.locale)}</strong>
                      <p>
                        {number(day.temperatureMinC, props.locale)}–
                        {number(day.temperatureMaxC, props.locale)}°C
                      </p>
                      <small className="muted">
                        {t("weather.precipitation")}:{" "}
                        {day.precipitationProbability === null &&
                        day.precipitationMm === null
                          ? "—"
                          : number(
                              day.precipitationProbability ??
                                day.precipitationMm ??
                                0,
                              props.locale,
                            )}
                        {day.precipitationProbability !== null ? "%" : ""}
                      </small>
                    </article>
                  ))}
                </div>
                <p className="muted">
                  {t("weather.attribution")}{" "}
                  <a
                    href="https://open-meteo.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open-Meteo
                  </a>
                </p>
              </>
            ) : (
              <p className="muted">{t("weather.noForecast")}</p>
            )}
          </section>
        </>
      )}
      <section
        className="task-card card-glass"
        aria-labelledby="commute-heading"
      >
        <h2 id="commute-heading">{t("commute.heading")}</h2>
        <p className="muted">{t("commute.intro")}</p>
        {!props.data.upcoming.length ? (
          <p className="muted">{t("commute.empty")}</p>
        ) : (
          <>
            <label>
              {t("commute.commitment")}
              <select
                className="select"
                value={
                  choice ||
                  (selected
                    ? `${selected.eventId}:${selected.occurrenceKey}`
                    : "")
                }
                onChange={(event) => setChoice(event.currentTarget.value)}
              >
                {props.data.upcoming.map((row) => (
                  <option
                    key={`${row.eventId}:${row.occurrenceKey}`}
                    value={`${row.eventId}:${row.occurrenceKey}`}
                  >
                    {row.title} ·{" "}
                    {when(row.startAtUTC, props.locale, row.timeZone)}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                {t("commute.destination")}
                <input
                  className="field"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                />
              </label>
              <label>
                {t("commute.travel")}
                <input
                  className="field"
                  type="number"
                  min="0"
                  max="720"
                  value={travel}
                  onChange={(event) => setTravel(Number(event.target.value))}
                />
              </label>
              <label>
                {t("commute.prepare")}
                <input
                  className="field"
                  type="number"
                  min="0"
                  max="240"
                  value={prep}
                  onChange={(event) => setPrep(Number(event.target.value))}
                />
              </label>
            </div>
            <button
              className="btn primary"
              type="button"
              disabled={busy || !selected}
              onClick={() =>
                selected &&
                void run(async () => {
                  await props.weather.saveCommute(props.profileId, {
                    ...(editing
                      ? { id: editing.id, expected: editing.revision }
                      : {}),
                    eventId: selected.eventId,
                    occurrenceKey: selected.occurrenceKey,
                    destinationLabel: destination || null,
                    travelMinutes: travel,
                    preparationMinutes: prep,
                  });
                  setEditingId(null);
                })
              }
            >
              {t("commute.save")}
            </button>
          </>
        )}
        <div className="board-cards">
          {props.data.commute.map((row) => (
            <article key={row.plan.id} className="task-card card-glass">
              <strong>
                <bdi>{row.event?.title ?? t("commute.eventUnavailable")}</bdi>
              </strong>
              {row.startAtUTC && row.leaveAtUTC ? (
                <p>
                  {t("commute.leaving")}{" "}
                  {when(
                    row.leaveAtUTC,
                    props.locale,
                    row.event?.zoneId ?? props.timeZone,
                  )}{" "}
                  · {row.past ? t("commute.past") : ""}
                </p>
              ) : (
                <p className="muted">{t("commute.eventUnavailable")}</p>
              )}
              <small className="muted">
                {t("commute.estimate")
                  .replace(
                    "{travel}",
                    number(row.plan.travelMinutes, props.locale),
                  )
                  .replace(
                    "{prepare}",
                    number(row.plan.preparationMinutes, props.locale),
                  )}
              </small>
              <button
                className="btn"
                type="button"
                disabled={busy || !row.event || row.startAtUTC === null}
                onClick={() => {
                  setChoice(`${row.plan.eventId}:${row.plan.occurrenceKey}`);
                  setDestination(row.plan.destinationLabel ?? "");
                  setTravel(row.plan.travelMinutes);
                  setPrep(row.plan.preparationMinutes);
                  setEditingId(row.plan.id);
                }}
              >
                {t("commute.edit")}
              </button>
              <button
                className="btn"
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    props.weather.deleteCommute(
                      props.profileId,
                      row.plan.id,
                      row.plan.revision,
                    ),
                  )
                }
              >
                {t("commute.remove")}
              </button>
            </article>
          ))}
        </div>
      </section>
      {live ? (
        <section className="task-card card-glass">
          <h2>{t("weather.privacy")}</h2>
          <p className="muted">{t("weather.revokeHint")}</p>
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await props.revokeNetwork();
                await props.weather.revokeNetwork(
                  props.profileId,
                  props.data.preference.revision,
                );
              })
            }
          >
            {t("weather.revoke")}
          </button>
        </section>
      ) : null}
    </section>
  );
}
