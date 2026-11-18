/*
 * AirSaathi - pure logic helpers.
 * No DOM, no network here: every function is unit-testable in Node
 * and reused verbatim by app.js in the browser.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.AirLib = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /** AQI bands follow the US EPA breakpoints used by Open-Meteo's us_aqi field. */
  function aqiBand(aqi) {
    if (typeof aqi !== "number" || !isFinite(aqi) || aqi < 0) {
      return { label: "Unknown", tone: "unknown", advice: "Air quality data is unavailable right now." };
    }
    if (aqi <= 50) return { label: "Good", tone: "good", advice: "Great day to be outside." };
    if (aqi <= 100) return { label: "Moderate", tone: "moderate", advice: "Fine for most people; unusually sensitive people should watch symptoms." };
    if (aqi <= 150) return { label: "Unhealthy for sensitive groups", tone: "usg", advice: "Children, elderly people and people with asthma should cut prolonged outdoor exertion." };
    if (aqi <= 200) return { label: "Unhealthy", tone: "unhealthy", advice: "Everyone should reduce outdoor exertion; keep windows closed during peak hours." };
    if (aqi <= 300) return { label: "Very unhealthy", tone: "very-unhealthy", advice: "Avoid outdoor exertion; wear a well-fitted N95/FFP2 mask outside." };
    return { label: "Hazardous", tone: "hazardous", advice: "Stay indoors, seal windows, run air purification if available, wear N95/FFP2 if you must go out." };
  }

  /** City input must be 2-60 chars of letters, spaces, hyphens, apostrophes, dots. */
  function validateCity(name) {
    if (typeof name !== "string") return { ok: false, error: "Enter a city or town name." };
    const trimmed = name.trim();
    if (trimmed.length < 2) return { ok: false, error: "Enter at least 2 letters of your city or town name." };
    if (trimmed.length > 60) return { ok: false, error: "That name looks too long - try a shorter city name." };
    if (!/^[\p{L}][\p{L}\s.'-]*$/u.test(trimmed)) {
      return { ok: false, error: "Use letters, spaces and hyphens only - no numbers or symbols." };
    }
    return { ok: true, value: trimmed };
  }

  /** Rough CO2 avoided per week by choosing a cleaner commute, in kg. */
  var EMISSION_KG_PER_KM = { car: 0.192, motorbike: 0.103, bus: 0.089, metro: 0.041, cycle: 0, walk: 0 };

  function co2SavedPerWeek(mode, kmPerDay, daysPerWeek) {
    var perKm = EMISSION_KG_PER_KM[mode];
    if (perKm === undefined || perKm === 0) return 0;
    var km = Number(kmPerDay);
    var days = daysPerWeek === undefined ? 5 : Number(daysPerWeek);
    if (!isFinite(km) || km <= 0) return 0;
    return Math.round(perKm * km * days * 10) / 10;
  }

  /** The exact prompt sent to the GenAI service. Shown in the UI for transparency. */
  function buildPrompt(input) {
    var lines = [
      "You are AirSaathi, an urban air quality assistant for families and communities facing winter smog and city air pollution.",
      "Write in plain, warm, non-technical language. Use short sentences. No jargon, no medical claims, no product brands.",
      "Give only practical, well-established advice: well-fitted N95/FFP2 masks outdoors on bad days, timing outdoor activity for cleaner hours, keeping windows closed at pollution peaks and ventilating at cleaner times, using exhaust fans while cooking, wet-mopping instead of dry sweeping, not burning incense or biomass indoors, walking/cycling/public transport/carpooling instead of private vehicles, and conserving electricity. Do NOT invent gadgets or unproven tricks, and do not claim houseplants clean the air.",
      "Do not use any markdown formatting: no asterisks, no hashes, no bold.",
      "Answer in EXACTLY these four sections, with these exact headings on their own lines, 3-4 bullet points per section, each bullet on one line starting with '- ':",
      "TODAY'S LOW-EMISSION ROUTINE",
      "INDOOR AIR HACKS",
      "SUSTAINABLE SWAPS",
      "YOUR IMPACT",
      "In YOUR IMPACT, explain in 2-3 plain sentences how these choices directly change the air this person breathes and the emissions they cause.",
      "Keep the whole answer under 320 words.",
      "",
      "Person and place:",
      "- City: " + input.city,
      "- Current US AQI: " + input.aqi + " (" + aqiBand(input.aqi).label + ")",
      "- PM2.5: " + input.pm25 + " ug/m3, PM10: " + input.pm10 + " ug/m3",
      "- Main commute: " + input.commute + ", about " + input.commuteKm + " km each way",
      "- Household: " + (input.household.length ? input.household.join(", ") : "just me"),
      "- Outdoor exercise: " + input.exercise,
      "- Work/school day mostly spent: " + input.workSetting,
      "- Season: winter smog season"
    ];
    return lines.join("\n");
  }

  /** Static safety guidance shown when the GenAI service is unreachable. */
  function fallbackTips(band) {
    var base = [
      "Check the AQI before outdoor plans and move exercise indoors on bad days.",
      "Keep windows closed during morning and evening pollution peaks; ventilate midday when air is usually cleaner.",
      "A well-fitted N95/FFP2 mask filters fine particles outdoors; cloth and surgical masks do not.",
      "Wet-mop floors and dust with a damp cloth instead of dry sweeping.",
      "Avoid burning incense, candles or biomass indoors on high-AQI days."
    ];
    if (band.tone === "very-unhealthy" || band.tone === "hazardous") {
      base.unshift("Today: stay indoors as much as possible and seal windows and door gaps.");
    }
    return base;
  }

  function formatAqiTime(isoLocal) {
    // Open-Meteo returns local ISO like "2026-11-18T18:30".
    if (typeof isoLocal !== "string" || isoLocal.length < 16) return "just now";
    return isoLocal.replace("T", " ");
  }

  return {
    aqiBand: aqiBand,
    validateCity: validateCity,
    co2SavedPerWeek: co2SavedPerWeek,
    buildPrompt: buildPrompt,
    fallbackTips: fallbackTips,
    formatAqiTime: formatAqiTime,
    EMISSION_KG_PER_KM: EMISSION_KG_PER_KM
  };
});
