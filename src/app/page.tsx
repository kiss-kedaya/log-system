import { LogViewer } from "@/components/LogViewer";

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">日志系统</h1>
        <div className="grid grid-cols-1 gap-6">
          <LogViewer />
        </div>
      </div>
    </main>
  );
}
