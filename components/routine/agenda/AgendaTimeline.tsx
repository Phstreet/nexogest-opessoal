"use client";
import type { RoutinePriority, RoutineTask } from "@/lib/routine/types";
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
                    <div
                      className={`timeline-item ${task.done ? "completed" : ""}`}
                      key={task.id}
                    >
                      <div className="timeline-time">
                        {task.time || "--:--"}
                      </div>
    
                      <div className="timeline-marker">
                        <span />
                      </div>
    
                      <div className="timeline-card">
                        <div className="timeline-card-top">
                          <div className="task-title-area">
                            <button
                              type="button"
                              className={`task-check ${task.done ? "checked" : ""}`}
                              onClick={() => toggleTask(task.id)}
                              aria-label={
                                task.done
                                  ? "Marcar como pendente"
                                  : "Concluir atividade"
                              }
                            >
                              {task.done ? "✓" : ""}
                            </button>
    
                            <div>
                              <h3>{task.description}</h3>
                              <span className="task-category">
                                {task.category || "Pessoal"}
                              </span>
                            </div>
                          </div>
    
                          <span
                            className={`priority-badge ${priorityClass(
                              task.priority
                            )}`}
                          >
                            {task.priority || "Baixa"}
                          </span>
                        </div>
    
                        {task.notes && (
                          <p className="task-notes">{task.notes}</p>
                        )}
    
                        <div className="task-actions">
                          <span
                            className={
                              task.done ? "done-label" : "waiting-label"
                            }
                          >
                            {task.done ? "Concluída" : "Pendente"}
                          </span>
    
                          <div>
                            <button
                              type="button"
                              onClick={() => editTask(task)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="delete-action"
                              onClick={() => deleteTask(task.id)}
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
  );
}