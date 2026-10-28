// nexus-ems-sync — client side. Only /emscall lives here: the street it was
// typed on can only be read in the client, and the server needs it as the
// call's location. Everything else is server side.

function streetHere() {
  const [x, y, z] = GetEntityCoords(PlayerPedId());
  const [streetHash, crossingHash] = GetStreetNameAtCoord(x, y, z);
  const street = GetStreetNameFromHashKey(streetHash);
  const crossing = crossingHash !== 0 ? GetStreetNameFromHashKey(crossingHash) : "";
  const zone = GetLabelText(GetNameOfZone(x, y, z));

  let where = street || "Unknown street";
  if (crossing) where += ` / ${crossing}`;
  if (zone && zone !== "NULL") where += `, ${zone}`;
  return where;
}

if (Config.Commands.call) {
  RegisterCommand(
    Config.Commands.call,
    (_source, _args, raw) => {
      // Everything after the command name, | separators and all.
      const text = (raw || "").replace(/^\S+\s*/, "");
      emitNet("nexus-ems-sync:logCall", text, streetHere());
    },
    false
  );
}

setTimeout(() => {
  if (Config.Commands.duty) {
    emit("chat:addSuggestion", `/${Config.Commands.duty}`, "Go on or off EMS duty — the EMS website clocks you on and off");
  }
  if (Config.Commands.status) {
    emit("chat:addSuggestion", `/${Config.Commands.status}`, "Set your status on the EMS Duty Board", [
      { name: "status", help: "available, enroute, onscene, transporting, hospital, busy, break" },
      { name: "note", help: "Optional — where you are or what you are on" },
    ]);
  }
  if (Config.Commands.call) {
    emit("chat:addSuggestion", `/${Config.Commands.call}`, "Log a call in the EMS Call Log — nature | outcome | hospital | notes", [
      { name: "nature", help: "e.g. cardiac arrest, fall, gunshot" },
      { name: "| outcome", help: "e.g. treated, transported, refused — treated on scene if left out" },
      { name: "| hospital", help: "When transported, e.g. pillbox" },
      { name: "| notes", help: "Optional" },
    ]);
  }
}, 1000);
