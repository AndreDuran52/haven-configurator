import { buildInfo } from './buildInfo.ts'

// H0b placeholder. Replaced by HavenStoreProvider + HavenLayout from H2.
export default function App() {
  return (
    <main className="safe-area flex min-h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          Haven <span className="text-accent">Configurator</span>
        </h1>
        <p className="text-ink-muted">Planned — nothing built yet</p>
        <p className="font-mono text-xs text-ink-muted" data-testid="commit">
          {buildInfo.commit}
        </p>
      </div>
    </main>
  )
}
