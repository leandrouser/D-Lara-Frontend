import {
  Component, inject, OnInit, OnDestroy, signal, computed, effect, ViewChild, ElementRef, AfterViewInit, untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import {
  CashService, OpenSessionRequest,
  CloseSessionRequest, CashMovementResponse, CashSummaryResponse,
  CashSessionResponse, CashMovementUpdateRequest,
  MethodComparisonDTO
} from '../../core/service/cash.service';
import { CashModalComponent } from "../../shared/models/cash/cash-modal.component";
import { PaymentService } from '../../core/service/payment.service';
import { AuthService } from '../../core/service/auth.service';

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
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  @ViewChild(CashModalComponent) cashModal!: CashModalComponent;
  @ViewChild('movementsChart') chartCanvas!: ElementRef<HTMLCanvasElement>;

  isCashOpen = computed(() => this.cashService.isCashOpen());

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

  sessionSummary = signal<CashSummaryResponse | null>(null);
  isSummaryLoading = signal(false);
  activeTab = signal<'movements' | 'summary' | 'chart' | 'review' | 'reports'>('movements');

  reviewSessions = signal<CashSessionResponse[]>([]);
  selectedReviewSession = signal<CashSessionResponse | null>(null);
  reviewMovements = signal<CashMovementResponse[]>([]);
  reviewSummary = signal<CashSummaryResponse | null>(null);
  isReviewLoading = signal(false);
  reviewObservation = signal('');
  editingMovementId = signal<number | null>(null);
  movementDraft = signal<CashMovementUpdateRequest>({
    value: 0,
    type: 'SUPPLEMENT',
    description: '',
    paymentMethodId: null
  });

  reportDateFrom = signal('');
  reportDateTo = signal('');
  reportSessions = signal<CashSessionResponse[]>([]);
  reportMovements = signal<CashMovementResponse[]>([]);
  isReportLoading = signal(false);

  verifiedAmounts = signal<Record<number, number>>({});
  reviewDetails = signal<MethodComparisonDTO[]>([]);
  reviewedSessions = signal<CashSessionResponse[]>([]);
  selectedReviewedSession = signal<CashSessionResponse | null>(null);
  reviewedDetails = signal<MethodComparisonDTO[]>([]);
  reviewedMovements = signal<CashMovementResponse[]>([]);
  reviewedSummary = signal<CashSummaryResponse | null>(null);
  isReviewedLoading = signal(false);
  showReviewed = signal(false);
  selectedReportSession = signal<CashSessionResponse | null>(null);

  reviewedPage = signal(0);
  reviewedTotalPages = signal(0);
  reviewedPageSize = 10;

  private chartInstance: any = null;
  private chartJsLoaded = false;

  constructor() {
    effect(() => {
      const id = this.cashService.activeSessionId();
      untracked(() => {
        if (id) {
          if (this.isAdmin()) {
            this.loadTransactions();
            this.loadSummary();
            if (['review', 'reports'].includes(this.activeTab())) {
              this.activeTab.set('movements');
            }
          }
        } else {
          this.transactions.set([]);
          this.sessionSummary.set(null);
          if (this.isAdmin()) {
            this.activeTab.set('review');
            this.loadReviewSessions();
          }
        }
      });
    });

    effect(() => {
      const tab = this.activeTab();
      untracked(() => {
        if (tab === 'chart') {
          setTimeout(() => this.renderChart(), 50);
        }
        if (tab === 'review' && this.isAdmin()) {
          this.loadReviewSessions();
          this.loadReviewedSessions();
        }
      });
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

  selectReportSession(session: CashSessionResponse): void {
    this.selectedReportSession.set(session);
    this.isReportLoading.set(true);
    this.cashService.getMovementReport({ sessionId: session.id })
      .pipe(finalize(() => this.isReportLoading.set(false)))
      .subscribe({
        next: (movements) => this.reportMovements.set(movements),
        error: () => this.showError('Não foi possível carregar os lançamentos.')
      });
  }

  renderChart(): void {
    if (!this.chartJsLoaded || !this.chartCanvas) return;

    const Chart = (window as any).Chart;
    const txs = this.transactions();
    if (!txs.length) return;

    const totals: Record<string, number> = {};
    for (const t of txs) {
      const label = this.getTypeLabel(t.type);
      totals[label] = (totals[label] || 0) + Math.abs(t.value);
    }

    const labels = Object.keys(totals);
    const data = Object.values(totals);
    const colors = ['#4ade80', '#f87171', '#60a5fa', '#fbbf24', '#a78bfa', '#34d399'];

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

  loadReviewSessions(): void {
    if (!this.isAdmin()) return;
    this.isReviewLoading.set(true);
    this.cashService.getSessionsForReview({}, 0, 100)
      .pipe(finalize(() => this.isReviewLoading.set(false)))
      .subscribe({
        next: (page) => {
          this.reviewSessions.set(page.content);
          const selected = this.selectedReviewSession();
          if (selected && !page.content.some(s => s.id === selected.id)) {
            this.clearReviewSelection();
          }
        },
        error: () => this.showError('Não foi possível carregar os caixas pendentes de conferência.')
      });
  }

  loadReviewedSessions(): void {
    if (!this.isAdmin()) return;
    this.isReviewedLoading.set(true);
    this.cashService.getSessionsForReview(
      { status: 'REVIEWED', reviewStatus: 'APPROVED' },
      this.reviewedPage(),
      this.reviewedPageSize
    )
      .pipe(finalize(() => this.isReviewedLoading.set(false)))
      .subscribe({
        next: (page) => {
          this.reviewedSessions.set(page.content);
          this.reviewedTotalPages.set(page.totalPages);
        },
        error: () => this.showError('Não foi possível carregar os caixas conferidos.')
      });
  }

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
    const bom = '\uFEFF';
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

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

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
          this.cashService.checkExistingSession();
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

  selectReviewSession(session: CashSessionResponse): void {
    this.selectedReviewSession.set(session);
    this.editingMovementId.set(null);
    this.isReviewLoading.set(true);

    this.cashService.getSessionReview(session.id)
      .pipe(finalize(() => this.isReviewLoading.set(false)))
      .subscribe({
        next: (review) => {
          this.selectedReviewSession.set(review.session);
          this.reviewSummary.set(review.summary);
          this.reviewMovements.set(review.movements);
          this.reviewDetails.set(review.details ?? []);
          const verified: Record<number, number> = {};
            review.details?.forEach(d => {
              if (d.verifiedAmount != null) {
                verified[d.paymentMethodId] = d.verifiedAmount;
              }
            });
            this.verifiedAmounts.set(verified);
        },
        error: () => this.showError('Não foi possível carregar a conferência desta sessão.')
      });
  }

  selectReviewedSession(session: CashSessionResponse): void {
    this.selectedReviewedSession.set(session);
    this.isReviewedLoading.set(true);
    this.cashService.getSessionReview(session.id)
      .pipe(finalize(() => this.isReviewedLoading.set(false)))
      .subscribe({
        next: (review) => {
          this.selectedReviewedSession.set(review.session);
          this.reviewedSummary.set(review.summary);
          this.reviewedMovements.set(review.movements);
          this.reviewedDetails.set(review.details ?? []);
        },
        error: () => this.showError('Não foi possível carregar os detalhes.')
      });
  }

  goToReviewedPage(page: number): void {
    this.reviewedPage.set(page);
    this.loadReviewedSessions();
  }

  startEditMovement(movement: CashMovementResponse): void {
    this.editingMovementId.set(movement.id);
    this.movementDraft.set({
      value: Math.abs(movement.value),
      type: movement.type,
      description: movement.description,
      paymentMethodId: null
    });
  }

  cancelEditMovement(): void {
    this.editingMovementId.set(null);
  }

  saveMovementEdit(movement: CashMovementResponse): void {
    const session = this.selectedReviewSession();
    const draft = this.movementDraft();
    if (!session) return;

    if (draft.value <= 0) {
      this.showError('O valor do lançamento deve ser maior que zero.');
      return;
    }

    this.isReviewLoading.set(true);
    this.cashService.updateMovement(session.id, movement.id, draft)
      .pipe(finalize(() => this.isReviewLoading.set(false)))
      .subscribe({
        next: () => {
          this.showSuccess('Lançamento ajustado.');
          this.editingMovementId.set(null);
          this.selectReviewSession(session);
        },
        error: (err) => this.showError(err.error?.message || 'Não foi possível ajustar o lançamento.')
      });
  }

  confirmReview(): void {
    const session = this.selectedReviewSession();
    if (!session) return;

    if (!confirm('Confirmar fechamento definitivo desta sessão?')) return;

    this.isReviewLoading.set(true);
    this.cashService.confirmSessionReview(session.id, { observation: this.reviewObservation() })
      .pipe(finalize(() => this.isReviewLoading.set(false)))
      .subscribe({
        next: () => {
          this.showSuccess('Caixa conferido e fechado definitivamente.');
          this.clearReviewSelection();
          this.loadReviewSessions();
        },
        error: (err) => this.showError(err.error?.message || 'Não foi possível confirmar a conferência.')
      });
  }

  forceReview(): void {
    this.activeTab.set('review');
    this.loadReviewSessions();
    this.loadReviewedSessions();
  }

  loadReports(): void {
    if (!this.isAdmin()) return;

    this.isReportLoading.set(true);
    this.selectedReportSession.set(null);
    this.reportMovements.set([]);

    const filter = {
      dateFrom: this.reportDateFrom(),
      dateTo: this.reportDateTo()
    };

    this.cashService.getSessionReport(filter)
      .pipe(finalize(() => this.isReportLoading.set(false)))
      .subscribe({
        next: (sessions) => this.reportSessions.set(sessions),
        error: () => this.showError('Não foi possível carregar o relatório de sessões.')
      });
  }

  exportSessionsReportCsv(): void {
    const rows = this.reportSessions();
    if (!rows.length) {
      this.showError('Nenhuma sessão para exportar.');
      return;
    }

    const header = ['Sessão', 'Operador', 'Abertura', 'Fechamento', 'Status', 'Conferência', 'Inicial', 'Entradas', 'Saídas', 'Saldo'];
    const csvRows = rows.map(session => [
      session.id,
      this.csvCell(session.userName),
      this.csvCell(this.formatDateTime(session.openedAt)),
      this.csvCell(this.formatDateTime(session.closedAt)),
      session.status,
      session.reviewStatus || '',
      this.formatNumber(session.initialValue),
      this.formatNumber(session.totalIncomes),
      this.formatNumber(session.totalExpenses),
      this.formatNumber(session.finalBalance)
    ]);

    this.downloadCsv('relatorio-sessoes-caixa', [header, ...csvRows]);
  }

  exportMovementsReportCsv(): void {
    const rows = this.reportMovements();
    if (!rows.length) {
      this.showError('Nenhum lançamento para exportar.');
      return;
    }

    const header = ['Sessão', 'Data/Hora', 'Tipo', 'Descrição', 'Método', 'Valor'];
    const csvRows = rows.map(movement => [
      movement.sessionId,
      this.csvCell(this.formatDateTime(movement.timestamp)),
      this.csvCell(this.getTypeLabel(movement.type)),
      this.csvCell(movement.description || ''),
      this.csvCell(movement.methodName || ''),
      this.formatNumber(movement.value)
    ]);

    this.downloadCsv('relatorio-lancamentos-caixa', [header, ...csvRows]);
  }

  private clearReviewSelection(): void {
    this.selectedReviewSession.set(null);
    this.reviewMovements.set([]);
    this.reviewSummary.set(null);
    this.reviewObservation.set('');
    this.editingMovementId.set(null);
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

  getReviewStatusLabel(session: CashSessionResponse): string {
    const labels: Record<string, string> = {
      PENDING_REVIEW: 'Pendente',
      UNDER_REVIEW: 'Em conferência',
      ADJUSTED: 'Ajustado',
      APPROVED: 'Conferido',
      OPEN: 'Aberta',
      CLOSED: 'Fechada',
      REVIEWED: 'Conferida'
    };
    return labels[session.reviewStatus || session.status] || session.status;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  formatDate(date: string | Date | undefined): string {
    if (!date) return '---';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    }).format(new Date(date));
  }

  formatDateTime(date: string | Date | undefined): string {
    if (!date) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(date));
  }

  updateMovementDraft(key: keyof CashMovementUpdateRequest, value: any): void {
    this.movementDraft.update(current => ({ ...current, [key]: value }));
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
    } else if (this.isClosingModalOpen()) {
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

  private downloadCsv(fileName: string, rows: Array<Array<string | number>>): void {
    const csv = rows.map(row => row.join(';')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showSuccess('CSV exportado com sucesso.');
  }

  private csvCell(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private formatNumber(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }

  updateVerifiedAmount(paymentMethodId: number, value: number): void {
    this.verifiedAmounts.update(current => ({ ...current, [paymentMethodId]: value }));
  }

  saveVerification(paymentMethodId: number): void {
    const session = this.selectedReviewSession();
    if (!session) return;

    const amount = this.verifiedAmounts()[paymentMethodId];
    if (amount == null) return;

    this.cashService.verifyMethod(session.id, paymentMethodId, amount)
      .subscribe({
        next: () => this.showSuccess('Valor conferido salvo.'),
        error: () => this.showError('Não foi possível salvar o valor conferido.')
      });
  }

  isOperator(): boolean {
    return this.authService.isOperator();
  }
}