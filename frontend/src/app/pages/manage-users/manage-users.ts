import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { filter } from 'rxjs';

@Component({
  selector: 'app-manage-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manage-users.html',
  styleUrl: './manage-users.css'
})
export class ManageUsers implements OnInit {
  users: any[] = [];
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const role = this.auth.getCurrentRole();
    if (!role) {
      this.router.navigate(['/login']);
    }
    this.loadUsers();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      if (event.urlAfterRedirects.includes('/manage-users')) {
        this.loadUsers();
      }
    });
  }

  loadUsers(): void {
    this.loading = true;
    fetch('/api/users/', {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('turnify_token') || ''}`
      }
    })
    .then(res => res.json())
    .then(data => {
      this.loading = false;
      this.users = data.users || [];
    })
    .catch(() => {
      this.loading = false;
      this.users = [];
    });
  }

  deleteUser(username: string): void {
    if (confirm('¿Eliminar usuario ' + username + '?')) {
      fetch('/api/delete-user/' + username + '/', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('turnify_token') || ''}`
        }
      })
      .then(() => this.loadUsers())
      .catch(() => alert('Error al eliminar'));
    }
  }
}