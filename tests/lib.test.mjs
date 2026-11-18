// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const L = require("../lib.js");

test("aqiBand: EPA breakpoints", () => {
  assert.equal(L.aqiBand(0).label, "Good");
  assert.equal(L.aqiBand(50).label, "Good");
  assert.equal(L.aqiBand(51).label, "Moderate");
  assert.equal(L.aqiBand(150).label, "Unhealthy for sensitive groups");
  assert.equal(L.aqiBand(168).label, "Unhealthy");
  assert.equal(L.aqiBand(250).label, "Very unhealthy");
  assert.equal(L.aqiBand(400).label, "Hazardous");
});

test("aqiBand: bad input is safe", () => {
  assert.equal(L.aqiBand(NaN).label, "Unknown");
  assert.equal(L.aqiBand(-5).label, "Unknown");
  assert.equal(L.aqiBand("abc").label, "Unknown");
  assert.equal(L.aqiBand(undefined).label, "Unknown");
});

test("validateCity: accepts normal names", () => {
  assert.equal(L.validateCity("Delhi").ok, true);
  assert.equal(L.validateCity("  Kolkata ").value, "Kolkata");
  assert.equal(L.validateCity("Asansol-Durgapur").ok, true);
  assert.equal(L.validateCity("St. John's").ok, true);
});

test("validateCity: rejects empty, numeric and symbol input", () => {
  assert.equal(L.validateCity("").ok, false);
  assert.equal(L.validateCity(" x ").ok, false);
  assert.equal(L.validateCity("Delhi123").ok, false);
  assert.equal(L.validateCity("<script>").ok, false);
  assert.equal(L.validateCity(null).ok, false);
});

test("co2SavedPerWeek: car commute avoids emissions, walk avoids none", () => {
  assert.equal(L.co2SavedPerWeek("car", 10, 5), 9.6);
  assert.equal(L.co2SavedPerWeek("walk", 10, 5), 0);
  assert.equal(L.co2SavedPerWeek("cycle", 10, 5), 0);
  assert.equal(L.co2SavedPerWeek("car", 0, 5), 0);
  assert.equal(L.co2SavedPerWeek("spaceship", 10, 5), 0);
});

test("buildPrompt: carries place, live AQI and lifestyle into the prompt", () => {
  const p = L.buildPrompt({
    city: "Delhi, India",
    aqi: 168,
    pm25: 71.5,
    pm10: 72.9,
    commute: "motorbike",
    commuteKm: "8",
    household: ["young children", "pets"],
    exercise: "daily outdoors",
    workSetting: "mixed indoor and outdoor"
  });
  assert.match(p, /Delhi, India/);
  assert.match(p, /168/);
  assert.match(p, /Unhealthy/);
  assert.match(p, /motorbike/);
  assert.match(p, /young children, pets/);
  assert.match(p, /TODAY'S LOW-EMISSION ROUTINE/);
  assert.match(p, /INDOOR AIR HACKS/);
  assert.match(p, /SUSTAINABLE SWAPS/);
  assert.match(p, /YOUR IMPACT/);
});

test("fallbackTips: hazardous days get a stay-indoors warning first", () => {
  const calm = L.fallbackTips(L.aqiBand(40));
  const bad = L.fallbackTips(L.aqiBand(320));
  assert.ok(calm.length >= 5);
  assert.match(bad[0], /stay indoors/i);
  assert.ok(bad.length > calm.length);
});

test("formatAqiTime: renders local reading time readably", () => {
  assert.equal(L.formatAqiTime("2026-11-18T18:30"), "2026-11-18 18:30");
  assert.equal(L.formatAqiTime("bad"), "just now");
});
