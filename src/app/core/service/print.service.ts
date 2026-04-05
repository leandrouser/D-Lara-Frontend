import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CupomRequest {
  numeroVenda: number;
  dataHora: string;
  cliente: {
    nome: string;
    telefone: string;
  };
  itens: {
    sequencia: number;
    descricao: string;
    nomeBordado: string | null;
    quantidade: number;
    valorTotal: number;
  }[];
  subtotal: number;
  desconto: number;
  total: number;
  pagamentos: {
    forma: string;
    valor: number;
  }[];
  troco: number;
}

export interface FechamentoCaixaRequest {
  sessaoId: number;
  dataHora: string;
  detalhes: {
    metodoPagamento: string;
    valorSistema: number;
    valorInformado: number;
    diferenca: number;
  }[];
  totalSistema: number;
  totalInformado: number;
  totalDiferenca: number;
  totalDescontos: number;
}

@Injectable({ providedIn: 'root' })
export class PrintService {
  private http = inject(HttpClient);
  private printAgentUrl = 'http://localhost:9100';

  imprimir(cupom: CupomRequest): Observable<string> {
    return this.http.post(`${this.printAgentUrl}/imprimir`, cupom, { responseType: 'text' });
  }

  imprimirFechamento(fechamento: FechamentoCaixaRequest): Observable<string> {
    return this.http.post(`${this.printAgentUrl}/fechar-caixa`, fechamento, { responseType: 'text' });
  }
}
