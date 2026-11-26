import { Suspense } from "react";
import { Loading } from "@/components/ui";
import Guardian from "./screen";

export default function Page() {
  return (
    <Suspense fallback={<Loading error={null} />}>
      <Guardian />
    </Suspense>
  );
}
