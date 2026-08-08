import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [NgIf, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login implements OnInit {
  username = '';
  password = '';
  error = '';
  loading = false;
  showPassword = false;

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.auth.isAuthenticated()) {
      this.navigateByRole(this.auth.getCurrentRole());
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  navigateByRole(role: string | null): void {
    if (role === 'client') {
      this.router.navigate(['/home']);
    } else if (role === 'employee') {
      this.router.navigate(['/employee']);
    } else if (role === 'admin') {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  onSubmit(): void {
    if (!this.username || !this.password) {
      this.error = 'Por favor ingrese usuario y contraseña';
      return;
    }

    this.loading = true;
    this.error = '';

    this.auth.login(this.username, this.password).subscribe({
      next: (data: any) => {
        this.loading = false;
        if (data.success) {
          this.auth.setSession(data.token, data.user);
          this.navigateByRole(data.user.role);
        } else {
          this.error = data.message || 'Credenciales inválidas';
        }
      },
      error: (err: any) => {
        this.loading = false;
        const msg = err?.error?.message || 'Error de conexión. Intente nuevamente.';
        this.error = msg;
      }
    });
  }
}
