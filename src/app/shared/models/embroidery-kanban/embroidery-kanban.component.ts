import { Component, Input, Output, EventEmitter } from '@angular/core';
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
export class EmbroideryKanbanComponent {
  @Input() items: EmbroideryResponse[] = [];
  @Input() loading = false;

  @Output() markReady     = new EventEmitter<EmbroideryResponse>();
  @Output() markInProduction = new EventEmitter<EmbroideryResponse>();
  @Output() markDelivered = new EventEmitter<EmbroideryResponse>();
  @Output() edit          = new EventEmitter<EmbroideryResponse>();
  @Output() remove        = new EventEmitter<number>();
  @Output() revertStatus = new EventEmitter<{ item: EmbroideryResponse, status: string }>();

  get pending()    { return this.items.filter(e => e.status === 'PENDING');    }
  get inProduction() { return this.items.filter(e => e.status === 'IN_PRODUCTION'); }
  get processing() { return this.items.filter(e => e.status === 'PROCESSING'); }
  get completed()  { return this.items.filter(e => e.status === 'COMPLETED');  }

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
}