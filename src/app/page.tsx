import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarOff,
  ClipboardCheck,
  GraduationCap,
  MessageSquare,
  Radio,
  Shirt,
  Stethoscope,
  UserPlus,
  Users,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/home/SiteHeader";
import { StarOfLife } from "@/components/roster/StarOfLife";
import { RosterBannerStrip } from "@/components/roster/RosterBannerStrip";
import { getHomeSummary } from "@/lib/roster";
import type { RosterViewer } from "@/lib/roster-shared";

export const metadata: Metadata = {
  title: { absolute: "Los Santos EMS — Nexus Universe" },
  description:
    "Los Santos Emergency Medical Services on Nexus Universe RP — apply to join, request leave, join a department, and find the SOP, radio codes and training.",
};

export const dynamic = "force-dynamic";

const SIGNED_OUT: RosterViewer = {
  signedIn: false,
  name: null,
  memberId: null,
  fullAccess: false,
  canClock: false,
  hasPanel: false,
};

interface Destination {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Who it is for — shown as a tag, so nobody opens a form they cannot use. */
  audience: string;
  cta: string;
}

const APPLICATIONS: Destination[] = [
  {
    href: "/onboarding",
    title: "Join EMS",
    description:
      "Apply to become a Los Santos medic. HR reviews every application and sends the decision to you on Discord.",
    icon: UserPlus,
    audience: "Open to everyone",
    cta: "Start application",
  },
  {
    href: "/departments",
    title: "Department Application",
    description:
      "Already on the roster? Apply to a specialist department and follow your application through review.",
    icon: Building2,
    audience: "EMS members · Discord sign-in",
    cta: "Browse departments",
  },
  {
    href: "/loa",
    title: "Leave of Absence",
    description:
      "Going away for a while? Request a Leave of Absence with your dates and reason, so command knows before you go.",
    icon: CalendarOff,
    audience: "EMS members",
    cta: "Request leave",
  },
];

const MEMBER_SERVICES: Destination[] = [
  {
    href: "/roster",
    title: "Personnel Roster",
    description: "Every member by section and rank, with who is on duty right now.",
    icon: Users,
    audience: "Public",
    cta: "View roster",
  },
  {
    href: "/cadet",
    title: "Trainee Portal",
    description: "Your field-training record, trainer remarks and progress toward your next rank.",
    icon: ClipboardCheck,
    audience: "Trainees · Discord sign-in",
    cta: "Open portal",
  },
  {
    href: "/training",
    title: "Training Portal",
    description: "Course material and training resources for serving medics.",
    icon: GraduationCap,
    audience: "EMS members · Discord sign-in",
    cta: "Start training",
  },
];

const RESOURCES: Destination[] = [
  {
    href: "/sop",
    title: "Standard Operating Procedures",
    description: "How the department works, from scene conduct to chain of command.",
    icon: BookOpen,
    audience: "EMS members · Discord sign-in",
    cta: "Read the SOP",
  },
  {
    href: "/radio-codes",
    title: "Radio Codes",
    description: "10-codes, 11-codes and response codes used on the radio.",
    icon: Radio,
    audience: "Public",
    cta: "View codes",
  },
  {
    href: "/uniform",
    title: "Uniform Guide",
    description: "Standard uniform components and rank colours for every medic.",
    icon: Shirt,
    audience: "Public",
    cta: "View guide",
  },
];

const JOIN_STEPS = [
  { title: "Apply", text: "Fill in the short application with your character and Discord details.", icon: UserPlus },
  { title: "Review", text: "HR reviews your application and checks your details.", icon: ClipboardCheck },
  { title: "Decision", text: "The bot sends you the result on Discord, with the server invite if you are accepted.", icon: MessageSquare },
  { title: "Field training", text: "You join as a trainee and a Field Training Officer works with you on shift.", icon: Stethoscope },
];

export default async function Home() {
  const summary = await getHomeSummary();
  const viewer = summary?.viewer ?? SIGNED_OUT;

  return (
    <div className="flex min-h-screen flex-col bg-[#08080c]">
      <SiteHeader viewer={viewer} />
      {summary?.banner && <RosterBannerStrip banner={summary.banner} />}

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-white/[0.06]">
          <div className="pointer-events-none absolute -right-40 -top-40 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle,rgba(220,38,38,0.20),rgba(220,38,38,0.05)_45%,transparent_70%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.25fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-red-600/30 bg-red-600/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                Nexus Universe RP
              </p>
              <h1 className="mt-6 font-[family-name:var(--font-oswald)] text-4xl font-bold uppercase leading-[1.05] tracking-wide text-white sm:text-6xl">
                Los Santos
                <br />
                <span className="text-red-500">Emergency Medical</span> Services
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-gray-400 sm:text-lg">
                First on scene when it matters most. Apply to join the department, manage your membership, and find
                everything a Los Santos medic needs, all in one place.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-2 rounded-md bg-red-600 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white shadow-lg shadow-red-900/30 transition-colors hover:bg-red-700"
                >
                  Apply to Join
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="#applications"
                  className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-semibold uppercase tracking-wider text-gray-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                >
                  All Applications
                </Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              <div className="rounded-2xl border border-white/[0.07] bg-[#0e0e14]/80 p-8 shadow-2xl shadow-black/50 backdrop-blur">
                <StarOfLife className="mx-auto h-32 w-32 drop-shadow-[0_0_32px_rgba(220,38,38,0.5)]" />
                {summary && (
                  <dl className="mt-8 grid grid-cols-3 divide-x divide-white/[0.07] border-t border-white/[0.07] pt-6 text-center">
                    <Stat label="Personnel" value={summary.stats.personnel} />
                    <Stat label="On duty" value={summary.stats.onDuty} live />
                    <Stat label="Departments" value={summary.stats.departments} />
                  </dl>
                )}
              </div>
            </div>
          </div>
        </section>

        <Section
          id="applications"
          eyebrow="Applications"
          title="Apply, request and enrol"
          intro="Every form the department runs. Each one goes straight to the right team, and you hear back on Discord."
        >
          <div className="grid gap-5 md:grid-cols-3">
            {APPLICATIONS.map((item) => (
              <DestinationCard key={item.href} item={item} featured />
            ))}
          </div>
        </Section>

        {/* How joining works */}
        <section className="border-y border-white/[0.06] bg-[#0b0b10]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
            <SectionHeading eyebrow="Becoming a medic" title="How joining works" />
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {JOIN_STEPS.map((step, i) => (
                <li key={step.title} className="relative rounded-xl border border-white/[0.06] bg-[#101016] p-6">
                  <div className="flex items-center justify-between">
                    <step.icon className="h-6 w-6 text-red-500" />
                    <span className="font-[family-name:var(--font-oswald)] text-3xl font-bold text-white/10">
                      0{i + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 font-[family-name:var(--font-oswald)] text-lg font-semibold uppercase tracking-wide text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <Section
          id="members"
          eyebrow="For members"
          title="Member services"
          intro="Sign in with the Discord account linked to your roster entry to open the member-only tools."
        >
          <div className="grid gap-5 md:grid-cols-3">
            {MEMBER_SERVICES.map((item) => (
              <DestinationCard key={item.href} item={item} />
            ))}
          </div>
        </Section>

        <Section
          id="resources"
          eyebrow="Reference"
          title="Resources"
          intro="The procedures, codes and standards every medic works to."
          className="pt-0 md:pt-0"
        >
          <div className="grid gap-5 md:grid-cols-3">
            {RESOURCES.map((item) => (
              <DestinationCard key={item.href} item={item} />
            ))}
          </div>
        </Section>

        {/* Closing call to action */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
          <div className="relative overflow-hidden rounded-2xl border border-red-600/25 bg-gradient-to-br from-red-600/15 via-[#120a0c] to-[#0b0b10] px-6 py-12 text-center sm:px-12">
            <h2 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              Ready to answer the call?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-gray-400">
              Applications are open. It takes a couple of minutes, and HR replies on Discord.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 rounded-md bg-red-600 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-red-700"
              >
                Apply to Join
                <ArrowRight className="h-4 w-4" />
              </Link>
              {viewer.hasPanel && (
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-6 py-3 text-sm font-semibold uppercase tracking-wider text-gray-200 transition-colors hover:bg-white/[0.08]"
                >
                  Staff Panel
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Stat({ label, value, live }: { label: string; value: number; live?: boolean }) {
  return (
    <div className="px-2">
      <dd className="flex items-center justify-center gap-1.5 font-[family-name:var(--font-oswald)] text-3xl font-bold text-white">
        {live && <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
        {value}
      </dd>
      <dt className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">{label}</dt>
    </div>
  );
}

function SectionHeading({ eyebrow, title, intro }: { eyebrow: string; title: string; intro?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-500">{eyebrow}</p>
      <h2 className="mt-3 font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
        {title}
      </h2>
      {intro && <p className="mt-3 text-gray-400">{intro}</p>}
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  intro,
  className = "",
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 md:py-20 ${className}`}>
      <SectionHeading eyebrow={eyebrow} title={title} intro={intro} />
      <div className="mt-10">{children}</div>
    </section>
  );
}

function DestinationCard({ item, featured }: { item: Destination; featured?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`group flex flex-col rounded-xl border p-6 transition-all hover:-translate-y-0.5 ${
        featured
          ? "border-white/[0.08] bg-gradient-to-b from-[#131319] to-[#0e0e14] hover:border-red-600/50 hover:shadow-xl hover:shadow-red-950/30"
          : "border-white/[0.06] bg-[#0e0e14] hover:border-white/15"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-lg ${
            featured ? "bg-red-600/15 text-red-500" : "bg-white/[0.05] text-gray-300"
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          {item.audience}
        </span>
      </div>
      <h3 className="mt-5 font-[family-name:var(--font-oswald)] text-xl font-semibold uppercase tracking-wide text-white">
        {item.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-400">{item.description}</p>
      <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-red-400 transition-colors group-hover:text-red-300">
        {item.cta}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
