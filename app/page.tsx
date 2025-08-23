import { RetrospectiveBoard } from "@/components/retrospective-board"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">Team Retrospective</h1>
          <p className="text-slate-600 text-lg">Reflect, improve, and grow together as a team</p>
        </header>
        <RetrospectiveBoard />
      </div>
    </main>
  )
}
