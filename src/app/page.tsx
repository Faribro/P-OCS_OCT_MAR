'use client';

import dynamic from 'next/dynamic';

const GISDashboard = dynamic(() => import('@/components/GISDashboard'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 min-h-screen bg-[#050507] text-white flex flex-col items-center justify-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
      <p className="text-zinc-400 font-medium">Initializing Command Center Engine...</p>
    </div>
  )
});

export default function Home() {
  return (
    <main className="flex-1 flex flex-col min-h-screen">
      <GISDashboard />
    </main>
  );
}
