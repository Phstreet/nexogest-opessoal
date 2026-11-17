"use client";
import type { RoutineTask } from "@/lib/routine/types";
import TaskItem from "@/components/routine/tasks/TaskItem";
type Task = RoutineTask;
interface TaskListProps {
  filteredTasks: Task[];
  loaded: boolean;
  onClearFilters: () => void;
  toggleTask: (id: number) => void;
  editTask: (task: Task) => void;
  deleteTask: (id: number) => void;
  expandedTask: number | null;
  setExpandedTask: (value: number | null) => void;
  today: string;
}
export default function TaskList(props: TaskListProps) {
  const { filteredTasks, loaded, onClearFilters, toggleTask, editTask, deleteTask, expandedTask, setExpandedTask, today } = props;
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
                    onClick={onClearFilters}
                    type="button"
                  >
                    Limpar filtros
                  </button>
                </div>
              ) : (
                filteredTasks.map((task) => {
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