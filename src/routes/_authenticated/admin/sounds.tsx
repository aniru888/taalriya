import { createFileRoute } from "@tanstack/react-router";
import { SoundLibraryManager } from "@/components/admin/SoundLibraryManager";

export const Route = createFileRoute("/_authenticated/admin/sounds")({
  head: () => ({ meta: [{ title: "Tabla Bols — Admin" }] }),
  component: () => <SoundLibraryManager kind="bol" title="Tabla bol library" />,
});
