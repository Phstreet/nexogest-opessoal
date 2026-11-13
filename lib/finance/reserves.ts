
import type {
    Reserve,
    ReserveMovement,
    ReserveMovementType,
  } from "./types";
  
  import {
    getReserves,
    saveReserves,
    getReserveMovements,
    saveReserveMovements,
  } from "./storage";
  
  export function getAllReserves(): Reserve[] {
    return getReserves();
  }
  
  export function getReserveById(id: number): Reserve | undefined {
    return getReserves().find((item) => item.id === id);
  }
  
  export function createReserve(
    data: Omit<Reserve, "id" | "createdAt">
  ): Reserve {
    const reserves = getReserves();
  
    const reserve: Reserve = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    };
  
    reserves.push(reserve);
  
    if (!saveReserves(reserves)) {
      throw new Error("Não foi possível salvar a reserva.");
    }
  
    return reserve;
  }
  
  export function updateReserve(
    id: number,
    changes: Partial<Omit<Reserve, "id">>
  ): Reserve {
    const reserves = getReserves();
    const index = reserves.findIndex((item) => item.id === id);
  
    if (index === -1) {
      throw new Error("Reserva não encontrada.");
    }
  
    const updated: Reserve = {
      ...reserves[index],
      ...changes,
      id,
    };
  
    reserves[index] = updated;
  
    if (!saveReserves(reserves)) {
      throw new Error("Não foi possível atualizar a reserva.");
    }
  
    return updated;
  }
  
  export function deleteReserve(id: number): boolean {
    const reserves = getReserves();
    const movements = getReserveMovements();
  
    const hasMovements = movements.some(
      (movement) => movement.reserveId === id
    );
  
    if (hasMovements) {
      throw new Error(
        "Esta reserva possui histórico. Não é permitido excluí-la."
      );
    }
  
    const updated = reserves.filter((item) => item.id !== id);
  
    if (updated.length === reserves.length) {
      return false;
    }
  
    if (!saveReserves(updated)) {
      throw new Error("Não foi possível excluir a reserva.");
    }
  
    return true;
  }
  
  export function getReserveMovementsById(
    reserveId: number
  ): ReserveMovement[] {
    return getReserveMovements().filter(
      (item) => item.reserveId === reserveId
    );
  }
  
  export function getReserveBalance(reserveId: number): number {
    const reserve = getReserveById(reserveId);
  
    if (!reserve) {
      throw new Error("Reserva não encontrada.");
    }
  
    const movements = getReserveMovementsById(reserveId);
  
    return movements.reduce((balance, movement) => {
      switch (movement.type) {
        case "Aporte":
        case "Rendimento":
          return balance + movement.amount;
  
        case "Resgate":
          return balance - movement.amount;
  
        case "Ajuste":
          return balance + movement.amount;
  
        default:
          return balance;
      }
    }, reserve.initialBalance);
  }
  
  export function createReserveMovement(data: {
    reserveId: number;
    type: ReserveMovementType;
    amount: number;
    date: string;
    description: string;
  }): ReserveMovement {
    const reserve = getReserveById(data.reserveId);
  
    if (!reserve) {
      throw new Error("Reserva não encontrada.");
    }
  
    if (reserve.status !== "Ativa") {
      throw new Error(
        "Somente reservas ativas podem receber movimentações."
      );
    }
  
    if (!Number.isFinite(data.amount) || data.amount <= 0) {
      throw new Error("Informe um valor maior que zero.");
    }
  
    const currentBalance = getReserveBalance(data.reserveId);
  
    if (
      data.type === "Resgate" &&
      data.amount > currentBalance
    ) {
      throw new Error("O resgate não pode superar o saldo da reserva.");
    }
  
    const movement: ReserveMovement = {
      ...data,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    };
  
    const movements = getReserveMovements();
    movements.push(movement);
  
    if (!saveReserveMovements(movements)) {
      throw new Error("Não foi possível salvar a movimentação.");
    }
  
    return movement;
  }
  
  export function deleteReserveMovement(id: number): boolean {
    const movements = getReserveMovements();
    const movement = movements.find((item) => item.id === id);
  
    if (!movement) return false;
  
    const reserveBalance = getReserveBalance(movement.reserveId);
  
    if (
      movement.type === "Aporte" ||
      movement.type === "Rendimento" ||
      movement.type === "Ajuste"
    ) {
      if (reserveBalance - movement.amount < 0) {
        throw new Error(
          "Não é possível excluir: isso deixaria o saldo da reserva negativo."
        );
      }
    }
  
    const updated = movements.filter((item) => item.id !== id);
  
    if (!saveReserveMovements(updated)) {
      throw new Error("Não foi possível excluir a movimentação.");
    }
  
    return true;
  }
  
  export function getTotalReserveBalance(): number {
    return getReserves().reduce(
      (total, reserve) =>
        total + getReserveBalance(reserve.id),
      0
    );
  }
  
  export function getActiveReserveBalance(): number {
    return getReserves()
      .filter((reserve) => reserve.status === "Ativa")
      .reduce(
        (total, reserve) =>
          total + getReserveBalance(reserve.id),
        0
      );
  }
  