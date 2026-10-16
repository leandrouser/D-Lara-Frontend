import { CommonModule } from "@angular/common";
import { Component, inject, OnInit, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatIconModule } from "@angular/material/icon";
import { AuditLogResponse, AuditService } from "../../core/service/audit.service";

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './audit-log.html',
  styleUrls: ['./audit-log.scss']
})
export class AuditLogComponent implements OnInit {
  private auditService = inject(AuditService);

  logs = signal<AuditLogResponse[]>([]);
  isLoading = signal(false);

  operatorFilter = signal('');
  entityFilter = signal('all');
  currentPage = signal(0);

  ngOnInit() {
    this.loadLogs();
  }

  loadLogs() {
    this.isLoading.set(true);
    this.auditService.getLogs(
      this.currentPage(),
      20,
      this.operatorFilter() ? Number(this.operatorFilter()) : undefined,
      this.entityFilter() === 'all' ? undefined : this.entityFilter()
    ).subscribe({
      next: (res) => {
        this.logs.set(res.content);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }
}
