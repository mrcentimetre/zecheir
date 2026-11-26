import { Suspense } from "react";
import { Loading } from "@/components/ui";
import SettingsScreen from "./screen";

export default function Page() {
  return (
    <Suspense fallback={<Loading error={null} />}>
      <SettingsScreen />
    </Suspense>
  );
}
