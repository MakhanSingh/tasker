import { TaskModal } from "@/components/tasks/TaskModal";
import { TaskNotFound } from "@/components/tasks/TaskNotFound";

// Keeps the card shape when the task inside it is gone — closing still drops
// you back on the board, which is the one thing you want to do from here.
export default function TaskModalNotFound() {
  return (
    <TaskModal>
      <TaskNotFound />
    </TaskModal>
  );
}
