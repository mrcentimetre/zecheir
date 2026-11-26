import { Suspense } from "react";
import { Loading } from "@/components/ui";
import VaultHome from "./screen";

export default function Page() {
  return (
    <Suspense fallback={<Loading error={null} />}>
      <VaultHome />
    </Suspense>
  );
}
