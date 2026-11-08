import type { ComponentType } from "react";
import {
  Activity,
  Ambulance,
  Award,
  BadgeCheck,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarOff,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Crown,
  Download,
  FileText,
  Gamepad2,
  GitCommit,
  GraduationCap,
  Hash,
  Heart,
  History,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  Megaphone,
  MessageSquare,
  Radio,
  ScrollText,
  Shield,
  ShieldCheck,
  Siren,
  SlidersHorizontal,
  Stethoscope,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  Mail,
} from "lucide-react";
import {
  DEPARTMENT_SECTION_PERMISSIONS,
  EXPORT_SECTION_PERMISSIONS,
  SHIFT_SECTION_PERMISSIONS,
  MEDICAL_SECTION_PERMISSIONS,
  MEDICAL_ADMIN_PERMISSIONS,
  CALL_SECTION_PERMISSIONS,
  INTERVIEW_SECTION_PERMISSIONS,
  BOT_PERMISSION_SECTION_PERMISSIONS,
  FIVEM_SECTION_PERMISSIONS,
  ACTIVITY_SECTION_PERMISSIONS,
  DUTY_BOARD_PERMISSIONS,
  TEST_SECTION_PERMISSIONS,
  RANK_PERMISSIONS,
  LOA_SECTION_PERMISSIONS,
  CONTENT_SECTION_PERMISSIONS,
} from "@/lib/constants";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Mirrors the check on the matching API route; an array means any one of them is enough. */
  permission: string | readonly string[];
};

export type NavSection = { id: string; label: string; items: NavItem[] };

/**
 * The admin sidebar, by category. Each category is also a route group folder
 * under src/app/admin/(<id>)/, so the file tree reads the same as the menu.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: "overview",
    label: "Overview",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "roster.view" },
      { href: "/admin/duty-board", label: "Duty Board", icon: Siren, permission: [...DUTY_BOARD_PERMISSIONS.view] },
      { href: "/admin/fivem", label: "City Link", icon: Gamepad2, permission: FIVEM_SECTION_PERMISSIONS },
      { href: "/admin/activity", label: "Activity", icon: Activity, permission: ACTIVITY_SECTION_PERMISSIONS },
    ],
  },
  {
    id: "personnel",
    label: "Personnel",
    items: [
      { href: "/admin/roster", label: "Roster", icon: Users, permission: "roster.view" },
      { href: "/admin/callsigns", label: "Call Signs", icon: Hash, permission: "roster.edit" },
      { href: "/admin/ranks", label: "Ranks & Insignia", icon: Award, permission: [...RANK_PERMISSIONS.manage] },
      { href: "/admin/roster-banner", label: "Roster Banner", icon: Megaphone, permission: "roster.announce" },
      { href: "/admin/loa", label: "Leave (LOA)", icon: CalendarOff, permission: LOA_SECTION_PERMISSIONS },
      { href: "/admin/hr", label: "HR", icon: Heart, permission: "hr.view" },
      { href: "/admin/restore", label: "Restore Deleted", icon: Trash2, permission: "roster.delete" },
    ],
  },
  {
    id: "career",
    label: "Recruitment & Career",
    items: [
      { href: "/admin/onboarding", label: "Onboarding", icon: UserPlus, permission: "onboarding.view" },
      { href: "/admin/recruit", label: "Recruit", icon: Mail, permission: "onboarding.view" },
      { href: "/admin/trainees", label: "Trainees", icon: GraduationCap, permission: "trainees.view" },
      { href: "/admin/training", label: "Training", icon: BookOpen, permission: "training.view" },
      { href: "/admin/signoffs", label: "Sign-offs", icon: BadgeCheck, permission: "training.signoff.manage" },
      { href: "/admin/tests", label: "Tests & Quizzes", icon: ClipboardList, permission: TEST_SECTION_PERMISSIONS },
      { href: "/admin/interviews", label: "Promotions & Interviews", icon: ClipboardCheck, permission: INTERVIEW_SECTION_PERMISSIONS },
      { href: "/admin/promotions", label: "Promotion History", icon: TrendingUp, permission: "promotions.view" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { href: "/admin/departments", label: "Departments", icon: Building2, permission: DEPARTMENT_SECTION_PERMISSIONS },
      { href: "/admin/shifts", label: "Shifts", icon: CalendarClock, permission: SHIFT_SECTION_PERMISSIONS },
      { href: "/admin/clock-log", label: "Clock Log", icon: Clock, permission: "clock.view" },
      { href: "/admin/calls", label: "Call Log", icon: Ambulance, permission: CALL_SECTION_PERMISSIONS },
      { href: "/admin/medical", label: "Medical Docs", icon: Stethoscope, permission: MEDICAL_SECTION_PERMISSIONS },
      { href: "/admin/medical/forms", label: "Form Builder", icon: LayoutTemplate, permission: MEDICAL_ADMIN_PERMISSIONS },
    ],
  },
  {
    id: "content",
    label: "Content & Docs",
    items: [
      { href: "/admin/boss", label: "Boss Menu", icon: Crown, permission: CONTENT_SECTION_PERMISSIONS },
      { href: "/admin/sop", label: "SOP", icon: FileText, permission: "sop.edit" },
      { href: "/admin/radio-codes", label: "Radio Codes", icon: Radio, permission: "radio.edit" },
      { href: "/admin/templates", label: "Templates", icon: Layers, permission: "templates" },
    ],
  },
  {
    id: "communications",
    label: "Communications",
    items: [
      { href: "/admin/notifications", label: "Notifications", icon: Bell, permission: "notifications" },
      { href: "/admin/notification-settings", label: "Notification Settings", icon: SlidersHorizontal, permission: "notifications" },
      { href: "/admin/messaging", label: "Bot Messaging", icon: MessageSquare, permission: ["notifications", ...BOT_PERMISSION_SECTION_PERMISSIONS] },
      { href: "/admin/bot-permissions", label: "Bot Permissions", icon: ShieldCheck, permission: BOT_PERMISSION_SECTION_PERMISSIONS },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { href: "/admin/roles", label: "Roles & Access", icon: Shield, permission: "roles.manage" },
      { href: "/admin/audit", label: "Audit Log", icon: ScrollText, permission: "audit.view" },
      { href: "/admin/export", label: "Export & Backup", icon: Download, permission: EXPORT_SECTION_PERMISSIONS },
      { href: "/admin/deployment", label: "Deployment", icon: GitCommit, permission: "audit.view" },
      { href: "/admin/changelog", label: "Changelog", icon: History, permission: "changelog.view" },
    ],
  },
];

/** The sections and items this user may open; empty sections are dropped. */
export function visibleSections(isSuperAdmin: boolean, permissions: readonly string[]): NavSection[] {
  if (isSuperAdmin) return NAV_SECTIONS;
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      (typeof item.permission === "string" ? [item.permission] : item.permission).some((p) => permissions.includes(p))
    ),
  })).filter((section) => section.items.length > 0);
}

/**
 * The item a path belongs to: the longest href that is the path or a parent of
 * it, so /admin/roster/abc lights up Roster and /admin/medical/forms lights up
 * Form Builder rather than Medical Docs.
 */
export function activeHref(pathname: string, sections: NavSection[]): string | null {
  let best: string | null = null;
  for (const { items } of sections) {
    for (const { href } of items) {
      if ((pathname === href || pathname.startsWith(href + "/")) && href.length > (best?.length ?? 0)) best = href;
    }
  }
  return best;
}
