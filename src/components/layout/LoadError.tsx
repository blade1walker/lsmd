/** A public page whose data could not be loaded. What went wrong is in the server log. */
export function LoadError({ what }: { what: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] p-8 text-white">
      <h1 className="mb-4 font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-red-500">
        Something went wrong
      </h1>
      <p className="max-w-md text-center text-gray-400">{what} could not be loaded right now. Please try again in a minute.</p>
    </div>
  );
}
