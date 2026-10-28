import { redirect } from "next/navigation";

/**
 * FTP review moved into the departments console — FTP is now one department
 * among many, and the old FTP requests were carried across to it. This
 * redirect keeps existing bookmarks working.
 */
export default function AdminFTPRedirectPage() {
  redirect("/admin/departments");
}
