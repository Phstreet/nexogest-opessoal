"use client";

import type { FormEventHandler, Dispatch, SetStateAction } from "react";
import type { RoutinePriority } from "@/lib/routine/types";

const CATEGORIES = ["Trabalho", "Pessoal", "Financeiro", "Saúde", "Estudos", "Outros"];
const PRIORITIES: RoutinePriority[] = ["Baixa", "Média", "Alta", "Urgente"];

interface TaskFormProps {
  editingId: number | null;
  description: string;
  setDescription: Dispatch<SetStateAction<string>>;
  date: string;
  setDate: Dispatch<SetStateAction<string>>;
  time: string;
  setTime: Dispatch<SetStateAction<string>>;
  priority: RoutinePriority;
  setPriority: Dispatch<SetStateAction<RoutinePriority>>;
  category: string;
  setCategory: Dispatch<SetStateAction<string>>;
  notes: string;
  setNotes: Dispatch<SetStateAction<string>>;
  onCancel: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export default function TaskForm(props: TaskFormProps) {
  const { editingId, description, setDescription, date, setDate, time, setTime, priority, setPriority, category, setCategory, notes, setNotes, onCancel, onSubmit } = props;

  return (
    <>
    <section className="form-card" id="task-form">
              <div className="form-heading">
                <div>
                  <span className="section-label">
                    {editingId !== null ? "EDIÇÃO" : "NOVO REGISTRO"}
                  </span>
                  <h2>
                    {editingId !== null
                      ? "Editar tarefa"
                      : "Cadastrar tarefa"}
                  </h2>
                </div>
    
                <button
                  className="close-button"
                  onClick={onCancel}
                  type="button"
                  aria-label="Fechar formulário"
                >
                  ×
                </button>
              </div>
    
              <form onSubmit={onSubmit}>
                <div className="form-field full-field">
                  <label htmlFor="task-description">Descrição da tarefa *</label>
                  <input
                    id="task-description"
                    type="text"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Ex.: Finalizar relatório financeiro"
                    required
                    autoFocus
                  />
                </div>
    
                <div className="form-grid">
                  <div className="form-field">
                    <label>Data prevista</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </div>
    
                  <div className="form-field">
                    <label>Horário</label>
                    <input
                      type="time"
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                    />
                  </div>
    
                  <div className="form-field">
                    <label>Prioridade</label>
                    <select
                      value={priority}
                      onChange={(event) =>
                        setPriority(event.target.value as Priority)
                      }
                    >
                      {PRIORITIES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
    
                  <div className="form-field">
                    <label>Categoria</label>
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                    >
                      {CATEGORIES.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
    
                <div className="form-field full-field">
                  <label>Observações</label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Adicione detalhes ou informações importantes..."
                    rows={3}
                  />
                </div>
    
                <div className="form-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={onCancel}
                  >
                    Cancelar
                  </button>
    
                  <button type="submit" className="primary-button">
                    {editingId !== null
                      ? "Salvar alterações"
                      : "Cadastrar tarefa"}
                  </button>
                </div>
              </form>
            </section>
    </>
  );
}
