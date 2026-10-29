import Link from "next/link";

/** The plain member-facing frame, matching the departments and LOA pages. */
export function TestShell({ children, back = "/" }: { children: React.ReactNode; back?: string }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-[#1e1e1e] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href={back} className="-mx-2 rounded-md px-2 py-2.5 text-sm text-gray-400 hover:text-white">
            ← {back === "/" ? "Back to Home" : "All tests"}
          </Link>
          <span className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white">EMS</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">{children}</main>
    </div>
  );
}
