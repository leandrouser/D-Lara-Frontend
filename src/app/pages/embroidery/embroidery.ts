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

@Component({
  selector: 'app-embroidery',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatTableModule,
    MatPaginatorModule, MatInputModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './embroidery.html',
  styleUrls: ['./embroidery.scss']
})
export class Embroidery implements OnInit {

  displayedColumns: string[] = ['id', 'customerName', 'description', 'price', 'deliveryDate', 'actions'];
  dataSource = signal<EmbroideryResponse[]>([]);

  searchControl = new FormControl('');
  totalElements = signal(0);
  currentPage = signal(0);
  pageSize = signal(5);
  loading = signal(false);
  searchTerm = signal('');

  totalPages = computed(() => Math.ceil(this.totalElements() / this.pageSize()));

  pendingCount = signal(0);
  completedCount = signal(0);
  showDelivered = signal<boolean>(false);

  overdueCount = signal(0);
  todayCount = signal(0);
  totalRevenue = signal(0);
  pendingRevenue = signal(0);

  filteredDataSource = computed(() => {
    const list = [...this.dataSource()];
    const isFilteringDelivered = this.showDelivered();

    if (isFilteringDelivered) {
      return list.filter(item => item.status === 'COMPLETED');
    } else {
      return list
        .filter(item => item.status === 'PENDING')
        .sort((a, b) => {
          if (!a.deliveryDate || !b.deliveryDate) return 0;
          return new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime();
        });
    }
  });

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

    const term = (this.searchControl.value || '').trim();
    const page = this.currentPage();
    const size = this.pageSize();
    const status = this.showDelivered() ? 'COMPLETED' : 'PENDING';

    this.embroideryService.search(term, status, page, size).subscribe({
      next: (response) => {
        this.dataSource.set([...response.content]);
        this.totalElements.set(response.totalElements);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erro na requisição API:', err);
        this.showError('Falha ao conectar com o servidor.');
        this.loading.set(false);
        this.dataSource.set([]);
      }
    });
  }

  loadGlobalMetrics() {
  this.embroideryService.getMetrics().subscribe({
    next: (metrics) => {
      console.log('📊 Métricas carregadas em', metrics.lastUpdated);
      this.pendingCount.set(metrics.totalPending);
      this.completedCount.set(metrics.totalCompleted);
      this.overdueCount.set(metrics.overdueCount);
      this.todayCount.set(metrics.todayDeliveries);
      this.totalRevenue.set(metrics.totalRevenue);
      this.pendingRevenue.set(metrics.pendingRevenue);
    },
    error: (err) => console.error('Erro ao carregar métricas:', err)
  });
}

  toggleDelivered() {
    this.showDelivered.update(v => !v);
    this.currentPage.set(0);
    this.loadData();
  }

  handlePageEvent(e: PageEvent) {
    this.currentPage.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
    this.loadData();
  }

  calculateMetrics(items: EmbroideryResponse[]) {
    const todayStr = new Date().toISOString().split('T')[0];
    const pageOverdue = items.filter(i => this.isOverdue(i.deliveryDate)).length;
    const pageToday = items.filter(i => i.deliveryDate === todayStr).length;

    console.log('📄 Métricas da página atual:', {
      atrasados: pageOverdue,
      hoje: pageToday,
      total: items.length
    });
  }

  isOverdue(dateStr: string): boolean {
    if (!dateStr) return false;
    const delivery = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return delivery < today;
  }

  openModal(data?: EmbroideryResponse): void {
    const dialogRef = this.dialog.open(EmbroideryModal, {
      width: '600px',
      data: data,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadData();
        this.loadGlobalMetrics();
      }
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

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages()) {
      this.currentPage.set(page);
      this.loadData();
    }
  }

  changePage(delta: number): void {
    const nextPage = this.currentPage() + delta;
    if (nextPage >= 0 && nextPage < this.totalPages()) {
      this.goToPage(nextPage);
    }
  }

  getStartIndex(): number {
    return this.totalElements() === 0 ? 0 : (this.currentPage() * this.pageSize()) + 1;
  }

  getEndIndex(): number {
    const last = (this.currentPage() + 1) * this.pageSize();
    return last > this.totalElements() ? this.totalElements() : last;
  }

  markAsDelivered(embroidery: EmbroideryResponse) {
    const confirmacao = confirm(`Confirmar entrega do bordado #${embroidery.id} para ${embroidery.customerName}?`);

    if (confirmacao) {
      this.loading.set(true);
      this.embroideryService.updateStatus(embroidery.id, 'COMPLETED').subscribe({
        next: () => {
          this.showSuccess('Status atualizado para Entregue!');
          this.loadData();
          this.loadGlobalMetrics();
        },
        error: (err) => {
          console.error('❌ ERRO:', err);
          this.showError('Erro ao atualizar status');
          this.loading.set(false);
        }
      });
    }
  }

  refreshMetrics() {
    this.loadGlobalMetrics();
    this.showSuccess('Métricas atualizadas!');
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: 3000,
      panelClass: ['success-snackbar'],
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Fechar', {
      duration: 4000,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'end',
      verticalPosition: 'top'
    });
  }
}
