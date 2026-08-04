"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TaskCard } from "@/components/tasks/TaskCard";
import { InlineAddTaskRow } from "@/components/tasks/InlineAddTaskRow";
import { moveTaskOnBoard } from "@/app/(dashboard)/projects/[projectId]/tasks/actions";
import { cn } from "@/lib/utils/cn";
import type { Database, TaskStatus } from "@/types/database.types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

const COLUMNS: Array<{ status: TaskStatus; label: string }> = [
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "in_review", label: "In review" },
  { status: "done", label: "Done" },
];

const STATUSES = COLUMNS.map((c) => c.status);
const isStatus = (value: string): value is TaskStatus => (STATUSES as string[]).includes(value);

type CardProps = {
  projectId: string;
  assigneeNames: string[];
  loggedMinutes: number;
  commentCount: number;
  isTimerRunning: boolean;
  canChangeStatus: boolean;
};

function SortableCard({ task, cardProps }: { task: Task; cardProps: CardProps }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
    disabled: !cardProps.canChangeStatus,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        cardProps.canChangeStatus && "cursor-grab touch-none active:cursor-grabbing",
        // The original keeps its slot as a gap while the overlay follows the
        // pointer; hiding it entirely would make the list jump.
        isDragging && "opacity-40"
      )}
    >
      <TaskCard task={task} {...cardProps} />
    </div>
  );
}

function Column({
  projectId,
  projectName,
  status,
  label,
  tasks,
  isOver,
  addVariant,
  children,
}: {
  projectId: string;
  projectName?: string;
  status: TaskStatus;
  label: string;
  tasks: Task[];
  isOver: boolean;
  /** null when this person can't add work to this column. */
  addVariant: "team" | "client" | null;
  children: React.ReactNode;
}) {
  // A droppable wrapper in addition to the sortable items, so an empty
  // column is still a valid drop target.
  const { setNodeRef } = useDroppable({ id: `column:${status}`, data: { status } });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-3 rounded-lg bg-sidebar p-3 transition-colors",
        isOver && "bg-selected ring-1 ring-primary"
      )}
    >
      <p className="text-sm font-semibold text-ink-secondary">
        {label} <span className="text-ink-faint">({tasks.length})</span>
      </p>
      <div className="flex min-h-16 flex-col gap-2">
        {children}
        {tasks.length === 0 && !addVariant && <p className="px-1 text-xs text-ink-faint">No tasks</p>}
      </div>
      {/* Adding from the column, Trello-style: the task lands in the status
          you added it under, so the column is both where you read work and
          where you put it. Going through the dialog to then drag the card
          across is two steps for something that should be none. */}
      {addVariant && (
        <InlineAddTaskRow
          projectId={projectId}
          projectName={projectName}
          status={status}
          statusLabel={label}
          variant={addVariant}
        />
      )}
    </div>
  );
}

// Board drag & drop via dnd-kit: cards reorder within a column and move
// between columns, with keyboard support and a drag overlay. A drop writes
// the new status and the destination column's order in one action.
export function TaskBoard({
  projectId,
  tasks,
  assigneeNamesByTask,
  loggedMinutesByTask,
  commentCountsByTask,
  runningTaskId,
  projectName,
  canChangeStatus,
  addTasks,
}: {
  projectId: string;
  tasks: Task[];
  assigneeNamesByTask: Map<string, string[]>;
  loggedMinutesByTask: Map<string, number>;
  commentCountsByTask: Map<string, number>;
  runningTaskId: string | null;
  projectName?: string;
  canChangeStatus: boolean;
  /**
   * "team" for managers and editors, "client" for the customer raising a
   * request, null for a viewer — who can move their own card but not create
   * work. The client gets the row on To do alone, because that is where their
   * request lands whatever column it was typed under.
   */
  addTasks: "team" | "client" | null;
}) {
  const [localTasks, setLocalTasks] = useState(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);
  const [, startTransition] = useTransition();

  // A router.refresh() after any mutation delivers fresh tasks; adopt them.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with a server-provided prop
    setLocalTasks(tasks);
  }, [tasks]);

  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so clicking a card still
    // opens it instead of being swallowed as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const byStatus = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>(STATUSES.map((s) => [s, []]));
    for (const task of [...localTasks].sort((a, b) => a.position - b.position)) {
      map.get(task.status)?.push(task);
    }
    return map;
  }, [localTasks]);

  const activeTask = activeId ? localTasks.find((t) => t.id === activeId) ?? null : null;

  const cardPropsFor = (task: Task): CardProps => ({
    projectId,
    assigneeNames: assigneeNamesByTask.get(task.id) ?? [],
    loggedMinutes: loggedMinutesByTask.get(task.id) ?? 0,
    commentCount: commentCountsByTask.get(task.id) ?? 0,
    isTimerRunning: runningTaskId === task.id,
    canChangeStatus,
  });

  /** The column a drag is currently over — the id is either a card or a column. */
  const statusOf = (id: string | null): TaskStatus | null => {
    if (!id) return null;
    if (id.startsWith("column:")) {
      const status = id.slice("column:".length);
      return isStatus(status) ? status : null;
    }
    return localTasks.find((t) => t.id === id)?.status ?? null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  // Moving the card between columns during the drag (rather than only on
  // drop) is what makes the placeholder appear in the right column.
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setOverStatus(null);
      return;
    }
    const activeStatus = statusOf(String(active.id));
    const targetStatus = statusOf(String(over.id));
    setOverStatus(targetStatus);
    if (!activeStatus || !targetStatus || activeStatus === targetStatus) return;

    setLocalTasks((current) =>
      current.map((t) => (t.id === active.id ? { ...t, status: targetStatus } : t))
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const previous = tasks;
    setActiveId(null);
    setOverStatus(null);
    if (!over) {
      setLocalTasks(previous);
      return;
    }

    const targetStatus = statusOf(String(over.id));
    if (!targetStatus) {
      setLocalTasks(previous);
      return;
    }

    const column = (byStatus.get(targetStatus) ?? []).map((t) => t.id);
    const fromIndex = column.indexOf(String(active.id));
    const toIndex = over.id === `column:${targetStatus}` ? column.length - 1 : column.indexOf(String(over.id));
    const ordered =
      fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex
        ? arrayMove(column, fromIndex, toIndex)
        : column;

    // Reflect the final order locally before the round-trip.
    setLocalTasks((current) => {
      const rank = new Map(ordered.map((id, index) => [id, index]));
      return current.map((t) => (rank.has(t.id) ? { ...t, position: rank.get(t.id)! } : t));
    });

    startTransition(async () => {
      try {
        await moveTaskOnBoard(projectId, String(active.id), targetStatus, ordered);
      } catch (err) {
        setLocalTasks(previous);
        window.alert(err instanceof Error ? err.message : "Failed to move task");
      }
    });
  };

  return (
    <DndContext
      // Without an explicit id dnd-kit numbers its own from a module counter,
      // which lands differently on the server than in the browser as soon as
      // anything else on the page mounts first — the aria-describedby it
      // generates then mismatches on hydration.
      id="task-board"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setOverStatus(null);
        setLocalTasks(tasks);
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map(({ status, label }) => {
          const columnTasks = byStatus.get(status) ?? [];
          return (
            <Column
              key={status}
              projectId={projectId}
              projectName={projectName}
              status={status}
              label={label}
              tasks={columnTasks}
              isOver={canChangeStatus && activeId !== null && overStatus === status}
              addVariant={addTasks === "client" && status !== "todo" ? null : addTasks}
            >
              <SortableContext items={columnTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {columnTasks.map((task) => (
                  <SortableCard key={task.id} task={task} cardProps={cardPropsFor(task)} />
                ))}
              </SortableContext>
            </Column>
          );
        })}
      </div>

      {/* Follows the pointer at full opacity so the card being moved stays
          readable over the columns it crosses. */}
      <DragOverlay>
        {activeTask ? (
          <div className="rotate-1 cursor-grabbing opacity-95 shadow-lg">
            <TaskCard task={activeTask} {...cardPropsFor(activeTask)} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
