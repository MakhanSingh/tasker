import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { TaskDetailContent } from "@/components/tasks/TaskDetailContent";

// Reached by a direct link or a page refresh. Opening the same task from the
// board renders the intercepted modal at @modal/(.)tasks/[taskId] instead.
export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const { projectId, taskId } = await params;

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/projects/${projectId}/tasks`} className="text-sm text-ink-muted hover:underline">
        ← Tasks
      </Link>
      <Card className="max-w-4xl">
        <CardContent className="p-6">
          <TaskDetailContent projectId={projectId} taskId={taskId} />
        </CardContent>
      </Card>
    </div>
  );
}
