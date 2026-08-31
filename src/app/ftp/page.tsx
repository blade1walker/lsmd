import { redirect } from "next/navigation";

/**
 * The Field Training Program form became one department among many. FTP keeps
 * its own department (see scripts/migrate-ftp-departments.ts), so this URL —
 * which is linked from Discord and bookmarked — lands on the department list
 * rather than 404ing.
 */
export default function FTPRedirectPage() {
  redirect("/departments");
}
