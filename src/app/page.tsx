import { prisma } from "@/lib/prisma";
import { PublicPageClient } from "@/components/PublicPageClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const [sections, departments] = await Promise.all([
      prisma.section.findMany({
        include: {
          members: {
            orderBy: { order: "asc" },
            // The leave a member is currently on, so the roster's LOA section can
            // show when they are due back.
            include: {
              loas: {
                where: { status: { in: ["Approved", "Active"] } },
                orderBy: { endDate: "desc" },
                take: 1,
                select: { endDate: true },
              },
              // Drives the roster's per-department tick columns.
              departmentMemberships: { select: { departmentId: true, role: true } },
            },
          },
        },
        orderBy: { order: "asc" },
      }),
      prisma.departmentTemplate.findMany({
        orderBy: { order: "asc" },
        select: { id: true, name: true, tag: true, color: true },
      }),
    ]);

    return <PublicPageClient sections={sections as any} departments={departments} />;
  } catch (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white p-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold text-red-500 mb-4">
          Database Connection Failed
        </h1>
        <p className="text-gray-400 text-center max-w-md mb-6">
          The application cannot connect to the database. Please make sure
          <code className="bg-white/10 px-2 py-1 rounded mx-1">DATABASE_URL</code>
          is set in your Vercel environment variables.
        </p>
        <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-sm text-gray-500 max-w-lg w-full">
          <p className="font-semibold text-gray-300 mb-2">Steps to fix:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to vercel.com → Your project → Settings → Environment Variables</li>
            <li>Add <code className="bg-white/10 px-1 rounded">DATABASE_URL</code> with your PostgreSQL connection string</li>
            <li>Redeploy the project</li>
          </ol>
        </div>
      </div>
    );
  }
}
