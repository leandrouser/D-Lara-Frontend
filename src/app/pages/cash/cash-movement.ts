// src/app/components/cash-movement/cash-movement.component.ts

import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of, finalize, from } from 'rxjs';
import { CashMovementResponse, CashMovementService, CloseCashRegisterResponse, OpenCashRegisterRequest } from '../../core/service/cash-movement.service';

@Component({
  selector: 'app-cash-movement',
  standalone: true,
  imports: [CommonModule, FormsModule], // Importe CommonModule para *ngIf e FormsModule para o input
  templateUrl: './cash-movement.html',
  styleUrls: ['./cash-movement.scss']
})
export class CashMovementComponent implements OnInit {
  private cashService = inject(CashMovementService);

  // Estado da Aplicação
  cashRegisterStatus: 'CLOSED' | 'OPEN' | 'UNKNOWN' = 'UNKNOWN';
  currentOpeningId: number | null = null;
  initialValue: number = 0; // Valor inicial a ser inserido para abrir o caixa

  // Feedback para o usuário
  message: string | null = null;
  errorMessage: string | null = null;
  isLoading: boolean = false;
  
  // Resultado do fechamento
  totalsByPaymentMethod: CloseCashRegisterResponse | null = null;

  ngOnInit(): void {
    // Em um cenário real, você faria uma chamada para verificar o estado atual do caixa ao iniciar.
    // Por simplicidade, vamos começar em 'UNKNOWN'.
    this.message = 'Verifique o status do caixa ao iniciar ou tente abrir.';
  }

  /**
   * 🔓 Função para abrir o caixa
   */
  openCashRegister(): void {
    if (this.initialValue <= 0) {
      this.errorMessage = 'O valor inicial deve ser maior que zero.';
      return;
    }

    this.resetMessages();
    this.isLoading = true;
    const request: OpenCashRegisterRequest = { value: this.initialValue };

    this.cashService.openCashRegister(request)
      .pipe(
        finalize(() => this.isLoading = false),
        catchError(error => {
          console.error('Erro ao abrir caixa:', error);
          this.errorMessage = error.error?.message || 'Falha ao abrir o caixa. Verifique o console.';
          return of(null);
        })
      )
      .subscribe((response: CashMovementResponse | null) => {
        if (response) {
          this.cashRegisterStatus = 'OPEN';
          this.currentOpeningId = response.id;
          this.message = `✅ Caixa aberto com sucesso! ID: ${response.id}. Valor Inicial: R$ ${response.initialValue.toFixed(2)}`;
          this.initialValue = 0; // Limpa o campo
        }
      });
  }

  /**
   * 🔒 Função para fechar o caixa
   */
  closeCashRegister(): void {
    if (!this.currentOpeningId) {
      this.errorMessage = 'Não há ID de abertura de caixa para fechar.';
      return;
    }

    this.resetMessages();
    this.isLoading = true;

    this.cashService.closeCashRegister(this.currentOpeningId)
      .pipe(
        finalize(() => this.isLoading = false),
        catchError(error => {
          console.error('Erro ao fechar caixa:', error);
          this.errorMessage = error.error?.message || 'Falha ao fechar o caixa. Verifique o console.';
          return of(null);
        })
      )
      .subscribe((totals: CloseCashRegisterResponse | null) => {
        if (totals) {
          this.cashRegisterStatus = 'CLOSED';
          this.message = `Caixa ID ${this.currentOpeningId} fechado com sucesso!`;
          this.totalsByPaymentMethod = totals;
          this.currentOpeningId = null; // Limpa o ID após o fechamento
        }
      });
  }

  private resetMessages(): void {
    this.message = null;
    this.errorMessage = null;
    this.totalsByPaymentMethod = null;
  }

  /**
   * Converte o objeto de totais para um array de pares [ID, Valor] para exibição no HTML.
   */
  get totalsArray(): [string, number][] {
    if (!this.totalsByPaymentMethod) return [];
    return Object.entries(this.totalsByPaymentMethod);
  }
}