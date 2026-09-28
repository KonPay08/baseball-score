import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Prototype</h1>
        <p className="mt-2 text-gray-500">
          PROJECT.md を更新して実装を開始する。
        </p>
      </div>
    </main>
  )
}
