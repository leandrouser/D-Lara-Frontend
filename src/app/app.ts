import { Component, signal, OnInit, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Sidebar } from './core/sidebar/sidebar';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, Sidebar],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements OnInit {
  
  private router = inject(Router);

  // Signals de controle do layout
  sidebarCollapsed = signal(false);
  sidebarOpen = signal(false);
  
  // ✅ NOVO: Signal para saber se é a página de login
  isLoginPage = signal(false);

  ngOnInit() {
    // Monitora as mudanças de rota
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd) // Filtra apenas quando a navegação termina
    ).subscribe((event: any) => {
      // Verifica se a URL final contém '/login'
      const isLogin = event.urlAfterRedirects.includes('/login');
      this.isLoginPage.set(isLogin);
    });
  }

  onSidebarCollapsedChange(collapsed: boolean) {
    this.sidebarCollapsed.set(collapsed);
  }

  onSidebarOpenChange(open: boolean) {
    this.sidebarOpen.set(open);
  }
}