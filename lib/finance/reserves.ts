import type { Reserve, ReserveMovement } from "./types";

/** Calcula o saldo da reserva a partir da coleção recebida da nuvem. */
export function calculateReserveBalance(reserve: Reserve, movements: ReserveMovement[]): number {
  return movements
    .filter((movement) => movement.reserveId === reserve.id)
    .reduce((balance, movement) => {
      switch (movement.type) {
        case "Aporte":
        case "Rendimento":
        case "Ajuste":
          return balance + movement.amount;
        case "Resgate":
          return balance - movement.amount;
        default:
          return balance;
      }
    }, reserve.initialBalance);
}

export function getTotalReserveBalance(reserves: Reserve[], movements: ReserveMovement[]): number {
  return reserves.reduce((total, reserve) => total + calculateReserveBalance(reserve, movements), 0);
}

export function getActiveReserveBalance(reserves: Reserve[], movements: ReserveMovement[]): number {
  return reserves.filter((reserve) => reserve.status === "Ativa")
    .reduce((total, reserve) => total + calculateReserveBalance(reserve, movements), 0);
}
