import { Component, Input, OnInit, inject } from '@angular/core';
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
export class Navbar implements OnInit {
  @Input() role: string = 'client';
  currentUser: any = null;
  router = inject(Router);
  auth = inject(AuthService);

  ngOnInit(): void {
    this.currentUser = this.auth.getCurrentUser();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  isClient(): boolean {
    return this.role === 'client';
  }

  isEmployee(): boolean {
    return this.role === 'employee';
  }

  isAdmin(): boolean {
    return this.role === 'admin';
  }
}