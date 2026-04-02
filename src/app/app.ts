import { Component, signal, OnInit, inject, ViewChild } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Sidebar } from './core/sidebar/sidebar';
import { filter } from 'rxjs/operators';
import { MatIcon } from "@angular/material/icon";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, Sidebar, MatIcon],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements OnInit {

  private router = inject(Router);

  @ViewChild('sidebar') sidebar!: Sidebar;

  sidebarCollapsed = signal(false);
  sidebarOpen = signal(false);
  isLoginPage = signal(false);

  ngOnInit() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const isLogin = event.urlAfterRedirects.includes('/login');
      this.isLoginPage.set(isLogin);
    });
  }

  // método intermediário — evita acessar sidebar antes de existir
  toggleMobileSidebar() {
    if (this.sidebar) {
      this.sidebar.toggleMobile();
    }
  }

  onSidebarCollapsedChange(collapsed: boolean) {
    this.sidebarCollapsed.set(collapsed);
  }

  onSidebarOpenChange(open: boolean) {
    this.sidebarOpen.set(open); // <-- já sincroniza o signal local
  }
}
