import { createFileRoute } from "@tanstack/react-router";
import { SoundLibraryManager } from "@/components/admin/SoundLibraryManager";

export const Route = createFileRoute("/_authenticated/admin/taals")({
  head: () => ({ meta: [{ title: "Taal Loops — Admin" }] }),
  component: () => <SoundLibraryManager kind="taal_loop" title="Curated taal loops" />,
});
