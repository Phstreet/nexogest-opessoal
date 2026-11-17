"use client";
import type { Dispatch, SetStateAction } from "react";
import type { RoutinePriority, RoutineTask } from "@/lib/routine/types";
type Task = RoutineTask;
function formatDate(value?: string) {
  if (!value) return "Sem data";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return day + "/" + month + "/" + year;
}
function priorityClass(priority?: RoutinePriority) {
  switch (priority) {
    case "Urgente": return "priority-urgent";
    case "Alta": return "priority-high";
    case "Média": return "priority-medium";
    default: return "priority-low";
  }
}
interface TaskItemProps { task: Task; today: string; toggleTask: (id: number) => void; editTask: (task: Task) => void; deleteTask: (id: number) => void; expandedTask: number | null; setExpandedTask: Dispatch<SetStateAction<number | null>>; }
export default function TaskItem({ task, today, toggleTask, editTask, deleteTask, expandedTask, setExpandedTask }: TaskItemProps) {
  const overdue = !task.done && !!task.date && task.date < today;
  const expanded = expandedTask === task.id;
  return (
                        <article
                          className={`task-item ${
                            task.done ? "task-completed" : ""
                          }`}
                          key={task.id}
                        >
                          <div className="task-main">
                            <button
                              className={`task-checkbox ${
                                task.done ? "checked" : ""
                              }`}
                              onClick={() => toggleTask(task.id)}
                              aria-label={
                                task.done
                                  ? "Reabrir tarefa"
                                  : "Concluir tarefa"
                              }
                              type="button"
                            >
                              {task.done ? "✓" : ""}
                            </button>
        
                            <div className="task-content">
                              <div className="task-title-row">
                                <h3>{task.description}</h3>
        
                                {overdue && (
                                  <span className="overdue-tag">Atrasada</span>
                                )}
                              </div>
        
                              <div className="task-meta">
                                <span>{task.category || "Pessoal"}</span>
                                <span className="meta-separator">•</span>
                                <span>{formatDate(task.date)}</span>
        
                                {task.time && (
                                  <>
                                    <span className="meta-separator">•</span>
                                    <span>{task.time}</span>
                                  </>
                                )}
                              </div>
                            </div>
        
                            <div className="task-actions">
                              <span
                                className={`priority-badge ${priorityClass(
                                  task.priority
                                )}`}
                              >
                                {task.priority || "Média"}
                              </span>
        
                              <button
                                className="icon-action"
                                onClick={() =>
                                  setExpandedTask(expanded ? null : task.id)
                                }
                                title="Mais opções"
                                type="button"
                              >
                                ⋯
                              </button>
                            </div>
                          </div>
        
                          {expanded && (
                            <div className="task-details">
                              {task.notes ? (
                                <p>{task.notes}</p>
                              ) : (
                                <p className="no-notes">
                                  Nenhuma observação adicionada.
                                </p>
                              )}
        
                              <div className="task-detail-actions">
                                <button
                                  onClick={() => editTask(task)}
                                  type="button"
                                >
                                  ✎ Editar
                                </button>
        
                                <button
                                  onClick={() => toggleTask(task.id)}
                                  type="button"
                                >
                                  {task.done ? "↺ Reabrir" : "✓ Concluir"}
                                </button>
        
                                <button
                                  className="delete-action"
                                  onClick={() => deleteTask(task.id)}
                                  type="button"
                                >
                                  × Excluir
                                </button>
                              </div>
                            </div>
                          )}
                        </article>
  );
}