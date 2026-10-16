import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environment.prod";
import { Page } from "./customer.service";

export interface AuditLogResponse {
  id: number;
  operator: {
    id: number;
    userName: string;
  };
  action: string;
  entityName: string;
  entityId: number;
  oldValue: string | null;
  newValue: string | null;
  timestamp: string;
  ipAddress: string | null;
  observation: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/audit`;

  getLogs(page: number, size: number, operatorId?: number, entity?: string) {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (operatorId) params = params.set('operatorId', operatorId.toString());
    if (entity) params = params.set('entity', entity);

    return this.http.get<Page<AuditLogResponse>>(this.apiUrl, { params });
  }
}
