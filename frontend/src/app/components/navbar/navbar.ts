import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar implements OnInit, OnDestroy {
  @Input() role: string = 'client';
  currentUser: any = null;
  router = inject(Router);
  auth = inject(AuthService);
  cdr = inject(ChangeDetectorRef);

  timer = '--:--:--';
  dateLabel = '';
  private clockInterval: any;

  ngOnInit(): void {
    this.currentUser = this.auth.getCurrentUser();

    this.updateClock();
    this.clockInterval = setInterval(() => {
      this.updateClock();
      this.cdr.detectChanges();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.clockInterval) clearInterval(this.clockInterval);
  }

  private updateClock(): void {
    const now = new Date();
    this.timer = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.dateLabel = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  logout(): void {
    this.auth.clearSession();
    this.auth.logout().subscribe({
      next: () => {},
      error: () => {}
    });
    this.router.navigate(['/login']);
  }

  isClient(): boolean {
    return this.role === 'client';
  }

  isEmployee(): boolean {
    return this.role === 'employee';
  }

  isVirtualEmployee(): boolean {
    return this.currentUser?.sede_id === 'VIRTUAL';
  }

  isAdmin(): boolean {
    return this.role === 'admin';
  }

  canManageUsers(): boolean {
    return this.role === 'employee' || this.role === 'admin';
  }
}