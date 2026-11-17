"use client";
import type { RoutineTask } from "@/lib/routine/types";
import AgendaTimelineItem from "@/components/routine/agenda/AgendaTimelineItem";
type Task = RoutineTask;
function priorityClass(priority?: RoutinePriority) {
  switch (priority) {
    case "Urgente": return "urgent";
    case "Alta": return "high";
    case "Média": return "medium";
    default: return "low";
  }
}
interface AgendaTimelineProps {
  selectedTasks: Task[];
  toggleTask: (id: number) => void;
  editTask: (task: Task) => void;
  deleteTask: (id: number) => void;
}
export default function AgendaTimeline({ selectedTasks, toggleTask, editTask, deleteTask }: AgendaTimelineProps) {
  return (
    <div className="timeline">
                  {selectedTasks.map((task) => (
                                        <AgendaTimelineItem
                      key={task.id}
                      task={task}
                      toggleTask={toggleTask}
                      editTask={editTask}
                      deleteTask={deleteTask}
                    />
                  ))}
                </div>
  );
}