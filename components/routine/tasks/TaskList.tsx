"use client";
import type { Dispatch, SetStateAction } from "react";
import type { RoutinePriority, RoutineTask } from "@/lib/routine/types";
type Filter = "Todas" | "Hoje" | "Pendentes" | "Concluídas" | "Atrasadas";
type Task = RoutineTask;
type Priority = RoutinePriority;
const CATEGORIES = ["Trabalho", "Pessoal", "Financeiro", "Saúde", "Estudos", "Outros"];
const PRIORITIES: Priority[] = ["Baixa", "Média", "Alta", "Urgente"];
function formatDate(value?: string) {
  if (!value) return "Sem data";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return day + "/" + month + "/" + year;
}
function priorityClass(priority?: Priority) {
  switch (priority) {
    case "Urgente": return "priority-urgent";
    case "Alta": return "priority-high";
    case "Média": return "priority-medium";
    default: return "priority-low";
  }
}
interface TaskListProps {
  filteredTasks: Task[]; loaded: boolean; search: string; setSearch: (value: string) => void;
  filters: Filter[]; filter: Filter; setFilter: (value: Filter) => void;
  categoryFilter: string; setCategoryFilter: (value: string) => void;
  priorityFilter: string; setPriorityFilter: (value: string) => void; overdueCount: number;
  toggleTask: (id: number) => void; editTask: (task: Task) => void; deleteTask: (id: number) => void;
  expandedTask: number | null; setExpandedTask: Dispatch<SetStateAction<number | null>>;
  today: string; onClearFilters: () => void;
}
export default function TaskList(props: TaskListProps) {
  const { filteredTasks, loaded, search, setSearch, filters, filter, setFilter, categoryFilter, setCategoryFilter, priorityFilter, setPriorityFilter, overdueCount, toggleTask, editTask, deleteTask, expandedTask, setExpandedTask, today, onClearFilters } = props;
  return (
    <div className="task-list">
              {!loaded ? (
                <div className="empty-state">
                  <div className="empty-icon">◷</div>
                  <h3>Carregando tarefas...</h3>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">▤</div>
                  <h3>Nenhuma tarefa encontrada</h3>
                  <p>
                    Não existem tarefas para os filtros selecionados.
                    Cadastre uma nova atividade ou altere os filtros.
                  </p>
    
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setFilter("Todas");
                      setCategoryFilter("Todas");
                      setPriorityFilter("Todas");
                      setSearch("");
                    }}
                    type="button"
                  >
                    Limpar filtros
                  </button>
                </div>
              ) : (
                filteredTasks.map((task) => {
                  const overdue =
                    !task.done && !!task.date && task.date < today;
    
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
                })
              )}
            </div>
  );
}