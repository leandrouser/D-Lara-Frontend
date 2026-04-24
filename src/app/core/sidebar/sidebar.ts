import { Component, EventEmitter, HostListener, Output, signal, OnInit, inject, computed } from '@angular/core';
import { RouterLinkActive, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/service/auth.service';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  // ✅ PaymentMethodDialog REMOVIDO dos imports estáticos
  imports: [CommonModule, RouterModule, RouterLinkActive, MatIconModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss'],
  host: {
    '[class.collapsed]': 'collapsed()',
    '[class.open]': 'open()'
  }
})
export class Sidebar implements OnInit {
  public authService = inject(AuthService);
  private dialog = inject(MatDialog);

  collapsed = signal(false);
  open = signal(false);

  @Output() collapsedChange = new EventEmitter<boolean>();
  @Output() openChange = new EventEmitter<boolean>();

  isMobileScreen = signal(window.innerWidth <= 768);

  user = this.authService.currentUser;
  userName = computed(() => this.user()?.name || 'Visitante');
  userInitial = computed(() => {
    const name = this.userName();
    return name ? name.charAt(0).toUpperCase() : '?';
  });

  private hideTimeout: any;

  isMobile(): boolean {
    return this.isMobileScreen();
  }

  toggleSidebar() {
    if (this.isMobile()) {
      this.toggleMobile();
    } else {
      const state = !this.collapsed();
      this.collapsed.set(state);
      this.collapsedChange.emit(state);
    }
  }

  toggleMobile() {
    const state = !this.open();
    this.open.set(state);
    this.openChange.emit(state);
  }

  ngOnInit() {
    this.checkScreenSize();
    if (!this.isMobile()) {
      this.startAutoHide();
    }
  }

  @HostListener('window:resize')
  onResize() {
    this.isMobileScreen.set(window.innerWidth <= 768);
    this.checkScreenSize();
  }

  private checkScreenSize() {
    if (this.isMobile()) {
      this.collapsed.set(false);
    } else {
      this.open.set(false);
    }
  }

  onMouseEnterSidebar() {
    clearTimeout(this.hideTimeout);
    if (!this.isMobile() && this.collapsed()) {
      this.collapsed.set(false);
      this.collapsedChange.emit(false);
    }
  }

  onMouseLeaveSidebar() {
    if (!this.isMobile()) {
      this.startAutoHide();
    }
  }

  private startAutoHide() {
    clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => {
      if (!this.isMobile() && !this.collapsed()) {
        this.collapsed.set(true);
        this.collapsedChange.emit(true);
      }
    }, 5000);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    if (!this.isMobile() && e.clientX <= 10 && this.collapsed()) {
      this.collapsed.set(false);
      this.collapsedChange.emit(false);
      clearTimeout(this.hideTimeout);
    }
  }

  logout() {
    if (confirm('Deseja realmente sair do sistema?')) {
      this.authService.logout();
    }
  }

  // ✅ Lazy import — carrega o módulo do dialog apenas quando chamado
  async openConfig() {
    const { PaymentMethodDialog } = await import(
      '../../shared/models/payment/payment-method-dialog/payment-method-dialog'
    );

    const dialogRef = this.dialog.open(PaymentMethodDialog, {
      width: '400px',
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        console.log('Método salvo com sucesso!');
      }
    });
  }
}