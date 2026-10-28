// nexus-ems-sync — server side.
//
// Reports the city to the Nexus EMS website:
//   * a heartbeat every Config.HeartbeatSeconds listing every player, with the
//     identifiers the website matches against the roster, their character,
//     job and duty — that keeps city time and the duty clock in step;
//   * duty changes the moment they happen;
//   * /unitstatus and /emscall from medics in the city.
//
// The website decides what happens with each report (Admin → City Link).
//
// Plain JavaScript on FXServer's own Node.js runtime: no build step and no
// packages. HTTP goes through Node's http/https modules, so it works on every
// FXServer artifact, old or new.

const http = require("http");
const https = require("https");

const RESOURCE = GetCurrentResourceName();
const VERSION = GetResourceMetadata(RESOURCE, "version", 0) || "1.0.0";

const BaseUrl = GetConvar("nexus_ems_url", "").replace(/\s+/g, "").replace(/\/+$/, "");
const ApiKey = GetConvar("nexus_ems_api_key", "").trim();

// What the website said at startup: which features are on, and the lists its
// commands accept.
const Remote = { ready: false, dutySync: true, statusSync: true, callSync: true, statuses: [], natures: [], outcomes: [] };

function log(message) {
  console.log(`^5[${RESOURCE}]^7 ${message}`);
}

function debug(message) {
  if (Config.Debug) log(`^8${message}`);
}

function notify(src, message, kind) {
  if (!src || src <= 0) {
    log(message);
    return;
  }
  const color = kind === "error" ? [220, 38, 38] : [16, 185, 129];
  emitNet("chat:addMessage", src, { color, multiline: true, args: ["EMS", message] });
}

// ─── HTTP ─────────────────────────────────────────────────────────────────

/** Calls the website; `cb(status, data)` gets status 0 when it could not be reached. */
function request(method, path, body, cb) {
  if (!BaseUrl || !ApiKey) {
    if (cb) cb(0, { error: "The resource is not configured", detail: "Set nexus_ems_url and nexus_ems_api_key in server.cfg." });
    return;
  }
  debug(`${method} ${path}`);
  let done = false;
  const finish = (status, data) => {
    if (done) return;
    done = true;
    debug(`${method} ${path} → ${status}`);
    if (cb) cb(status, data);
  };

  const url = new URL(BaseUrl + path);
  const payload = body ? JSON.stringify(body) : "";
  const req = (url.protocol === "https:" ? https : http).request(
    url,
    {
      method,
      timeout: 15000,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "x-fivem-key": ApiKey,
      },
    },
    (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => {
        let data = {};
        try {
          const decoded = JSON.parse(text);
          if (decoded && typeof decoded === "object") data = decoded;
        } catch {
          // Not JSON (a proxy's error page): the status says enough.
        }
        finish(res.statusCode, data);
      });
    }
  );
  req.on("timeout", () => req.destroy(new Error("timed out")));
  req.on("error", () => finish(0, {}));
  req.end(payload);
}

const ok = (status) => status >= 200 && status < 300;

// "Not on the EMS roster — No roster member has…" from the website's error body.
function reason(status, data) {
  if (status === 0) return "The website could not be reached. Check nexus_ems_url.";
  let text = data.error || `The website answered ${status}`;
  if (data.detail) text += ` — ${data.detail}`;
  return text;
}

// ─── Who is who ───────────────────────────────────────────────────────────

// Only the identifiers the website matches on. IP addresses are never sent.
const SEND_IDENTIFIERS = new Set(["discord", "steam", "license", "license2", "fivem"]);

function identifiersOf(src) {
  const list = [];
  const count = GetNumPlayerIdentifiers(src);
  for (let i = 0; i < count; i++) {
    const id = GetPlayerIdentifier(src, i);
    const kind = typeof id === "string" && id.match(/^([A-Za-z0-9]+):/);
    if (kind && SEND_IDENTIFIERS.has(kind[1])) list.push(id);
  }
  return list;
}

const isEmsJob = (name) => !!name && Config.EmsJobs.includes(name);

// ─── Frameworks ───────────────────────────────────────────────────────────
//
// Each adapter answers one question — what is this player's character, job
// and duty — so the rest of the resource does not care which one is running.

const Framework = { name: "standalone", player: null };
const standaloneDuty = new Map();

function detectFramework() {
  const wanted = Config.Framework;
  const started = (res) => GetResourceState(res) === "started";

  if ((wanted === "auto" || wanted === "qbox") && started("qbx_core")) {
    Framework.name = "qbox";
    Framework.player = (src) => exports.qbx_core.GetPlayer(src);
  } else if ((wanted === "auto" || wanted === "qbcore") && started("qb-core")) {
    const QBCore = exports["qb-core"].GetCoreObject();
    Framework.name = "qbcore";
    Framework.player = (src) => QBCore.Functions.GetPlayer(src);
  } else if ((wanted === "auto" || wanted === "esx") && started("es_extended")) {
    const ESX = exports["es_extended"].getSharedObject();
    Framework.name = "esx";
    Framework.player = (src) => ESX.GetPlayerFromId(src);
  } else {
    Framework.name = "standalone";
  }
}

/** { character, job, grade, isEms, onDuty } for a player. Unknown values stay undefined. */
function infoOf(src) {
  const info = { character: undefined, job: undefined, grade: undefined, isEms: false, onDuty: false };

  if (Framework.name === "qbcore" || Framework.name === "qbox") {
    const player = Framework.player(src);
    const data = player && player.PlayerData;
    if (data) {
      const char = data.charinfo || {};
      if (char.firstname) info.character = `${char.firstname} ${char.lastname || ""}`;
      const job = data.job || {};
      info.job = job.name;
      info.grade = job.grade ? job.grade.name || job.grade.label : undefined;
      info.isEms = isEmsJob(job.name) || job.type === "ems";
      info.onDuty = info.isEms && job.onduty === true;
    }
  } else if (Framework.name === "esx") {
    const xPlayer = Framework.player(src);
    if (xPlayer) {
      info.character = typeof xPlayer.getName === "function" ? xPlayer.getName() || undefined : undefined;
      const job = xPlayer.job || (typeof xPlayer.getJob === "function" ? xPlayer.getJob() : null) || {};
      info.job = job.name;
      info.grade = job.grade_label || job.grade_name;
      if (isEmsJob(job.name)) {
        info.isEms = true;
        // ESX Legacy 1.10+ carries duty on the job; before that, holding the
        // job is being on duty.
        info.onDuty = job.onDuty === undefined || job.onDuty === null ? true : job.onDuty === true;
      } else if (typeof job.name === "string" && job.name.startsWith("off") && isEmsJob(job.name.slice(3))) {
        // The "offambulance" convention.
        info.isEms = true;
        info.onDuty = false;
      }
    }
  } else {
    info.isEms = !!IsPlayerAceAllowed(src, Config.StandaloneAce);
    info.onDuty = info.isEms && standaloneDuty.get(src) === true;
    info.job = info.isEms ? "ems" : undefined;
  }

  return info;
}

// ─── Duty ─────────────────────────────────────────────────────────────────

// The duty the website was last told about, per player, so an event that
// changes nothing sends nothing. Identifiers are kept for playerDropped.
const lastDuty = new Map();
const identityCache = new Map();
// When each medic last logged a call — one every few seconds, so a held-down
// Enter does not log ten.
const lastCallAt = new Map();
const CALL_COOLDOWN_MS = 10000;

function actorOf(src, info) {
  return {
    identifiers: identityCache.get(src) || identifiersOf(src),
    name: GetPlayerName(src) || "",
    characterName: info ? info.character : undefined,
  };
}

function reportDuty(src, onDuty, info) {
  if (lastDuty.get(src) === onDuty) return;
  lastDuty.set(src, onDuty);
  if (!Remote.dutySync) return;

  const body = { ...actorOf(src, info), onDuty };
  request("POST", "/api/fivem/duty", body, (status, data) => {
    if (ok(status)) {
      if (data.action === "clocked-on") {
        notify(src, "Clocked on duty on the EMS website.");
      } else if (data.action === "clocked-off") {
        const minutes = Math.floor((data.seconds || 0) / 60);
        notify(src, `Clocked off the EMS website after ${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m.`);
      }
    } else if (status === 404) {
      notify(src, reason(status, data), "error");
    } else if (status !== 409) {
      log(`Duty for ${GetPlayerName(src) || src} was not recorded: ${reason(status, data)}`);
    }
  });
}

function syncDuty(src) {
  src = Number(src);
  if (!src || !GetPlayerName(src)) return;
  const info = infoOf(src);
  if (info.isEms) {
    reportDuty(src, info.onDuty, info);
  } else if (lastDuty.get(src)) {
    // Moved off an EMS job while on duty.
    reportDuty(src, false, info);
  }
}

// Framework events that mean duty or job may have changed. Each one just
// re-reads the player; reportDuty drops the ones that changed nothing.
on("QBCore:Server:SetDuty", (src) => syncDuty(src));
on("QBCore:Server:OnJobUpdate", (src) => syncDuty(src));
on("QBCore:Server:PlayerLoaded", (player) => syncDuty(player && player.PlayerData && player.PlayerData.source));
on("esx:setJob", (src) => syncDuty(src));
on("esx:playerLoaded", (src) => syncDuty(src));

on("playerJoining", () => {
  const src = Number(global.source);
  identityCache.set(src, identifiersOf(src));
});

on("playerDropped", () => {
  const src = Number(global.source);
  if (lastDuty.get(src)) {
    // Off duty straight away; the next heartbeat would also notice they left.
    request("POST", "/api/fivem/duty", {
      identifiers: identityCache.get(src) || identifiersOf(src),
      name: GetPlayerName(src) || "",
      onDuty: false,
    });
  }
  lastDuty.delete(src);
  identityCache.delete(src);
  standaloneDuty.delete(src);
  lastCallAt.delete(src);
});

// ─── Heartbeat ────────────────────────────────────────────────────────────

function sendHeartbeat() {
  const players = [];
  for (const id of getPlayers()) {
    const src = Number(id);
    const info = infoOf(src);
    if (!identityCache.has(src)) identityCache.set(src, identifiersOf(src));
    players.push({
      id: src,
      name: GetPlayerName(src) || "",
      identifiers: identityCache.get(src),
      characterName: info.character,
      job: info.job,
      jobGrade: info.grade,
      ems: info.isEms,
      onDuty: info.onDuty,
      ping: GetPlayerPing(src),
    });
    if (info.isEms) lastDuty.set(src, info.onDuty);
  }

  request(
    "POST",
    "/api/fivem/heartbeat",
    {
      name: GetConvar("sv_projectName", GetConvar("sv_hostname", "")),
      maxPlayers: GetConvarInt("sv_maxclients", 48),
      resourceVersion: VERSION,
      framework: Framework.name,
      players,
    },
    (status, data) => {
      if (ok(status)) {
        debug(`Heartbeat: ${data.players || 0} players, ${data.matched || 0} on the roster`);
      } else {
        log(`^1Heartbeat refused:^7 ${reason(status, data)}`);
      }
    }
  );
}

// ─── Startup ──────────────────────────────────────────────────────────────

function ping() {
  request("GET", "/api/fivem/ping", null, (status, data) => {
    if (ok(status) && data.ok) {
      Remote.ready = true;
      Remote.dutySync = data.dutySync !== false;
      Remote.statusSync = data.statusSync !== false;
      Remote.callSync = data.callSync !== false;
      Remote.statuses = data.statuses || [];
      Remote.natures = data.natures || [];
      Remote.outcomes = data.outcomes || [];
      const onOff = (v) => (v ? "on" : "off");
      log(
        `^2Linked to ${BaseUrl}^7 · duty sync ${onOff(Remote.dutySync)} · statuses ${onOff(Remote.statusSync)} · calls ${onOff(
          Remote.callSync
        )} · framework ${Framework.name}`
      );
    } else {
      log(`^1Not linked:^7 ${reason(status, data)}`);
    }
  });
}

function start() {
  if (!BaseUrl || !ApiKey) {
    log("^1Not configured.^7 Add to server.cfg:");
    log('  set nexus_ems_url "https://your-site.example.com"');
    log('  set nexus_ems_api_key "<FIVEM_API_KEY from the website>"');
    return;
  }
  if (!/^https?:\/\//.test(BaseUrl)) {
    log(`^1nexus_ems_url must start with https://^7 (it is ${BaseUrl})`);
    return;
  }

  // Give the framework a moment to start before asking it about players.
  setTimeout(() => {
    detectFramework();
    ping();

    // Past 90 seconds the website would start treating the resource as gone
    // between beats.
    const interval = Math.min(90, Math.max(15, Config.HeartbeatSeconds));
    let beats = 0;
    const beat = () => {
      sendHeartbeat();
      beats++;
      // Re-read the website's settings every 10 minutes, so switching a
      // feature off on the website reaches the city without a restart.
      if (beats % Math.floor(600 / interval) === 0) ping();
    };
    beat();
    setInterval(beat, interval * 1000);
  }, 2000);
}

start();

// ─── Commands ─────────────────────────────────────────────────────────────

function requireEms(src) {
  const info = infoOf(src);
  if (!info.isEms) {
    notify(src, "Only EMS can use this command.", "error");
    return null;
  }
  return info;
}

if (Config.Commands.duty) {
  RegisterCommand(
    Config.Commands.duty,
    (src) => {
      if (src <= 0) return;
      if (!requireEms(src)) return;

      if (Framework.name === "standalone") {
        standaloneDuty.set(src, !standaloneDuty.get(src));
        notify(src, standaloneDuty.get(src) ? "You are on EMS duty." : "You are off EMS duty.");
        syncDuty(src);
      } else if (Framework.name === "qbcore" || Framework.name === "qbox") {
        const player = Framework.player(src);
        if (player) {
          const onDuty = !player.PlayerData.job.onduty;
          player.Functions.SetJobDuty(onDuty);
          emit("QBCore:Server:SetDuty", src, onDuty);
          emitNet("QBCore:Client:SetDuty", src, onDuty);
          notify(src, onDuty ? "You are on EMS duty." : "You are off EMS duty.");
        }
      } else {
        notify(src, "Use your job's duty point to go on or off duty — the website follows it.", "error");
      }
    },
    false
  );
}

/** Sets a unit's Duty Board status. `cb(success, dataOrError)`. */
function setStatus(src, status, note, cb) {
  const body = { ...actorOf(src, infoOf(src)), status, note };
  request("POST", "/api/fivem/unit-status", body, (code, data) => {
    if (cb) cb(ok(code), ok(code) ? data : reason(code, data));
  });
}

if (Config.Commands.status) {
  RegisterCommand(
    Config.Commands.status,
    (src, args) => {
      if (src <= 0) return;
      if (!requireEms(src)) return;
      if (!args[0]) {
        const list = Remote.statuses.length
          ? Remote.statuses.join(", ")
          : "Available, En Route, On Scene, Transporting, At Hospital, Busy, On Break";
        notify(src, `Usage: /${Config.Commands.status} <status> [note]. Statuses: ${list}`);
        return;
      }
      const [status, ...rest] = args;
      const note = rest.length ? rest.join(" ") : undefined;
      setStatus(src, status, note, (success, result) => {
        if (success) notify(src, `Status: ${result.status}${result.note ? ` · ${result.note}` : ""}`);
        else notify(src, result, "error");
      });
    },
    false
  );
}

// ─── Calls ────────────────────────────────────────────────────────────────

function nearbyEms(src) {
  const ped = GetPlayerPed(src);
  if (!ped) return [];
  const [ox, oy, oz] = GetEntityCoords(ped);
  if (ox === 0 && oy === 0) return []; // no OneSync

  const list = [];
  for (const id of getPlayers()) {
    const other = Number(id);
    if (other === src) continue;
    const otherPed = GetPlayerPed(other);
    if (!otherPed) continue;
    const [x, y, z] = GetEntityCoords(otherPed);
    if (Math.hypot(x - ox, y - oy, z - oz) <= Config.ResponderRadius) {
      const info = infoOf(other);
      if (info.isEms && info.onDuty) list.push(actorOf(other, info));
    }
  }
  return list;
}

/**
 * Logs a call with `src` as the lead medic. `call` is { nature, location,
 * outcome, hospital, priority, patientName, patientStateId, notes }; only
 * nature and location are needed. `cb(success, callNumberOrError, data)`.
 */
function logCall(src, call, cb) {
  const body = { ...actorOf(src, infoOf(src)), call, responders: nearbyEms(src) };
  request("POST", "/api/fivem/calls", body, (code, data) => {
    if (!cb) return;
    if (ok(code)) cb(true, data.callNumber, data);
    else cb(false, reason(code, data));
  });
}

// /emscall from the client, which adds the street it was typed on.
onNet("nexus-ems-sync:logCall", (text, street) => {
  const src = Number(global.source);
  if (!Config.Commands.call) return;
  if (!requireEms(src)) return;
  if (lastCallAt.has(src) && GetGameTimer() - lastCallAt.get(src) < CALL_COOLDOWN_MS) {
    notify(src, "Wait a few seconds before logging another call.", "error");
    return;
  }
  if (typeof text !== "string" || !text.replace(/\s/g, "")) {
    const cmd = Config.Commands.call;
    notify(src, `Usage: /${cmd} nature | outcome | hospital | notes — e.g. /${cmd} cardiac arrest | transported | pillbox | ROSC on scene`);
    return;
  }

  lastCallAt.set(src, GetGameTimer());

  const parts = text.slice(0, 600).split("|").map((part) => part.trim());
  const call = {
    nature: parts[0],
    outcome: parts[1] || undefined,
    hospital: parts[2] || undefined,
    notes: parts[3] || undefined,
    location: typeof street === "string" ? street.slice(0, 120) : "Unknown",
  };
  logCall(src, call, (success, result, data) => {
    if (success) {
      const extra = data && data.responders > 1 ? ` with ${data.responders} responders` : "";
      notify(src, `Logged ${result} · ${(data && data.nature) || call.nature}${extra}`);
    } else {
      notify(src, result, "error");
    }
  });
});

// ─── Exports, for dispatch and job scripts ────────────────────────────────

exports("LogCall", logCall);
exports("SetUnitStatus", setStatus);
exports("SyncDuty", syncDuty);
