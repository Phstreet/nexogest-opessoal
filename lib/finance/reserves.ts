import type { Reserve, ReserveMovement } from "./types";
import { addMoney, subtractMoney, sumMoney } from "./money";

/** Calcula o saldo da reserva a partir da coleção recebida da nuvem. */
export function calculateReserveBalance(reserve: Reserve, movements: ReserveMovement[]): number {
  return movements
    .filter((movement) => movement.reserveId === reserve.id)
    .reduce((balance, movement) => {
      switch (movement.type) {
        case "Aporte":
        case "Rendimento":
        case "Ajuste":
          return addMoney(balance, movement.amount);
        case "Resgate":
          return subtractMoney(balance, movement.amount);
        default:
          return balance;
      }
    }, reserve.initialBalance);
}

export function getTotalReserveBalance(reserves: Reserve[], movements: ReserveMovement[]): number {
  return sumMoney(reserves.map((reserve) => calculateReserveBalance(reserve, movements)));
}

export function getActiveReserveBalance(reserves: Reserve[], movements: ReserveMovement[]): number {
  return reserves.filter((reserve) => reserve.status === "Ativa")
    .reduce((total, reserve) => addMoney(total, calculateReserveBalance(reserve, movements)), 0);
}
