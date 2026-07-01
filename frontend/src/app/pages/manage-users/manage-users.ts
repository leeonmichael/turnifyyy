import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-manage-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manage-users.html',
  styleUrl: './manage-users.css'
})
export class ManageUsers implements OnInit, OnDestroy {
  users: any[] = [];
  loading = false;
  errorMessage = '';
  private destroy$ = new Subject<void>();

  constructor(
    private auth: AuthService,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const role = this.auth.getCurrentRole();
    if (!role) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadUsers();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((event: NavigationEnd) => {
      if (event.urlAfterRedirects.includes('/manage-users')) {
        this.loadUsers();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getHeaders(): HttpHeaders {
    const token = this.auth.getToken() || localStorage.getItem('turnify_token') || '';
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  loadUsers(): void {
    this.loading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();
    this.http.get('/api/users/', { headers: this.getHeaders() }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data: any) => {
        this.loading = false;
        this.users = (data.users || []).filter((u: any) => u.role === 'client');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || `Error ${err?.status || ''}: no se pudieron cargar los usuarios`;
        console.error('Error loading users:', err);
        this.users = [];
        this.cdr.detectChanges();
      }
    });
  }

  toggleUserActive(username: string, isActive: boolean): void {
    this.http.post('/api/toggle-user-active/' + username + '/', {}, { headers: this.getHeaders() }).subscribe({
      next: (data: any) => {
        if (data.success) {
          const user = this.users.find(u => u.username === username);
          if (user) user.is_active = data.is_active;
        } else {
          alert(data.message || 'Error al cambiar estado del usuario');
        }
      },
      error: () => alert('Error al cambiar estado del usuario')
    });
  }

  deleteUser(username: string): void {
    this.http.delete('/api/delete-user/' + username + '/', { headers: this.getHeaders() }).subscribe({
      next: () => this.loadUsers(),
      error: () => alert('Error al eliminar usuario')
    });
  }
}
