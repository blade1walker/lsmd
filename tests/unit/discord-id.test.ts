import { test } from "node:test";
import assert from "node:assert/strict";
import { isDiscordId, parseDiscordId, safeMentions } from "@/lib/discord/id";

const ID = "718689330071208078";

test("parseDiscordId accepts an ID, with spaces or as a pasted mention", () => {
  assert.equal(parseDiscordId(ID), ID);
  assert.equal(parseDiscordId(`  ${ID} `), ID);
  assert.equal(parseDiscordId(`<@${ID}>`), ID);
  assert.equal(parseDiscordId(`<@!${ID}>`), ID);
});

test("parseDiscordId refuses usernames and anything else", () => {
  for (const bad of ["fauzan_2205", "@fauzan_2205", "<@fauzan_2205>", "12345", "", null, undefined, 718689330071208000]) {
    assert.equal(parseDiscordId(bad), null);
  }
  assert.equal(isDiscordId("fauzan_2205"), false);
});

test("safeMentions leaves real user and role mentions alone", () => {
  assert.equal(safeMentions(`hi <@${ID}>`), `hi <@${ID}>`);
  assert.equal(safeMentions(`hi <@!${ID}>`), `hi <@!${ID}>`);
  assert.equal(safeMentions(`hi <@&${ID}>`), `hi <@&${ID}>`);
});

test("safeMentions makes a bad ID readable and drops an empty one", () => {
  assert.equal(
    safeMentions("enrolled as EMR — <@fauzan_2205> (SID: 3714)"),
    "enrolled as EMR — @fauzan_2205 (SID: 3714)"
  );
  assert.equal(safeMentions("Congratulations <@>!"), "Congratulations !");
});
