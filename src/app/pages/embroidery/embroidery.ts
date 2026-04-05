import { Component, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { EmbroideryResponse, EmbroideryService } from '../../core/service/embroidery.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EmbroideryModal } from '../../shared/models/embroidery/embroidery-modal';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BrlCurrencyPipe } from '../../shared/pipes/brl-currency.pipe';

export type StatusFilter = 'PENDING' | 'PROCESSING' | 'COMPLETED';

@Component({
  selector: 'app-embroidery',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule, MatTableModule,
    MatPaginatorModule, MatInputModule, MatButtonModule, MatIconModule,
    MatTooltipModule, BrlCurrencyPipe
  ],
  templateUrl: './embroidery.html',
  styleUrls: ['./embroidery.scss']
})
export class Embroidery implements OnInit {

  dataSource    = signal<EmbroideryResponse[]>([]);
  searchControl = new FormControl('');
  totalElements = signal(0);
  currentPage   = signal(0);
  pageSize      = signal(5);
  loading       = signal(false);
  activeFilter  = signal<StatusFilter>('PENDING');

  totalPages = computed(() => Math.ceil(this.totalElements() / this.pageSize()));

  pendingCount    = signal(0);
  processingCount = signal(0);
  completedCount  = signal(0);
  overdueCount    = signal(0);
  todayCount      = signal(0);
  totalRevenue    = signal(0);
  pendingRevenue  = signal(0);

  constructor(
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private embroideryService: EmbroideryService
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.loadGlobalMetrics();

    this.searchControl.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentPage.set(0);
      this.loadData();
    });
  }

  loadData() {
    this.loading.set(true);
    const term   = (this.searchControl.value || '').trim();
    const status = this.activeFilter();

    this.embroideryService.search(term, status, this.currentPage(), this.pageSize()).subscribe({
      next: (response) => {
        this.dataSource.set([...response.content]);
        this.totalElements.set(response.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.showError('Falha ao conectar com o servidor.');
        this.loading.set(false);
        this.dataSource.set([]);
      }
    });
  }

  loadGlobalMetrics() {
    this.embroideryService.getMetrics().subscribe({
      next: (metrics) => {
        this.pendingCount.set(metrics.totalPending);
        this.processingCount.set(metrics.totalProcessing);
        this.completedCount.set(metrics.totalCompleted);
        this.overdueCount.set(metrics.overdueCount);
        this.todayCount.set(metrics.todayDeliveries);
        this.totalRevenue.set(metrics.totalRevenue);
        this.pendingRevenue.set(metrics.pendingRevenue);
      },
      error: (err) => console.error('Erro ao carregar métricas:', err)
    });
  }

  setFilter(status: StatusFilter) {
    this.activeFilter.set(status);
    this.currentPage.set(0);
    this.loadData();
  }

  handlePageEvent(e: PageEvent) {
    this.currentPage.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
    this.loadData();
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages()) {
      this.currentPage.set(page);
      this.loadData();
    }
  }

  changePage(delta: number): void { this.goToPage(this.currentPage() + delta); }

  getStartIndex(): number {
    return this.totalElements() === 0 ? 0 : (this.currentPage() * this.pageSize()) + 1;
  }

  getEndIndex(): number {
    const last = (this.currentPage() + 1) * this.pageSize();
    return last > this.totalElements() ? this.totalElements() : last;
  }

  markAsReady(embroidery: EmbroideryResponse) {
    if (!confirm(`Confirmar que o bordado #${embroidery.id} está pronto para entrega?`)) return;

    this.loading.set(true);
    this.embroideryService.updateStatus(embroidery.id, 'PROCESSING').subscribe({
      next: () => {
        this.showSuccess(`Bordado #${embroidery.id} marcado como Pronto!`);
        this.loadData();
        this.loadGlobalMetrics();
      },
      error: () => {
        this.showError('Erro ao atualizar status.');
        this.loading.set(false);
      }
    });
  }

  markAsDelivered(embroidery: EmbroideryResponse) {
    if (!confirm(`Confirmar entrega do bordado #${embroidery.id} para ${embroidery.customerName}?`)) return;

    this.loading.set(true);
    this.embroideryService.updateStatus(embroidery.id, 'COMPLETED').subscribe({
      next: () => {
        this.showSuccess(`Bordado #${embroidery.id} entregue com sucesso!`);
        this.loadData();
        this.loadGlobalMetrics();
      },
      error: () => {
        this.showError('Erro ao atualizar status.');
        this.loading.set(false);
      }
    });
  }

  openModal(data?: EmbroideryResponse): void {
    const dialogRef = this.dialog.open(EmbroideryModal, {
      width: '600px', data, disableClose: true
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) { this.loadData(); this.loadGlobalMetrics(); }
    });
  }

  delete(id: number): void {
    if (confirm('Deseja realmente excluir este bordado?')) {
      this.embroideryService.delete(id).subscribe(() => {
        this.showSuccess('Bordado excluído!');
        this.loadData();
        this.loadGlobalMetrics();
      });
    }
  }

  isOverdue(dateStr: string): boolean {
    if (!dateStr) return false;
    const delivery = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return delivery < today;
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING:    'Pendente',
      PROCESSING: 'Pronto',
      COMPLETED:  'Entregue',
      CANCELED:   'Cancelado'
    };
    return map[status] ?? status;
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      PENDING:    'status-pending',
      PROCESSING: 'status-processing',
      COMPLETED:  'status-completed',
      CANCELED:   'status-canceled'
    };
    return map[status] ?? '';
  }

  getStatusIcon(status: string): string {
    const map: Record<string, string> = {
      PENDING:    'schedule',
      PROCESSING: 'done',
      COMPLETED:  'check_circle',
      CANCELED:   'cancel'
    };
    return map[status] ?? 'help';
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: 3000, panelClass: ['success-snackbar'],
      horizontalPosition: 'end', verticalPosition: 'top'
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Fechar', {
      duration: 4000, panelClass: ['error-snackbar'],
      horizontalPosition: 'end', verticalPosition: 'top'
    });
  }
}
