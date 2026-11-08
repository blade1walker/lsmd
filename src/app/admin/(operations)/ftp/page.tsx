import { redirect } from "next/navigation";

/**
 * FTP review moved into the departments console — FTP is now one department
 * among many (see scripts/migrate-ftp-departments.ts, which carries the old
 * FTPRequest rows across). This redirect keeps existing bookmarks working.
 */
export default function AdminFTPRedirectPage() {
  redirect("/admin/departments");
}
