import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CalendarOff,
  ClipboardCheck,
  MessageSquare,
  Radio,
  Shirt,
  Stethoscope,
  UserPlus,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { SiteHeader } from "@/components/home/SiteHeader";
import { BrandLogo } from "@/components/SiteContentProvider";
import { SiteNotices } from "@/components/home/SiteNotices";
import { RosterBannerStrip } from "@/components/roster/RosterBannerStrip";
import { CityStatusCard } from "@/components/CityStatusCard";
import { TrainingCards } from "@/components/home/TrainingCards";
import { getHomeSummary } from "@/lib/roster";
import type { RosterViewer } from "@/lib/roster-shared";
import { flagOf, textOf } from "@/lib/site-content";
import { getSiteContentState } from "@/lib/site-content-server";

export async function generateMetadata(): Promise<Metadata> {
  const { values } = await getSiteContentState();
  return {
    title: { absolute: `${textOf(values, "brand.name")} — ${textOf(values, "brand.community")}` },
    description:
      "Los Santos Emergency Medical Services on Nexus Universe RP — apply to join, request leave, join a department, and find the SOP, radio codes and training.",
  };
}

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
  /** Boss Menu keys: `<content>.title` and `<content>.description`. */
  content: string;
  icon: LucideIcon;
  /** Who it is for — shown as a tag, so nobody opens a form they cannot use. */
  audience: string;
  cta: string;
}

const APPLICATIONS: Destination[] = [
  {
    href: "/onboarding",
    content: "home.applications.join",
    icon: UserPlus,
    audience: "Open to everyone",
    cta: "Start application",
  },
  {
    href: "/departments",
    content: "home.applications.department",
    icon: Building2,
    audience: "EMS members · Discord sign-in",
    cta: "Browse departments",
  },
  {
    href: "/loa",
    content: "home.applications.loa",
    icon: CalendarOff,
    audience: "EMS members",
    cta: "Request leave",
  },
];

const RESOURCES: Destination[] = [
  {
    href: "/sop",
    content: "home.resources.sop",
    icon: BookOpen,
    audience: "EMS members · Discord sign-in",
    cta: "Read the SOP",
  },
  {
    href: "/radio-codes",
    content: "home.resources.radio",
    icon: Radio,
    audience: "Public",
    cta: "View codes",
  },
  {
    href: "/uniform",
    content: "home.resources.uniform",
    icon: Shirt,
    audience: "Public",
    cta: "View guide",
  },
];

/** Boss Menu keys: `<content>.title` and `<content>.text`. */
const JOIN_STEPS = [
  { content: "home.joining.step1", icon: UserPlus },
  { content: "home.joining.step2", icon: ClipboardCheck },
  { content: "home.joining.step3", icon: MessageSquare },
  { content: "home.joining.step4", icon: Stethoscope },
];

export default async function Home() {
  const [summary, { values }] = await Promise.all([getHomeSummary(), getSiteContentState()]);
  const viewer = summary?.viewer ?? SIGNED_OUT;
  const text = (key: string) => textOf(values, key);
  const flag = (key: string) => flagOf(values, key);
  const heroImage = text("home.hero.image");
  const showApplications = flag("home.applications.show");
  const showTraining = flag("home.applications.showTraining");

  return (
    <div className="flex min-h-screen flex-col bg-[#08080c]">
      <SiteHeader viewer={viewer} />
      {summary?.banner && <RosterBannerStrip banner={summary.banner} />}

      <main className="flex-1">
        <SiteNotices />

        {/* Hero */}
        <section className="relative overflow-hidden border-b border-white/[0.06]">
          {heroImage && (
            // An uploaded picture of unknown size, laid behind the banner.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroImage} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20" />
          )}
          <div className="pointer-events-none absolute -right-40 -top-40 h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle,rgba(220,38,38,0.20),rgba(220,38,38,0.05)_45%,transparent_70%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.25fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-red-600/30 bg-red-600/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-red-400">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {text("home.hero.badge")}
              </p>
              <h1 className="mt-6 font-[family-name:var(--font-oswald)] text-4xl font-bold uppercase leading-[1.05] tracking-wide text-white sm:text-6xl">
                {text("home.hero.titleTop")}
                <br />
                <span className="text-red-500">{text("home.hero.titleAccent")}</span> {text("home.hero.titleEnd")}
              </h1>
              <p className="mt-6 max-w-xl whitespace-pre-line text-base leading-relaxed text-gray-400 sm:text-lg">
                {text("home.hero.intro")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-2 rounded-md bg-red-600 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white shadow-lg shadow-red-900/30 transition-colors hover:bg-red-700"
                >
                  {text("home.hero.primaryCta")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {showApplications && (
                  <Link
                    href="#applications"
                    className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-semibold uppercase tracking-wider text-gray-200 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    {text("home.hero.secondaryCta")}
                  </Link>
                )}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md">
              <div className="rounded-2xl border border-white/[0.07] bg-[#0e0e14]/80 p-8 shadow-2xl shadow-black/50 backdrop-blur">
                <BrandLogo className="mx-auto h-32 w-32 drop-shadow-[0_0_32px_rgba(220,38,38,0.5)]" />
                {summary && flag("home.hero.showStats") && (
                  <dl className="mt-8 grid grid-cols-3 divide-x divide-white/[0.07] border-t border-white/[0.07] pt-6 text-center">
                    <Stat label="Personnel" value={summary.stats.personnel} />
                    <Stat label="On duty" value={summary.stats.onDuty} live />
                    <Stat label="Departments" value={summary.stats.departments} />
                  </dl>
                )}
                {flag("home.hero.showCity") && <CityStatusCard variant="compact" />}
              </div>
            </div>
          </div>
        </section>

        {showApplications && (
          <Section
            id="applications"
            eyebrow={text("home.applications.eyebrow")}
            title={text("home.applications.title")}
            intro={text("home.applications.intro")}
          >
            <div className={`grid gap-5 md:grid-cols-2 ${showTraining ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
              {APPLICATIONS.map((item) => (
                <DestinationCard key={item.href} item={item} text={text} featured />
              ))}
              {showTraining && <TrainingCards />}
            </div>
          </Section>
        )}

        {/* How joining works */}
        {flag("home.joining.show") && (
          <section className="border-y border-white/[0.06] bg-[#0b0b10]">
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
              <SectionHeading eyebrow={text("home.joining.eyebrow")} title={text("home.joining.title")} />
              <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {JOIN_STEPS.map((step, i) => (
                  <li key={step.content} className="relative rounded-xl border border-white/[0.06] bg-[#101016] p-6">
                    <div className="flex items-center justify-between">
                      <step.icon className="h-6 w-6 text-red-500" />
                      <span aria-hidden="true" className="font-[family-name:var(--font-oswald)] text-3xl font-bold text-white/10">
                        0{i + 1}
                      </span>
                    </div>
                    <h3 className="mt-4 font-[family-name:var(--font-oswald)] text-lg font-semibold uppercase tracking-wide text-white">
                      {text(`${step.content}.title`)}
                    </h3>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-400">{text(`${step.content}.text`)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        {flag("home.resources.show") && (
          <Section
            id="resources"
            eyebrow={text("home.resources.eyebrow")}
            title={text("home.resources.title")}
            intro={text("home.resources.intro")}
          >
            <div className="grid gap-5 md:grid-cols-3">
              {RESOURCES.map((item) => (
                <DestinationCard key={item.href} item={item} text={text} />
              ))}
            </div>
          </Section>
        )}

        {/* Closing call to action */}
        {flag("home.cta.show") && (
          <section className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6">
            <div className="relative overflow-hidden rounded-2xl border border-red-600/25 bg-gradient-to-br from-red-600/15 via-[#120a0c] to-[#0b0b10] px-6 py-12 text-center sm:px-12">
              <h2 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
                {text("home.cta.title")}
              </h2>
              <p className="mx-auto mt-3 max-w-xl whitespace-pre-line text-gray-400">{text("home.cta.text")}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-2 rounded-md bg-red-600 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-white transition-colors hover:bg-red-700"
                >
                  {text("home.cta.button")}
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
        )}
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

function DestinationCard({
  item,
  text,
  featured,
}: {
  item: Destination;
  text: (key: string) => string;
  featured?: boolean;
}) {
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
        {text(`${item.content}.title`)}
      </h3>
      <p className="mt-2 flex-1 whitespace-pre-line text-sm leading-relaxed text-gray-400">
        {text(`${item.content}.description`)}
      </p>
      <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-red-400 transition-colors group-hover:text-red-300">
        {item.cta}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
