export function customId(command, action, payload = "") {
    const id = `${command}:${action}:${payload}`;
    if (id.length > 100)
        throw new Error(`custom id too long: ${id}`);
    return id;
}
export function parseCustomId(id) {
    const [command, action = "", ...rest] = id.split(":");
    return { command, action, payload: rest.join(":") };
}
//# sourceMappingURL=command.js.map