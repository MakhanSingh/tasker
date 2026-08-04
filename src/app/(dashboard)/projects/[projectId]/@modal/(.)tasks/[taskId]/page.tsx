import { TaskModal } from "@/components/tasks/TaskModal";
import { TaskDetailContent } from "@/components/tasks/TaskDetailContent";

// Intercepts a task link clicked from within the project, so the card opens
// over the board. A direct visit or refresh falls through to the full page
// at tasks/[taskId] instead.
export default async function TaskModalPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const { projectId, taskId } = await params;

  return (
    <TaskModal>
      <TaskDetailContent projectId={projectId} taskId={taskId} />
    </TaskModal>
  );
}
