"use client";

import type { FormEventHandler, Dispatch, SetStateAction } from "react";
import type { RoutinePriority } from "@/lib/routine/types";

interface AgendaFormProps {
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

export default function AgendaForm(props: AgendaFormProps) {
  const { editingId, description, setDescription, date, setDate, time, setTime, priority, setPriority, category, setCategory, notes, setNotes, onCancel, onSubmit } = props;

  return (
    <section className="agenda-form-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">
                    {editingId !== null ? "EDIÇÃO" : "CADASTRO"}
                  </span>
                  <h2>
                    {editingId !== null
                      ? "Editar atividade"
                      : "Nova atividade"}
                  </h2>
                </div>
    
                <button
                  type="button"
                  className="close-button"
                  onClick={onCancel}
                >
                  ×
                </button>
              </div>
    
              <form onSubmit={onSubmit}>
                <div className="form-grid">
                  <label className="form-field field-wide">
                    <span>Nome da atividade *</span>
                    <input
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Ex.: Reunião, academia, estudar..."
                      required
                    />
                  </label>
    
                  <label className="form-field">
                    <span>Data</span>
                    <input
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                      required
                    />
                  </label>
    
                  <label className="form-field">
                    <span>Horário</span>
                    <input
                      type="time"
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                    />
                  </label>
    
                  <label className="form-field">
                    <span>Prioridade</span>
                    <select
                      value={priority}
                      onChange={(event) =>
                        setPriority(event.target.value as Priority)
                      }
                    >
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                      <option value="Urgente">Urgente</option>
                    </select>
                  </label>
    
                  <label className="form-field">
                    <span>Categoria</span>
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                    >
                      <option value="Pessoal">Pessoal</option>
                      <option value="Trabalho">Trabalho</option>
                      <option value="Saúde">Saúde</option>
                      <option value="Estudos">Estudos</option>
                      <option value="Financeiro">Financeiro</option>
                      <option value="Lazer">Lazer</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </label>
    
                  <label className="form-field field-wide">
                    <span>Observações</span>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Adicione detalhes sobre esta atividade..."
                      rows={3}
                    />
                  </label>
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
                      : "Cadastrar atividade"}
                  </button>
                </div>
              </form>
            </section>
  );
}
