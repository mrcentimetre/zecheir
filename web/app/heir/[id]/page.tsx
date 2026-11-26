import { Suspense } from "react";
import { Loading } from "@/components/ui";
import Heir from "./screen";

export default function Page() {
  return (
    <Suspense fallback={<Loading error={null} />}>
      <Heir />
    </Suspense>
  );
}
