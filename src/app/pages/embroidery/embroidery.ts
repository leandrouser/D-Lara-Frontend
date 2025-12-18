import { Component, inject, signal, computed, OnInit, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { debounceTime, distinctUntilChanged, Subject, switchMap, tap } from 'rxjs';
import { EmbroideryService, EmbroideryResponse, EmbroiderySearchField } from '../../core/service/embroidery.service';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { EmbroideryModal } from '../../shared/models/embroidery/embroidery-modal';


@Component({
  selector: 'app-embroidery',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule, MatDialogModule],
  templateUrl: './embroidery.html',
  styleUrls: ['./embroidery.scss']
})
export class Embroidery implements OnInit {
  private embroideryService = inject(EmbroideryService);
  private dialog = inject(MatDialog);
  private searchSubject = new Subject<void>();

  // --- ESTADO DA TELA ---
  embroideries = signal<EmbroideryResponse[]>([]);
  totalEmbroideryCount = signal<number>(0);
  currentPage = signal<number>(0);
  pageSize = signal<number>(10);
  searchText = signal<string>('');
  searchField = signal<EmbroiderySearchField | null>(EmbroiderySearchField.CUSTOMER_NAME);
  loading = signal<boolean>(false);

  totalPages = computed(() => Math.ceil(this.totalEmbroideryCount() / this.pageSize()));

  searchFields = Object.values(EmbroiderySearchField);
    
  // --- LIFECYCLE E INICIALIZAÇÃO ---

  ngOnInit(): void {
    this.setupSearch();
    this.loadEmbroidery();
  }

  // Configura o debounce para a busca
  setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      tap(() => this.loadEmbroidery()),
    ).subscribe();
  }

  onSearchChange(): void {
    if (this.currentPage() !== 0) {
      this.currentPage.set(0); 
    }
    this.searchSubject.next();
  }

  // --- LÓGICA DE CARREGAMENTO DE DADOS ---

  loadEmbroidery(): void {
    this.loading.set(true);
      this.embroideryService.searchEmbroidery(
        this.searchText() || '',
        this.currentPage(),
        this.pageSize(),
        this.searchField(),
      ).subscribe({
        next: (response) => {
          this.embroideries.set(response.content);
          this.totalEmbroideryCount.set(response.totalElements);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Erro ao carregar bordados:', err);
          this.loading.set(false);
        }
      });
    } 

  // --- AÇÕES NA TABELA ---

  // Abre o modal de criação/edição
  openCreateDialog(embroideryToEdit?: EmbroideryResponse): void {
    const dialogRef = this.dialog.open(EmbroideryModal, { 
        width: '600px',
        disableClose: true // Não permite fechar clicando fora
    });

    // Recarrega a lista se o modal for fechado com sucesso (result === true)
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadEmbroidery();
      }
    });
}
  
  edit(embroidery: EmbroideryResponse): void {
    this.openCreateDialog(embroidery);
  }
  
  delete(id: number): void {
    if (confirm('Tem certeza que deseja excluir este bordado?')) {
      this.embroideryService.deleteEmbroidery(id).subscribe({
        next: () => {
          alert('Bordado excluído com sucesso.');
          this.loadEmbroidery();
        },
        error: (err) => console.error('Erro ao deletar:', err)
      });
    }
  }

  // --- LÓGICA AUXILIAR ---
  
  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  }

  getSearchLabel(field: EmbroiderySearchField | null): string {
    if (!field) return 'campo';
    const labels = {
      [EmbroiderySearchField.ID]: 'ID do Bordado',
      [EmbroiderySearchField.CUSTOMER_ID]: 'ID do Cliente',
      [EmbroiderySearchField.CUSTOMER_NAME]: 'Nome do Cliente',
      [EmbroiderySearchField.PHONE]: 'Telefone',
    };
    return labels[field] || 'campo';
  }

  // --- LÓGICA DE PAGINAÇÃO ---

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages()) {
      this.currentPage.set(page);
      this.loadEmbroidery();
    }
  }

  onSearch(): void {
    this.currentPage.set(0); // Reset para primeira página ao pesquisar
    this.loadEmbroidery();
  }

  onPageSizeChange(eventValue: string): void {
    const newSize = parseInt(eventValue, 10);
    if (this.pageSize() !== newSize) {
      this.pageSize.set(newSize);
      this.currentPage.set(0);
      this.loadEmbroidery();      
    }
  }
  
  onPageChange(event: any): void {
    this.currentPage.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadEmbroidery();
  }
  
  clearSearch(): void {
    this.searchText.set('');
    this.searchField.set(EmbroiderySearchField.CUSTOMER_NAME);
    this.currentPage.set(0);
    this.loadEmbroidery();
  }
}