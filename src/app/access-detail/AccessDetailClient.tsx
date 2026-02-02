import { Suspense } from "react";
import AccessDetailClient from "./AccessDetailClient";

export default function Page() {
  return (
      <Suspense fallback={<div>Loading...</div>}>
        <AccessDetailClient />
      </Suspense>
  );
}

export const dynamic = "force-dynamic";