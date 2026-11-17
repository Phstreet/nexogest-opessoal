"use client";
import type { Dispatch, SetStateAction } from "react";
import type { RoutineTask } from "@/lib/routine/types";
import TaskItem from "@/components/routine/tasks/TaskItem";
type Filter = "Todas" | "Hoje" | "Pendentes" | "Concluídas" | "Atrasadas";
type Task = RoutineTask;
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
                    <TaskItem
                      key={task.id}
                      task={task}
                      today={today}
                      toggleTask={toggleTask}
                      editTask={editTask}
                      deleteTask={deleteTask}
                      expandedTask={expandedTask}
                      setExpandedTask={setExpandedTask}
                    />
                  );
                })
              )}
            </div>
  );
}