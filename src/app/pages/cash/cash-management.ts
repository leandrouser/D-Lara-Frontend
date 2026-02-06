import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize, catchError, of } from 'rxjs';
import { CashService, OpenSessionRequest, CashTransactionRequestDTO, CloseSessionRequest, Transaction } from '../../core/service/cash.service';
import { CashModalComponent } from "../../shared/models/cash/cash-movement.model";
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

  // ===== ESTADOS SINCRONIZADOS COM O SERVICE =====
  // O status do caixa agora é derivado do ID ativo no serviço
  isCashOpen = computed(() => this.cashService.activeSessionId() !== null);
  isLoading = signal(false);
  isOpeningModalOpen = signal(false);
  isClosingModalOpen = signal(false);

  // ===== DADOS DO RESUMO E MOVIMENTAÇÕES =====
  transactions = signal<Transaction[]>([]);
  movementType = signal<'SUPPLEMENT' | 'SANGRIA'>('SUPPLEMENT');
  movementValue = signal<number>(0);
  movementObservation = signal<string>('');
  showMovementForm = signal(false);

  // Adicione este sinal para os métodos de pagamento (usado no modal de fechamento)
  paymentMethods = signal<{id: number, name: string}[]>([]);
  reportedPayments = signal<{paymentMethodId: number, physicalAmount: number}[]>([]);

  ngOnInit(): void {
    // Busca métodos de pagamento do PaymentService
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

  // ===== AÇÕES DE ABERTURA =====

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

  // ===== MOVIMENTAÇÕES (SANGRIA/SUPRIMENTO) =====

  addMovement(): void {
    const sessionId = this.cashService.activeSessionId();
    if (!sessionId) return;

    if (this.movementValue() <= 0) {
      this.showError('O valor deve ser maior que zero');
      return;
    }

    this.isLoading.set(true);
    const request: CashTransactionRequestDTO = {
      value: this.movementValue(),
      type: this.movementType(),
      observation: this.movementObservation(),
      paymentMethodId: 1 // Geralmente Dinheiro para sangria/suprimento
    };

    this.cashService.createManualTransaction(sessionId, request)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          this.showSuccess('✅ Movimentação registrada!');
          this.resetMovementForm();
          this.loadTransactions();
        },
        error: (err) => this.showError(err.error?.message || 'Erro na transação')
      });
  }

  // ===== FECHAMENTO =====

  executeCashClosing(): void {
  const sessionId = this.cashService.activeSessionId();
  if (!sessionId) {
    this.snackBar.open('Sessão não encontrada', 'OK');
    return;
  }

  this.isLoading.set(true);

  // Pegamos os dados diretamente do sinal/propriedade do componente
  const request: CloseSessionRequest = {
    sessionId: sessionId,
    counts: this.reportedPayments() // <-- Aqui usamos o que foi digitado no modal
  };

  this.cashService.closeSession(sessionId, request)
    .pipe(finalize(() => this.isLoading.set(false)))
    .subscribe({
      next: (response) => {
        this.snackBar.open('✅ Caixa fechado com sucesso!', 'OK', { duration: 3000 });
        this.isClosingModalOpen.set(false);
        // Opcional: mostrar o relatório de discrepâncias (response.details)
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Erro ao fechar caixa', 'Fechar');
      }
    });
}

  // ===== AUXILIARES =====

  private loadTransactions(): void {
  const sessionId = this.cashService.activeSessionId();
  if (!sessionId) return;

  this.isLoading.set(true);
  this.cashService.getTransactionsBySession(sessionId)
    .pipe(finalize(() => this.isLoading.set(false)))
    .subscribe({
      next: (data) => {
        console.log('Dados carregados na tabela:', data); // Debug para conferência
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
}