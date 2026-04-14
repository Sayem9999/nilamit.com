import StarMapVisualization from "@/components/StarMap";
import { getTrustGraphData } from "@/actions/social";

export default async function StarMapPage() {
  const data = await getTrustGraphData();

  return (
    <main className="w-screen h-screen m-0 p-0 overflow-hidden bg-slate-900">
      <StarMapVisualization initialData={data} />
    </main>
  );
}
