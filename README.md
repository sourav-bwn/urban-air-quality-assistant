# AirSaathi - Urban Air Quality Assistant

**PromptWars Virtual - Challenge 06 entry.**

AirSaathi is a GenAI-powered assistant that helps families and communities
navigate severe winter smog and urban air pollution. It reads your city's
**live air quality**, asks about your **lifestyle**, and writes a personal
clean-air plan: a low-emission daily routine, indoor air quality hacks and
sustainable swaps - and it explains, in plain words, the direct impact of
each choice.

## Live demo

Deployed with GitHub Pages from this repository (see the About section of
this repo for the live URL).

## What it does

1. **Live air quality** - your city is geocoded and the current US AQI,
   PM2.5 and PM10 are fetched and shown with EPA banding and plain advice.
2. **Personal GenAI plan** - your place, live AQI and lifestyle are built
   into a prompt (visible in the UI under "See the exact prompt sent to the
   AI") and an open model writes your routine, indoor-air hacks, sustainable
   swaps and impact explanation.
3. **Commute CO2 estimator** - a transparent local calculation of the CO2
   you avoid by switching commute modes.
4. **Graceful failure** - unknown places, timeouts and AI outages show clear
   messages plus static safety tips instead of a broken page.

## GenAI services used, and where

| Service | Used for | Where in code |
| --- | --- | --- |
| [Pollinations.ai](https://pollinations.ai) open text models (keyless) | Generating the personal clean-air plan | `app.js` `askAssistant()`, prompt built in `lib.js` `buildPrompt()` |
| [Open-Meteo Air Quality API](https://open-meteo.com) (CAMS data, keyless) | Live US AQI, PM2.5, PM10 | `app.js` `fetchAqi()` |
| [Open-Meteo Geocoding API](https://open-meteo.com) (keyless) | Resolving city names to coordinates | `app.js` `geocodeCity()` |

No API keys anywhere: every service used is free and keyless, so there is
nothing secret to leak. The site is 100% static HTML/CSS/JS.

## Run locally

No build step and no dependencies:

```bash
# any static file server works, e.g.
python3 -m http.server 8080
# then open http://localhost:8080
```

## Tests

Pure logic (AQI banding, input validation, CO2 math, prompt building,
fallback tips) lives in `lib.js` and is covered by Node's built-in runner:

```bash
node --test
```

## Engineering notes

- **Security**: strict Content-Security-Policy meta tag (self + the three
  API origins only); all AI output rendered with `textContent`, never
  `innerHTML`; all URL parameters passed through `encodeURIComponent`; no
  cookies, no trackers, no secrets.
- **Accessibility**: semantic landmarks, labelled inputs, `aria-live`
  status region, visible focus outlines, a skip link, error text tied with
  `aria-describedby`, works fully by keyboard, respects
  `prefers-reduced-motion`.
- **Efficiency**: zero dependencies, no frameworks, ~20 KB of hand-written
  code total; requests carry 12 s timeouts and run sequentially only where
  data depends on the previous step.

## Project layout

```
index.html    page markup and CSP
styles.css    responsive, high-contrast styling
app.js        DOM wiring and API calls
lib.js        pure, testable logic
tests/        node:test unit tests for lib.js
```
