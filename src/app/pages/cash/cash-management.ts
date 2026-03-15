import { Component, inject, OnInit, signal, computed, effect, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize, catchError, of } from 'rxjs';
import { CashService, OpenSessionRequest, CashTransactionRequestDTO, CloseSessionRequest, Transaction } from '../../core/service/cash.service';
import { CashModalComponent } from "../../shared/models/cash/cash-modal.component";
import { PaymentService } from '../../core/service/payment.service';

@Component({
  selector: 'app-cash-management',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule,
    MatProgressSpinnerModule,
    CashModalComponent
],
  templateUrl: './cash-management.html',
  styleUrls: ['./cash-management.scss']
})
export class CashManagement implements OnInit {
  public cashService = inject(CashService);
  private paymentService = inject(PaymentService);
  private snackBar = inject(MatSnackBar);

   @ViewChild(CashModalComponent) cashModal!: CashModalComponent;

  isCashOpen = computed(() => this.cashService.activeSessionId() !== null);
  isLoading = signal(false);
  isOpeningModalOpen = signal(false);
  isClosingModalOpen = signal(false);

  transactions = signal<Transaction[]>([]);
  movementType = signal<'SUPPLEMENT' | 'SANGRIA'>('SUPPLEMENT');
  movementValue = signal<number>(0);
  movementObservation = signal<string>('');
  showMovementForm = signal(false);

  paymentMethods = signal<{id: number, name: string}[]>([]);
  reportedPayments = signal<{paymentMethodId: number, physicalAmount: number}[]>([]);

  constructor() {
    effect(() => {
      const id = this.cashService.activeSessionId();
      if (id) {
        this.loadTransactions();
      } else {
        this.transactions.set([]);
      }
    });
  }

  ngOnInit(): void {
    this.paymentService.listPaymentMethods().subscribe({
      next: (methods) => {
        this.paymentMethods.set(methods.map(m => ({ id: m.id, name: m.displayName })));
      }
    });

    if (this.isCashOpen()) {
      this.loadInitialData();
    }
  }

  private loadInitialData(): void {
    this.loadTransactions();
  }

  onConfirmCashOpen(initialValue: number): void {
    if (initialValue < 0) {
      this.showError('O valor inicial não pode ser negativo');
      return;
    }

    this.isLoading.set(true);
    const request: OpenSessionRequest = { initialValue };

    this.cashService.openCashRegister(request)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (session) => {
          this.showSuccess('✅ Caixa aberto com sucesso!');
          this.isOpeningModalOpen.set(false);
          this.loadTransactions();
        },
        error: (err) => this.showError(err.error?.message || 'Erro ao abrir caixa')
      });
  }

  addMovement(): void {
    const sessionId = this.cashService.activeSessionId();
    if (!sessionId) return;

    if (this.movementValue() <= 0) {
      this.showError('O valor deve ser maior que zero');
      return;
    }

    this.isLoading.set(true);

    const request = {
      value: this.movementValue(),
      type: this.movementType(),
      description: this.movementObservation() || "Movimentação manual",
      paymentMethodId: 1
    };

    this.cashService.createManualTransaction(sessionId, request as any)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          this.showSuccess('✅ Movimentação registrada!');
          this.resetMovementForm();
          this.loadTransactions();
        },
        error: (err) => {
          console.error('Detalhes do erro:', err.error);
          this.showError(err.error?.errors?.description || err.error?.message || 'Erro na transação');
        }
      });
  }

onConfirmCashClosing(event: any): void {
  const sessionId = this.cashService.activeSessionId();
  if (!sessionId) {
    this.showError('Sessão não encontrada');
    return;
  }

  this.isLoading.set(true);

  const request: CloseSessionRequest = {
    sessionId: sessionId,
    counts: event.counts
  };

  this.cashService.closeSession(sessionId, request)
    .pipe(finalize(() => this.isLoading.set(false)))
    .subscribe({
      next: (response) => {
        this.showSuccess('✅ Caixa fechado com sucesso!');
        
        if (this.cashModal) {
            this.cashModal.setClosingResult(response);
          }
        
      },
      error: (err) => {
        this.showError(err.error?.message || 'Erro ao fechar caixa');
        this.isClosingModalOpen.set(false);
      }
    });
}

  private getPaymentMethodIdByName(name: string): number {
    const methodMap: { [key: string]: number } = {
      'Dinheiro': 1,
      'Cartão de Crédito': 2,
      'Cartão de Débito': 3,
      'PIX': 4
    };
    return methodMap[name] || 1;
  }

  private loadTransactions(): void {
    const sessionId = this.cashService.activeSessionId();
    if (!sessionId) return;

    this.isLoading.set(true);
    this.cashService.getTransactionsBySession(sessionId)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => {
          console.log('Dados carregados na tabela:', data);
          this.transactions.set(data);
        },
        error: () => this.showError('Não foi possível carregar as movimentações.')
      });
  }

  private resetMovementForm(): void {
    this.movementValue.set(0);
    this.movementObservation.set('');
    this.showMovementForm.set(false);
  }

  private showSuccess(msg: string) {
    this.snackBar.open(msg, 'OK', { duration: 3000, panelClass: ['success-snack'] });
  }

  private showError(msg: string) {
    this.snackBar.open(msg, 'OK', { duration: 5000, panelClass: ['error-snack'] });
  }

  private showWarning(msg: string) {
    this.snackBar.open(msg, 'OK', { duration: 5000, panelClass: ['warning-snack'] });
  }

  updateCount(methodId: number, event: any) {
    const value = Number(event.target.value);
    this.reportedPayments.update(current => {
      const index = current.findIndex(p => p.paymentMethodId === methodId);
      if (index > -1) {
        current[index].physicalAmount = value;
        return [...current];
      }
      return [...current, { paymentMethodId: methodId, physicalAmount: value }];
    });
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return '---';
    const d = new Date(date);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  }

  getTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'SALE': 'Venda',
      'SUPPLEMENT': 'Suprimento',
      'SANGRIA': 'Sangria',
      'CHANGE': 'Troco',
      'OPENING': 'Abertura'
    };
    return labels[type] || type;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  onModalConfirm(event: any): void {
  if (typeof event === 'number') {
    this.onConfirmCashOpen(event);
  } else if (event.type === 'CLOSING') {
    this.onConfirmCashClosing(event);
  }
}

onModalClose(): void {
    if (this.isOpeningModalOpen()) {
      this.isOpeningModalOpen.set(false);
    } else {
      this.isClosingModalOpen.set(false);
    }
  }
}