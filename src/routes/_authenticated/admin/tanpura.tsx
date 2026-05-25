import { createFileRoute } from "@tanstack/react-router";
import { SoundLibraryManager } from "@/components/admin/SoundLibraryManager";

export const Route = createFileRoute("/_authenticated/admin/tanpura")({
  head: () => ({ meta: [{ title: "Tanpura — Admin" }] }),
  component: () => <SoundLibraryManager kind="tanpura" title="Tanpura recordings" />,
});
