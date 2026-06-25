import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EmbroideryResponse } from '../../../core/service/embroidery.service';
import { BrlCurrencyPipe } from '../../../shared/pipes/brl-currency.pipe';

@Component({
  selector: 'app-embroidery-kanban',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, BrlCurrencyPipe],
  templateUrl: './embroidery-kanban.component.html',
  styleUrls: ['./embroidery-kanban.component.scss']
})
export class EmbroideryKanbanComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() items: EmbroideryResponse[] = [];
  @Input() loading = false;

  @Output() markReady     = new EventEmitter<EmbroideryResponse>();
  @Output() markInProduction = new EventEmitter<EmbroideryResponse>();
  @Output() markDelivered = new EventEmitter<EmbroideryResponse>();
  @Output() edit          = new EventEmitter<EmbroideryResponse>();
  @Output() remove        = new EventEmitter<number>();
  @Output() revertStatus = new EventEmitter<{ item: EmbroideryResponse, status: string }>();

  @ViewChild('kbCols') kbColsRef!: ElementRef<HTMLDivElement>;

  // Navegação do carrossel mobile
  activeColumnIndex = signal(0);
  readonly totalColumns = 4;
  readonly columnLabels = ['Pendente', 'Em Produção', 'Pronto p/ entrega', 'Entregue'];

  private sortByDelivery(items: EmbroideryResponse[]): EmbroideryResponse[] {
    return [...items].sort((a, b) => {
      if (!a.deliveryDate) return 1;
      if (!b.deliveryDate) return -1;
      return new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime();
    });
  }

  get pending()      { return this.sortByDelivery(this.items.filter(e => e.status === 'PENDING')); }
  get inProduction() { return this.sortByDelivery(this.items.filter(e => e.status === 'IN_PRODUCTION')); }
  get processing()   { return this.sortByDelivery(this.items.filter(e => e.status === 'PROCESSING')); }
  get completed() {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  return this.items.filter(e => {
    if (e.status !== 'COMPLETED') return false;
    if (!e.deliveredAt) return true;
    return new Date(e.deliveredAt) >= oneWeekAgo;
  });
}

  isOverdue(dateStr: string): boolean {
    if (!dateStr) return false;
    const delivery = new Date(dateStr + 'T00:00:00');
    const today    = new Date();
    today.setHours(0, 0, 0, 0);
    return delivery < today;
  }

  getPreviousStatus(status: string): string | null {
    const map: Record<string, string> = {
      'IN_PRODUCTION': 'PENDING',
      'PROCESSING':    'IN_PRODUCTION',
      'COMPLETED':     'PROCESSING'
    };
    return map[status] ?? null;
  }

  getPreviousLabel(status: string): string {
    const map: Record<string, string> = {
      'IN_PRODUCTION': 'Voltar para Pendente',
      'PROCESSING':    'Voltar para Em Produção',
      'COMPLETED':     'Voltar para Pronto'
    };
    return map[status] ?? '';
  }

  // ===================== Carrossel mobile =====================

  ngAfterViewInit(): void {
    this.kbColsRef?.nativeElement.addEventListener('scroll', this.onScroll, { passive: true });
  }

  ngOnDestroy(): void {
    this.kbColsRef?.nativeElement.removeEventListener('scroll', this.onScroll);
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Se os itens mudarem (ex: após mover um card), o conteúdo da coluna ativa
    // pode encolher; não precisamos resetar o índice, só evitar ficar fora do range.
    if (changes['items'] && this.activeColumnIndex() > this.totalColumns - 1) {
      this.activeColumnIndex.set(this.totalColumns - 1);
    }
  }

  private onScroll = (): void => {
    const el = this.kbColsRef?.nativeElement;
    if (!el) return;
    const colWidth = el.clientWidth;
    if (!colWidth) return;
    const index = Math.round(el.scrollLeft / colWidth);
    if (index !== this.activeColumnIndex()) {
      this.activeColumnIndex.set(index);
    }
  };

  goToColumn(index: number): void {
    const el = this.kbColsRef?.nativeElement;
    if (!el) return;
    const clamped = Math.max(0, Math.min(index, this.totalColumns - 1));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
    this.activeColumnIndex.set(clamped);
  }

  prevColumn(): void { this.goToColumn(this.activeColumnIndex() - 1); }
  nextColumn(): void { this.goToColumn(this.activeColumnIndex() + 1); }

  isFirstColumn(): boolean { return this.activeColumnIndex() === 0; }
  isLastColumn(): boolean  { return this.activeColumnIndex() === this.totalColumns - 1; }

  getColumnLabel(index: number): string {
    return this.columnLabels[index] ?? '';
  }
}