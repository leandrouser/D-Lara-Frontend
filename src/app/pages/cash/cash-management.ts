import {
  Component, inject, OnInit, OnDestroy, signal, computed, effect, ViewChild, ElementRef, AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import {
  CashService, PaymentMethodCountDTO, OpenSessionRequest,
  CloseSessionRequest, CashMovementResponse, CashSummaryResponse
} from '../../core/service/cash.service';
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
export class CashManagement implements OnInit, OnDestroy, AfterViewInit {
  public cashService = inject(CashService);
  private paymentService = inject(PaymentService);
  private snackBar = inject(MatSnackBar);

  @ViewChild(CashModalComponent) cashModal!: CashModalComponent;
  @ViewChild('movementsChart') chartCanvas!: ElementRef<HTMLCanvasElement>;

  isCashOpen = computed(() => this.cashService.activeSessionId() !== null);
  isLoading = signal(false);
  isOpeningModalOpen = signal(false);
  isClosingModalOpen = signal(false);

  transactions = signal<CashMovementResponse[]>([]);
  movementType = signal<'SUPPLEMENT' | 'SANGRIA'>('SUPPLEMENT');
  movementValue = signal<number>(0);
  movementObservation = signal<string>('');
  showMovementForm = signal(false);

  paymentMethods = signal<{ id: number, name: string }[]>([]);
  reportedPayments = signal<{ paymentMethodId: number, physicalAmount: number }[]>([]);

  // ─── Novo: resumo + gráfico ────────────────────────────────────────────────
  sessionSummary = signal<CashSummaryResponse | null>(null);
  isSummaryLoading = signal(false);
  activeTab = signal<'movements' | 'summary' | 'chart'>('movements');

  private chartInstance: any = null;
  private chartJsLoaded = false;
  // ──────────────────────────────────────────────────────────────────────────

  constructor() {
    effect(() => {
      const id = this.cashService.activeSessionId();
      if (id) {
        this.loadTransactions();
        this.loadSummary();
      } else {
        this.transactions.set([]);
        this.sessionSummary.set(null);
      }
    });

    // Rebuild chart when switching to chart tab
    effect(() => {
      const tab = this.activeTab();
      if (tab === 'chart') {
        // defer so canvas is rendered
        setTimeout(() => this.renderChart(), 50);
      }
    });
  }

  ngOnInit(): void {
    this.paymentService.listPaymentMethods().subscribe({
      next: (methods) => {
        this.paymentMethods.set(methods.map(m => ({ id: m.id, name: m.displayName })));
      }
    });
    this.loadChartJs();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.destroyChart();
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  private loadSummary(): void {
    const sessionId = this.cashService.activeSessionId();
    if (!sessionId) return;

    this.isSummaryLoading.set(true);
    this.cashService.getSessionSummary(sessionId)
      .pipe(finalize(() => this.isSummaryLoading.set(false)))
      .subscribe({
        next: (summary) => this.sessionSummary.set(summary),
        error: () => this.showError('Não foi possível carregar o resumo da sessão.')
      });
  }

  // ─── Chart.js dinâmico ────────────────────────────────────────────────────
  private loadChartJs(): void {
    if ((window as any).Chart) {
      this.chartJsLoaded = true;
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js';
    script.onload = () => { this.chartJsLoaded = true; };
    document.head.appendChild(script);
  }

  private destroyChart(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  renderChart(): void {
    if (!this.chartJsLoaded || !this.chartCanvas) return;

    const Chart = (window as any).Chart;
    const txs = this.transactions();
    if (!txs.length) return;

    // Agrupa por tipo
    const totals: Record<string, number> = {};
    for (const t of txs) {
      const label = this.getTypeLabel(t.type);
      totals[label] = (totals[label] || 0) + Math.abs(t.value);
    }

    const labels = Object.keys(totals);
    const data = Object.values(totals);

    const colors = [
      '#4ade80', '#f87171', '#60a5fa', '#fbbf24', '#a78bfa', '#34d399'
    ];

    this.destroyChart();

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    this.chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#1e293b'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#94a3b8',
              font: { size: 13 },
              padding: 20
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const val = ctx.parsed as number;
                return ` ${ctx.label}: ${this.formatCurrency(val)}`;
              }
            }
          }
        }
      }
    });
  }

  // ─── Exportar CSV ─────────────────────────────────────────────────────────
  exportCsv(): void {
    const txs = this.transactions();
    if (!txs.length) {
      this.showError('Nenhuma movimentação para exportar.');
      return;
    }

    const header = ['Data/Hora', 'Tipo', 'Descrição', 'Método', 'Valor (R$)'];
    const rows = txs.map(t => [
      new Date(t.timestamp).toLocaleString('pt-BR'),
      this.getTypeLabel(t.type),
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.methodName || '',
      t.value.toFixed(2).replace('.', ',')
    ]);

    const csv = [header, ...rows].map(r => r.join(';')).join('\n');
    const bom = '\uFEFF'; // UTF-8 BOM for Excel
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const sessionId = this.cashService.activeSessionId();
    a.href = url;
    a.download = `caixa-sessao-${sessionId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    this.showSuccess('✅ CSV exportado com sucesso!');
  }

  // ─── Existentes ───────────────────────────────────────────────────────────
  onConfirmCashOpen(initialValue: number): void {
    if (initialValue < 0) {
      this.showError('O valor inicial não pode ser negativo');
      return;
    }

    this.isLoading.set(true);
    const request: OpenSessionRequest = { value: initialValue };

    this.cashService.openCashRegister(request)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
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
      description: this.movementObservation() || 'Movimentação manual'
    };

    this.cashService.createManualTransaction(sessionId, request)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: () => {
          this.showSuccess('✅ Movimentação registrada!');
          this.resetMovementForm();
          this.loadTransactions();
          this.loadSummary();
        },
        error: (err) => this.showError(err.error?.message || 'Erro na transação')
      });
  }

  onConfirmCashClosing(event: { counts: { paymentMethodId: number; reportedValue: number }[] }): void {
    const sessionId = this.cashService.activeSessionId();
    if (!sessionId) {
      this.showError('Sessão não encontrada');
      return;
    }

    this.isLoading.set(true);

    const request: CloseSessionRequest = { reportedPayments: event.counts };

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

  private loadTransactions(): void {
    const sessionId = this.cashService.activeSessionId();
    if (!sessionId) return;

    this.isLoading.set(true);
    this.cashService.getMovementsBySession(sessionId)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data: CashMovementResponse[]) => {
          this.transactions.set(data);
          if (this.activeTab() === 'chart') {
            setTimeout(() => this.renderChart(), 50);
          }
        },
        error: () => this.showError('Não foi possível carregar as movimentações.')
      });
  }

  private resetMovementForm(): void {
    this.movementValue.set(0);
    this.movementObservation.set('');
    this.showMovementForm.set(false);
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
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

  formatDate(date: string | Date | undefined): string {
    if (!date) return '---';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }

  onModalConfirm(event: any): void {
    if (typeof event === 'number') {
      this.onConfirmCashOpen(event);
      return;
    }
    if (event?.type === 'CLOSING') {
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

  updateCount(methodId: number, event: any): void {
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

  private showSuccess(msg: string): void {
    this.snackBar.open(msg, 'OK', { duration: 3000, panelClass: ['success-snack'] });
  }

  private showError(msg: string): void {
    this.snackBar.open(msg, 'OK', { duration: 5000, panelClass: ['error-snack'] });
  }
}