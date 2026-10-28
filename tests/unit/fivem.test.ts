import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanServerName, identifierMap, parseJoinCode, parseServerAddress, steamHex } from "@/lib/fivem";
import { buildMatcher, parseHeartbeat, parsePlayers } from "@/lib/fivem-server";

test("server addresses get a default port and lose any path", () => {
  assert.deepEqual(parseServerAddress("203.0.113.10"), { base: "http://203.0.113.10:30120" });
  assert.deepEqual(parseServerAddress("http://play.example.com:30121/players.json"), { base: "http://play.example.com:30121" });
  assert.ok("error" in (parseServerAddress("cfx.re/join/abc123") ?? {}));
  assert.equal(parseServerAddress("  "), null);
});

test("join codes are read from a code or a link", () => {
  assert.deepEqual(parseJoinCode("https://cfx.re/join/AbC123"), { code: "abc123" });
  assert.ok("error" in (parseJoinCode("!!") ?? {}));
});

test("Steam IDs match whichever form the roster stored", () => {
  assert.equal(steamHex("76561197960309709"), "11000010000abcd");
  assert.equal(steamHex("steam:11000010000ABCD"), "11000010000abcd");
  assert.equal(steamHex("not-a-steam-id"), null);
});

test("colour codes are stripped from server names", () => {
  assert.equal(cleanServerName("^1Nexus ^7Universe ~r~RP"), "Nexus Universe RP");
  assert.deepEqual(identifierMap(["discord:123", "steam:ABC", "bad"]), { discord: "123", steam: "abc" });
});

test("players match the roster by Discord, then Steam, then (optionally) name", () => {
  const members = [
    { id: "m1", name: "John Doe", callSign: "912", rank: "EMT", discordId: "111111111111111111", steamId: null },
    { id: "m2", name: "Jane Smith", callSign: "913", rank: "EMT", discordId: null, steamId: "76561197960309709" },
    { id: "m3", name: "Sam Twin", callSign: null, rank: "EMT", discordId: null, steamId: null },
    { id: "m4", name: "Sam Twin", callSign: null, rank: "EMR", discordId: null, steamId: null },
  ];
  const strict = buildMatcher(members, false);
  assert.equal(strict({ identifiers: ["discord:111111111111111111"], name: "x", characterName: null })?.member.id, "m1");
  assert.equal(strict({ identifiers: ["steam:11000010000abcd"], name: "x", characterName: null })?.via, "steam");
  assert.equal(strict({ identifiers: [], name: "Jane Smith", characterName: null }), null);

  const loose = buildMatcher(members, true);
  assert.equal(loose({ identifiers: [], name: "[913] Jane Smith", characterName: null })?.member.id, "m2");
  // A name two members share matches neither.
  assert.equal(loose({ identifiers: [], name: "Sam Twin", characterName: null }), null);
});

test("heartbeats tolerate Lua's empty table and drop bad players", () => {
  const empty = parseHeartbeat({ players: {} });
  assert.ok(!("error" in empty) && empty.players.length === 0);
  assert.ok("error" in parseHeartbeat({ players: "nope" }));
  const players = parsePlayers([{ id: 1, name: "A" }, { id: 1, name: "Dup" }, { name: "No id" }, { id: 2, name: "B", ems: 1, duty: "true" }]);
  assert.equal(players.length, 2);
  assert.equal(players[1].isEms, true);
  assert.equal(players[1].onDuty, true);
});
