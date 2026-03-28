import ConsumerPortalClient from "@/components/consumer-portal-client";

export default function HomePage() {
  return (
    <main
      className="relative min-h-screen bg-slate-50 px-4 py-10"
      role="main"
      aria-label="Universal Bridge - Emergency Intake Form"
    >
      <a
        href="#intake-form"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to intake form
      </a>

      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <section className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-600">
              Universal Bridge
            </p>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                How can we help?
              </h1>
              <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                Describe your situation using text, upload an image, or record a
                voice message. The form loads the text workflow first and brings
                in media tools only when you need them.
              </p>
            </div>
          </div>

          <div id="intake-form" className="w-full">
            <ConsumerPortalClient />
          </div>
        </section>
      </div>

      <footer className="absolute right-4 bottom-4 text-xs text-slate-400">
        <a
          href="/operator"
          className="underline transition-colors hover:text-blue-500"
          aria-label="Operator access login"
        >
          Operator Access
        </a>
      </footer>
    </main>
  );
}
