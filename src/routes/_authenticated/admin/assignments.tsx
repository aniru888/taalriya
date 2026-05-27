import { createFileRoute } from "@tanstack/react-router";
import { BeatAssignmentEditor } from "@/components/admin/BeatAssignmentEditor";

export const Route = createFileRoute("/_authenticated/admin/assignments")({
  head: () => ({ meta: [{ title: "Beat Assignments — Admin" }] }),
  component: () => <BeatAssignmentEditor />,
});
