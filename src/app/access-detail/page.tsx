import { Suspense } from "react";
import AccessDetailPage from "@/components/AccessDetailPage";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading access details...</div>}>
      <AccessDetailPage />
    </Suspense>
  );
}
