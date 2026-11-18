/*
 * AirSaathi - browser wiring.
 * Flow: validate city -> geocode (Open-Meteo) -> live AQI (Open-Meteo)
 *       -> build prompt (lib.js) -> GenAI plan (Pollinations, keyless).
 * All AI text is rendered with textContent - never innerHTML - so model
 * output cannot inject markup into the page.
 */
(function () {
  "use strict";

  var L = window.AirLib;
  var GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
  var AQI_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";
  var AI_URL = "https://text.pollinations.ai/";

  var $ = function (id) { return document.getElementById(id); };
  var panels = {
    aqi: $("aqi-panel"),
    impact: $("impact-panel"),
    plan: $("plan-panel"),
    error: $("error-panel")
  };

  function show(panel) { panel.hidden = false; }
  function hide(panel) { panel.hidden = true; }
  function hideResults() {
    hide(panels.aqi); hide(panels.impact); hide(panels.plan); hide(panels.error);
  }

  function fetchJson(url, options, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs || 12000);
    return fetch(url, Object.assign({}, options, { signal: controller.signal }))
      .then(function (res) {
        if (!res.ok) throw new Error("Service answered with HTTP " + res.status);
        return res.json();
      })
      .finally(function () { clearTimeout(timer); });
  }

  function geocodeCity(city) {
    var url = GEOCODE_URL + "?name=" + encodeURIComponent(city) + "&count=1&language=en&format=json";
    return fetchJson(url).then(function (data) {
      if (!data.results || !data.results.length) {
        var err = new Error("place-not-found");
        err.code = "PLACE_NOT_FOUND";
        throw err;
      }
      var r = data.results[0];
      return {
        name: r.name + (r.admin1 ? ", " + r.admin1 : "") + (r.country ? ", " + r.country : ""),
        latitude: r.latitude,
        longitude: r.longitude,
        timezone: r.timezone || "auto"
      };
    });
  }

  function fetchAqi(place) {
    var url = AQI_URL + "?latitude=" + place.latitude + "&longitude=" + place.longitude +
      "&current=us_aqi,pm2_5,pm10&timezone=auto";
    return fetchJson(url).then(function (data) {
      if (!data.current || typeof data.current.us_aqi !== "number") {
        throw new Error("Air quality data was incomplete for this place.");
      }
      return {
        aqi: Math.round(data.current.us_aqi),
        pm25: data.current.pm2_5,
        pm10: data.current.pm10,
        time: data.current.time
      };
    });
  }

  function askAssistant(prompt) {
    return fetch(AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        model: "openai"
      })
    }).then(function (res) {
      if (!res.ok) throw new Error("The AI service answered with HTTP " + res.status);
      return res.text();
    }).then(function (text) {
      var clean = (text || "").trim();
      if (/limit reached|try again|rate limit/i.test(clean) && clean.length < 400) {
        var busy = new Error("The free AI service is busy right now (one answer per 45 seconds). Wait a moment and press Try again.");
        busy.code = "AI_BUSY";
        throw busy;
      }
      if (clean.length < 40) throw new Error("The AI returned an empty answer.");
      return clean;
    });
  }

  function renderAqi(place, air) {
    var band = L.aqiBand(air.aqi);
    $("aqi-value").textContent = String(air.aqi);
    var bandEl = $("aqi-band");
    bandEl.textContent = band.label;
    $("aqi-box").dataset.tone = band.tone;
    $("aqi-advice").textContent = band.advice;
    $("aqi-meta").textContent = place.name + " - PM2.5 " + air.pm25 + " ug/m3, PM10 " +
      air.pm10 + " ug/m3 - measured " + L.formatAqiTime(air.time) + " local time";
    show(panels.aqi);
    return band;
  }

  function renderImpact(commute, km) {
    var saved = L.co2SavedPerWeek(commute, km);
    var el = $("impact-text");
    if (saved > 0) {
      el.textContent = "Switching your " + km + " km " + commute +
        " commute to cycling, walking or a clean metro could avoid roughly " + saved +
        " kg of CO2 every week - about " + Math.round(saved * 52) + " kg a year, before counting the cleaner air on your own street.";
    } else {
      el.textContent = "Your " + commute + " commute already adds almost no direct tailpipe emissions. " +
        "Your biggest wins are indoors: clean cooking, no indoor burning, and smart ventilation timing.";
    }
    show(panels.impact);
  }

  function renderPlanLoading() {
    $("plan-status").textContent = "Writing your plan with the AI - this takes up to half a minute...";
    $("plan-output").textContent = "";
    show(panels.plan);
  }

  function renderPlan(text, prompt) {
    $("plan-status").textContent = "";
    // Rendered as plain text; line breaks preserved via CSS white-space.
    $("plan-output").textContent = text;
    $("prompt-view").textContent = prompt;
    $("plan-output").focus({ preventScroll: true });
  }

  function renderError(err, band) {
    var msg;
    if (err && err.code === "PLACE_NOT_FOUND") {
      msg = "We could not find that place. Check the spelling, or try the nearest big city or your district name.";
    } else if (err && err.name === "AbortError") {
      msg = "The service took too long to answer. Your connection or the service may be slow - please try again.";
    } else {
      msg = (err && err.message) ? err.message : "Something went wrong. Please try again.";
    }
    $("error-text").textContent = msg;

    var box = $("fallback-box");
    var list = $("fallback-list");
    list.textContent = "";
    if (band) {
      L.fallbackTips(band).forEach(function (tip) {
        var li = document.createElement("li");
        li.textContent = tip;
        list.appendChild(li);
      });
      box.hidden = false;
    } else {
      box.hidden = true;
    }
    show(panels.error);
    $("retry-btn").focus({ preventScroll: true });
  }

  function readProfile() {
    var household = Array.prototype.slice
      .call(document.querySelectorAll('input[name="household"]:checked'))
      .map(function (c) { return c.value; });
    return {
      city: $("city").value,
      commute: $("commute").value,
      commuteKm: $("commute-km").value || "0",
      household: household,
      exercise: $("exercise").value,
      workSetting: $("work-setting").value
    };
  }

  var lastRun = null;

  function run() {
    hideResults();
    var cityError = $("city-error");
    var profile = readProfile();
    var check = L.validateCity(profile.city);
    if (!check.ok) {
      cityError.textContent = check.error;
      cityError.hidden = false;
      $("city").setAttribute("aria-invalid", "true");
      $("city").focus();
      return;
    }
    cityError.hidden = true;
    $("city").removeAttribute("aria-invalid");
    profile.city = check.value;

    var btn = $("submit-btn");
    btn.disabled = true;
    btn.textContent = "Working...";

    var place, air, band, prompt;
    geocodeCity(profile.city)
      .then(function (p) { place = p; return fetchAqi(p); })
      .then(function (a) {
        air = a;
        band = renderAqi(place, air);
        renderImpact(profile.commute, profile.commuteKm);
        prompt = L.buildPrompt({
          city: place.name,
          aqi: air.aqi,
          pm25: air.pm25,
          pm10: air.pm10,
          commute: profile.commute,
          commuteKm: profile.commuteKm,
          household: profile.household,
          exercise: profile.exercise,
          workSetting: profile.workSetting
        });
        renderPlanLoading();
        lastRun = { profile: profile, place: place, air: air, band: band, prompt: prompt };
        return askAssistant(prompt);
      })
      .then(function (text) { renderPlan(text, prompt); })
      .catch(function (err) {
        // If we already have AQI, the failure was the AI step: still show
        // the live data plus static safety tips (a real edge-case path).
        renderError(err, band || null);
        if (air) { hide(panels.plan); }
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = "Build my clean-air plan";
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("profile-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      run();
    });
    $("retry-btn").addEventListener("click", function () {
      hide(panels.error);
      if (lastRun) {
        renderPlanLoading();
        show(panels.plan);
        askAssistant(lastRun.prompt)
          .then(function (text) { renderPlan(text, lastRun.prompt); })
          .catch(function (err) { renderError(err, lastRun.band); });
      }
    });
    var saved = null;
    try { saved = window.localStorage.getItem("airsaathi-city"); } catch (e) { /* private mode */ }
    if (saved) $("city").value = saved;
    $("profile-form").addEventListener("submit", function () {
      try { window.localStorage.setItem("airsaathi-city", $("city").value.trim()); } catch (e) { /* ignore */ }
    });
  });
})();
