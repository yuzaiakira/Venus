# Weather & Commute provider and privacy design

## Decision

Venus uses a replaceable `WeatherProvider` adapter. The first production adapter
is **Open-Meteo commercial / customer API**, used only with a user or
organization supplied commercial credential and explicit consent. Venus does
not call Open-Meteo's public free endpoint. Open-Meteo documents the public
service as non-commercial and subject to usage limits; an extension distributed
for commercial use therefore needs a separate commercial agreement/key before
it may enable requests. This bring-your-own-licensed-subscription model keeps
the extension from representing a free endpoint as commercially licensed.

The decision should be re-reviewed against the provider's current documentation
before public distribution:

- Forecast API: https://open-meteo.com/en/docs
- Geocoding API: https://open-meteo.com/en/docs/geocoding-api
- Terms: https://open-meteo.com/en/terms

## Fixed request scope

The adapter permits only these HTTPS origins, requested as optional browser host
permissions after a user action:

- `https://customer-api.open-meteo.com/*` — current and daily forecast for the
  selected coordinates; requested fields are temperature, precipitation
  probability/precipitation, wind speed, weather code and timezone.
- `https://geocoding-api.open-meteo.com/*` — city-name lookup, with a short
  query and a result limit of five.

No dynamic host, proxy, IP geolocation, calendar content, notes, tasks, contacts
or destination labels are sent. The forecast request contains only selected
latitude, longitude, timezone and fixed field names. The geocoding request
contains only the user-entered city text. The user enters a commercial API key;
it is stored locally in extension storage/IndexedDB and never logged, exported
or attached to diagnostics.

## Consent and retention

Network consent is separate from device-location consent. Rendering the widget
or screen never asks for either permission or makes a request. A user must
first acknowledge the commercial provider terms and grant the narrowly scoped
host permission. City search and refresh remain unavailable otherwise. Device
location is requested only after a separate button press, is rounded to two
decimal places before storage/transmission, and does not grant network consent.

The selected location is one profile-owned record, not location history. The
forecast cache is one profile/location record, expires after 30 minutes, and
is marked stale after expiry. Refreshes are throttled for ten minutes unless
the cache is stale. Revoking network consent removes the optional host
permission where supported, clears credentials and all forecast cache records,
and prevents future provider calls. Clearing a location removes its cache.

## Attribution, failure and replacement

The UI displays “Weather data: Open-Meteo” with a link to the provider. The
commercial agreement must supply any additional attribution required by its
current terms; no request is enabled until the user accepts that requirement.
Offline, timeout, invalid response, rate limit and provider failures preserve a
previous cache as explicitly stale and never present it as live data.

A provider replacement implements the same narrow `WeatherProvider` interface,
adds only its documented fixed origins and consent/version text, and requires a
new user acknowledgement before requests. Live traffic/routing is out of scope:
commute values are user-entered estimates and remain local.
