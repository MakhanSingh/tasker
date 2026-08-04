import { Card, CardContent } from "@/components/ui/card";
import { TaskNotFound } from "@/components/tasks/TaskNotFound";

// The full page's boundary. It can't read params — a not-found file renders
// without them — so the "back to the board" link is left to the modal version,
// which can. The sidebar is still there to get out by.
export default function TaskNotFoundPage() {
  return (
    <Card className="max-w-4xl">
      <CardContent className="p-6">
        <TaskNotFound />
      </CardContent>
    </Card>
  );
}
