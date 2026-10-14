-- nexus-ems-sync — client side. Only /emscall lives here: the street it was
-- typed on can only be read in the client, and the server needs it as the
-- call's location. Everything else is server side.

local function streetHere()
  local coords = GetEntityCoords(PlayerPedId())
  local streetHash, crossingHash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
  local street = GetStreetNameFromHashKey(streetHash)
  local crossing = crossingHash ~= 0 and GetStreetNameFromHashKey(crossingHash) or ""
  local zone = GetLabelText(GetNameOfZone(coords.x, coords.y, coords.z))

  local where = street ~= "" and street or "Unknown street"
  if crossing ~= "" then where = where .. " / " .. crossing end
  if zone and zone ~= "" and zone ~= "NULL" then where = where .. ", " .. zone end
  return where
end

if Config.Commands.call then
  RegisterCommand(Config.Commands.call, function(_, _, raw)
    -- Everything after the command name, | separators and all.
    local text = (raw or ""):gsub("^%S+%s*", "")
    TriggerServerEvent("nexus-ems-sync:logCall", text, streetHere())
  end, false)
end

CreateThread(function()
  Wait(1000)
  if Config.Commands.duty then
    TriggerEvent("chat:addSuggestion", "/" .. Config.Commands.duty, "Go on or off EMS duty — the EMS website clocks you on and off")
  end
  if Config.Commands.status then
    TriggerEvent("chat:addSuggestion", "/" .. Config.Commands.status, "Set your status on the EMS Duty Board", {
      { name = "status", help = "available, enroute, onscene, transporting, hospital, busy, break" },
      { name = "note", help = "Optional — where you are or what you are on" },
    })
  end
  if Config.Commands.call then
    TriggerEvent("chat:addSuggestion", "/" .. Config.Commands.call, "Log a call in the EMS Call Log — nature | outcome | hospital | notes", {
      { name = "nature", help = "e.g. cardiac arrest, fall, gunshot" },
      { name = "| outcome", help = "e.g. treated, transported, refused — treated on scene if left out" },
      { name = "| hospital", help = "When transported, e.g. pillbox" },
      { name = "| notes", help = "Optional" },
    })
  end
end)
