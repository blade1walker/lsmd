-- nexus-ems-sync — server side.
--
-- Reports the city to the Nexus EMS website:
--   * a heartbeat every Config.HeartbeatSeconds listing every player, with the
--     identifiers the website matches against the roster, their character,
--     job and duty — that keeps city time and the duty clock in step;
--   * duty changes the moment they happen;
--   * /unitstatus and /emscall from medics in the city.
--
-- The website decides what happens with each report (Admin → City Link).

local RESOURCE = GetCurrentResourceName()
local VERSION = GetResourceMetadata(RESOURCE, "version", 0) or "1.0.0"

local BaseUrl = (GetConvar("nexus_ems_url", "")):gsub("%s+", ""):gsub("/+$", "")
local ApiKey = (GetConvar("nexus_ems_api_key", "")):gsub("^%s+", ""):gsub("%s+$", "")

-- What the website said at startup: which features are on, and the lists its
-- commands accept.
local Remote = { ready = false, dutySync = true, statusSync = true, callSync = true, statuses = {}, natures = {}, outcomes = {} }

local function log(message, ...)
  print(("^5[%s]^7 " .. message):format(RESOURCE, ...))
end

local function debug(message, ...)
  if Config.Debug then log("^8" .. message, ...) end
end

local function notify(src, message, kind)
  if not src or src <= 0 then
    log(message)
    return
  end
  local color = kind == "error" and { 220, 38, 38 } or { 16, 185, 129 }
  TriggerClientEvent("chat:addMessage", src, { color = color, multiline = true, args = { "EMS", message } })
end

-- ─── HTTP ─────────────────────────────────────────────────────────────────

local function request(method, path, body, cb)
  if BaseUrl == "" or ApiKey == "" then
    if cb then cb(0, { error = "The resource is not configured", detail = "Set nexus_ems_url and nexus_ems_api_key in server.cfg." }) end
    return
  end
  debug("%s %s", method, path)
  PerformHttpRequest(BaseUrl .. path, function(status, text, _, errorText)
    local data = {}
    local raw = text or errorText
    if raw and raw ~= "" then
      local ok, decoded = pcall(json.decode, raw)
      if ok and type(decoded) == "table" then data = decoded end
    end
    debug("%s %s → %s", method, path, tostring(status))
    if cb then cb(status, data) end
  end, method, body and json.encode(body) or "", {
    ["Content-Type"] = "application/json",
    ["x-fivem-key"] = ApiKey,
  })
end

local function ok(status)
  return status and status >= 200 and status < 300
end

-- "Not on the EMS roster — No roster member has…" from the website's error body.
local function reason(status, data)
  if status == 0 then return "The website could not be reached. Check nexus_ems_url." end
  local text = data.error or ("The website answered " .. tostring(status))
  if data.detail then text = text .. " — " .. data.detail end
  return text
end

-- ─── Who is who ───────────────────────────────────────────────────────────

-- Only the identifiers the website matches on. IP addresses are never sent.
local SEND_IDENTIFIERS = { discord = true, steam = true, license = true, license2 = true, fivem = true }

local function identifiersOf(src)
  local list = {}
  for _, id in ipairs(GetPlayerIdentifiers(src)) do
    local kind = id:match("^(%w+):")
    if kind and SEND_IDENTIFIERS[kind] then list[#list + 1] = id end
  end
  return list
end

local function isEmsJob(name)
  if not name then return false end
  for _, job in ipairs(Config.EmsJobs) do
    if job == name then return true end
  end
  return false
end

-- ─── Frameworks ───────────────────────────────────────────────────────────
--
-- Each adapter answers one question — what is this player's character, job
-- and duty — so the rest of the resource does not care which one is running.

local Framework = { name = "standalone" }
local standaloneDuty = {}

local function detectFramework()
  local wanted = Config.Framework
  local function started(res) return GetResourceState(res) == "started" end

  if (wanted == "auto" or wanted == "qbox") and started("qbx_core") then
    Framework.name = "qbox"
    Framework.player = function(src) return exports.qbx_core:GetPlayer(src) end
  elseif (wanted == "auto" or wanted == "qbcore") and started("qb-core") then
    local QBCore = exports["qb-core"]:GetCoreObject()
    Framework.name = "qbcore"
    Framework.player = function(src) return QBCore.Functions.GetPlayer(src) end
  elseif (wanted == "auto" or wanted == "esx") and started("es_extended") then
    local ESX = exports["es_extended"]:getSharedObject()
    Framework.name = "esx"
    Framework.player = function(src) return ESX.GetPlayerFromId(src) end
  else
    Framework.name = "standalone"
  end
end

-- { character, job, grade, isEms, onDuty } for a player.
local function infoOf(src)
  local info = { character = nil, job = nil, grade = nil, isEms = false, onDuty = false }

  if Framework.name == "qbcore" or Framework.name == "qbox" then
    local player = Framework.player(src)
    local data = player and player.PlayerData
    if data then
      local char = data.charinfo or {}
      if char.firstname then info.character = ("%s %s"):format(char.firstname, char.lastname or "") end
      local job = data.job or {}
      info.job = job.name
      info.grade = job.grade and (job.grade.name or job.grade.label) or nil
      info.isEms = isEmsJob(job.name) or job.type == "ems"
      info.onDuty = info.isEms and job.onduty == true
    end
  elseif Framework.name == "esx" then
    local xPlayer = Framework.player(src)
    if xPlayer then
      info.character = xPlayer.getName and xPlayer.getName() or nil
      local job = xPlayer.job or (xPlayer.getJob and xPlayer.getJob()) or {}
      info.job = job.name
      info.grade = job.grade_label or job.grade_name
      if isEmsJob(job.name) then
        info.isEms = true
        -- ESX Legacy 1.10+ carries duty on the job; before that, holding the
        -- job is being on duty.
        if job.onDuty == nil then info.onDuty = true else info.onDuty = job.onDuty == true end
      elseif job.name and job.name:sub(1, 3) == "off" and isEmsJob(job.name:sub(4)) then
        -- The "offambulance" convention.
        info.isEms = true
        info.onDuty = false
      end
    end
  else
    info.isEms = IsPlayerAceAllowed(src, Config.StandaloneAce)
    info.onDuty = info.isEms and standaloneDuty[src] == true
    info.job = info.isEms and "ems" or nil
  end

  return info
end

-- ─── Duty ─────────────────────────────────────────────────────────────────

-- The duty the website was last told about, per player, so an event that
-- changes nothing sends nothing. Identifiers are kept for playerDropped.
local lastDuty = {}
local identityCache = {}
-- When each medic last logged a call — one every few seconds, so a held-down
-- Enter does not log ten.
local lastCallAt = {}
local CALL_COOLDOWN_MS = 10000

local function actorOf(src, info)
  return {
    identifiers = identityCache[src] or identifiersOf(src),
    name = GetPlayerName(src) or "",
    characterName = info and info.character or nil,
  }
end

local function reportDuty(src, onDuty, info)
  if lastDuty[src] == onDuty then return end
  lastDuty[src] = onDuty
  if not Remote.dutySync then return end

  local body = actorOf(src, info)
  body.onDuty = onDuty
  request("POST", "/api/fivem/duty", body, function(status, data)
    if ok(status) then
      if data.action == "clocked-on" then
        notify(src, "Clocked on duty on the EMS website.")
      elseif data.action == "clocked-off" then
        local minutes = math.floor((data.seconds or 0) / 60)
        notify(src, ("Clocked off the EMS website after %dh %02dm."):format(minutes // 60, minutes % 60))
      end
    elseif status == 404 then
      notify(src, reason(status, data), "error")
    elseif status ~= 409 then
      log("Duty for %s was not recorded: %s", GetPlayerName(src) or src, reason(status, data))
    end
  end)
end

local function syncDuty(src)
  src = tonumber(src)
  if not src or not GetPlayerName(src) then return end
  local info = infoOf(src)
  if info.isEms then
    reportDuty(src, info.onDuty, info)
  elseif lastDuty[src] then
    -- Moved off an EMS job while on duty.
    reportDuty(src, false, info)
  end
end

-- Framework events that mean duty or job may have changed. Each one just
-- re-reads the player; reportDuty drops the ones that changed nothing.
AddEventHandler("QBCore:Server:SetDuty", function(src) syncDuty(src) end)
AddEventHandler("QBCore:Server:OnJobUpdate", function(src) syncDuty(src) end)
AddEventHandler("QBCore:Server:PlayerLoaded", function(player) syncDuty(player and player.PlayerData and player.PlayerData.source) end)
AddEventHandler("esx:setJob", function(src) syncDuty(src) end)
AddEventHandler("esx:playerLoaded", function(src) syncDuty(src) end)

AddEventHandler("playerJoining", function()
  identityCache[source] = identifiersOf(source)
end)

AddEventHandler("playerDropped", function()
  local src = source
  if lastDuty[src] then
    -- Off duty straight away; the next heartbeat would also notice they left.
    request("POST", "/api/fivem/duty", { identifiers = identityCache[src] or identifiersOf(src), name = GetPlayerName(src) or "", onDuty = false })
  end
  lastDuty[src] = nil
  identityCache[src] = nil
  standaloneDuty[src] = nil
  lastCallAt[src] = nil
end)

-- ─── Heartbeat ────────────────────────────────────────────────────────────

local function sendHeartbeat()
  local players = {}
  for _, id in ipairs(GetPlayers()) do
    local src = tonumber(id)
    local info = infoOf(src)
    identityCache[src] = identityCache[src] or identifiersOf(src)
    players[#players + 1] = {
      id = src,
      name = GetPlayerName(src) or "",
      identifiers = identityCache[src],
      characterName = info.character,
      job = info.job,
      jobGrade = info.grade,
      ems = info.isEms,
      onDuty = info.onDuty,
      ping = GetPlayerPing(src),
    }
    if info.isEms then lastDuty[src] = info.onDuty end
  end

  request("POST", "/api/fivem/heartbeat", {
    name = GetConvar("sv_projectName", GetConvar("sv_hostname", "")),
    maxPlayers = GetConvarInt("sv_maxclients", 48),
    resourceVersion = VERSION,
    framework = Framework.name,
    players = players,
  }, function(status, data)
    if ok(status) then
      debug("Heartbeat: %d players, %d on the roster", data.players or 0, data.matched or 0)
    else
      log("^1Heartbeat refused:^7 %s", reason(status, data))
    end
  end)
end

-- ─── Startup ──────────────────────────────────────────────────────────────

local function ping()
  request("GET", "/api/fivem/ping", nil, function(status, data)
    if ok(status) and data.ok then
      Remote.ready = true
      Remote.dutySync = data.dutySync ~= false
      Remote.statusSync = data.statusSync ~= false
      Remote.callSync = data.callSync ~= false
      Remote.statuses = data.statuses or {}
      Remote.natures = data.natures or {}
      Remote.outcomes = data.outcomes or {}
      log("^2Linked to %s^7 · duty sync %s · statuses %s · calls %s · framework %s",
        BaseUrl,
        Remote.dutySync and "on" or "off",
        Remote.statusSync and "on" or "off",
        Remote.callSync and "on" or "off",
        Framework.name)
    else
      log("^1Not linked:^7 %s", reason(status, data))
    end
  end)
end

CreateThread(function()
  if BaseUrl == "" or ApiKey == "" then
    log("^1Not configured.^7 Add to server.cfg:")
    log('  set nexus_ems_url "https://your-site.example.com"')
    log('  set nexus_ems_api_key "<FIVEM_API_KEY from the website>"')
    return
  end
  if not BaseUrl:match("^https?://") then
    log("^1nexus_ems_url must start with https://^7 (it is %s)", BaseUrl)
    return
  end

  -- Give the framework a moment to start before asking it about players.
  Wait(2000)
  detectFramework()
  ping()

  -- Past 90 seconds the website would start treating the resource as gone
  -- between beats.
  local interval = math.min(90, math.max(15, Config.HeartbeatSeconds))
  local beats = 0
  while true do
    sendHeartbeat()
    beats = beats + 1
    -- Re-read the website's settings every 10 minutes, so switching a
    -- feature off on the website reaches the city without a restart.
    if beats % math.floor(600 / interval) == 0 then ping() end
    Wait(interval * 1000)
  end
end)

-- ─── Commands ─────────────────────────────────────────────────────────────

local function requireEms(src)
  local info = infoOf(src)
  if not info.isEms then
    notify(src, "Only EMS can use this command.", "error")
    return nil
  end
  return info
end

if Config.Commands.duty then
  RegisterCommand(Config.Commands.duty, function(src)
    if src <= 0 then return end
    local info = requireEms(src)
    if not info then return end

    if Framework.name == "standalone" then
      standaloneDuty[src] = not standaloneDuty[src]
      notify(src, standaloneDuty[src] and "You are on EMS duty." or "You are off EMS duty.")
      syncDuty(src)
    elseif Framework.name == "qbcore" or Framework.name == "qbox" then
      local player = Framework.player(src)
      if player then
        local onDuty = not player.PlayerData.job.onduty
        player.Functions.SetJobDuty(onDuty)
        TriggerEvent("QBCore:Server:SetDuty", src, onDuty)
        TriggerClientEvent("QBCore:Client:SetDuty", src, onDuty)
        notify(src, onDuty and "You are on EMS duty." or "You are off EMS duty.")
      end
    else
      notify(src, "Use your job's duty point to go on or off duty — the website follows it.", "error")
    end
  end, false)
end

local function setStatus(src, status, note, cb)
  local info = infoOf(src)
  local body = actorOf(src, info)
  body.status = status
  body.note = note
  request("POST", "/api/fivem/unit-status", body, function(code, data)
    if cb then cb(ok(code), ok(code) and data or reason(code, data)) end
  end)
end

if Config.Commands.status then
  RegisterCommand(Config.Commands.status, function(src, args)
    if src <= 0 then return end
    if not requireEms(src) then return end
    if not args[1] then
      local list = #Remote.statuses > 0 and table.concat(Remote.statuses, ", ") or "Available, En Route, On Scene, Transporting, At Hospital, Busy, On Break"
      notify(src, ("Usage: /%s <status> [note]. Statuses: %s"):format(Config.Commands.status, list))
      return
    end
    local status = table.remove(args, 1)
    local note = #args > 0 and table.concat(args, " ") or nil
    setStatus(src, status, note, function(success, result)
      if success then
        notify(src, ("Status: %s%s"):format(result.status, result.note and (" · " .. result.note) or ""))
      else
        notify(src, result, "error")
      end
    end)
  end, false)
end

-- ─── Calls ────────────────────────────────────────────────────────────────

local function nearbyEms(src)
  local ped = GetPlayerPed(src)
  if not ped or ped == 0 then return {} end
  local origin = GetEntityCoords(ped)
  if origin.x == 0.0 and origin.y == 0.0 then return {} end -- no OneSync

  local list = {}
  for _, id in ipairs(GetPlayers()) do
    local other = tonumber(id)
    if other ~= src then
      local otherPed = GetPlayerPed(other)
      if otherPed and otherPed ~= 0 and #(GetEntityCoords(otherPed) - origin) <= Config.ResponderRadius then
        local info = infoOf(other)
        if info.isEms and info.onDuty then list[#list + 1] = actorOf(other, info) end
      end
    end
  end
  return list
end

-- Logs a call with `src` as the lead medic. `call` is { nature, location,
-- outcome, hospital, priority, patientName, patientStateId, notes }; only
-- nature and location are needed. `cb(success, callNumberOrError)`.
local function logCall(src, call, cb)
  local info = infoOf(src)
  local body = actorOf(src, info)
  body.call = call
  body.responders = nearbyEms(src)
  request("POST", "/api/fivem/calls", body, function(code, data)
    if not cb then return end
    if ok(code) then cb(true, data.callNumber, data) else cb(false, reason(code, data)) end
  end)
end

-- /emscall from the client, which adds the street it was typed on.
RegisterNetEvent("nexus-ems-sync:logCall", function(text, street)
  local src = source
  if not Config.Commands.call then return end
  if not requireEms(src) then return end
  if lastCallAt[src] and GetGameTimer() - lastCallAt[src] < CALL_COOLDOWN_MS then
    notify(src, "Wait a few seconds before logging another call.", "error")
    return
  end
  if type(text) ~= "string" or text:gsub("%s", "") == "" then
    notify(src, ("Usage: /%s nature | outcome | hospital | notes — e.g. /%s cardiac arrest | transported | pillbox | ROSC on scene"):format(Config.Commands.call, Config.Commands.call))
    return
  end

  lastCallAt[src] = GetGameTimer()

  local parts = {}
  for part in (text:sub(1, 600) .. "|"):gmatch("([^|]*)|") do parts[#parts + 1] = part:match("^%s*(.-)%s*$") end
  local call = {
    nature = parts[1],
    outcome = parts[2] ~= "" and parts[2] or nil,
    hospital = parts[3] ~= "" and parts[3] or nil,
    notes = parts[4] ~= "" and parts[4] or nil,
    location = type(street) == "string" and street:sub(1, 120) or "Unknown",
  }
  logCall(src, call, function(success, result, data)
    if success then
      local extra = data and data.responders and data.responders > 1 and (" with %d responders"):format(data.responders) or ""
      notify(src, ("Logged %s · %s%s"):format(result, data and data.nature or call.nature, extra))
    else
      notify(src, result, "error")
    end
  end)
end)

-- ─── Exports, for dispatch and job scripts ────────────────────────────────

exports("LogCall", logCall)
exports("SetUnitStatus", setStatus)
exports("SyncDuty", syncDuty)
