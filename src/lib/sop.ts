/**
 * Id used for the synthetic document served from the legacy SopContent row
 * when the SopDocument table does not exist yet.
 *
 * It is not a real row, so it cannot be edited or deleted — the write routes
 * reject it with an explanation rather than failing with a foreign key error.
 */
export const LEGACY_DOC_ID = "__legacy_sop__";
