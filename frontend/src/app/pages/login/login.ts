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
      this.navigateByRole(this.auth.getCurrentUser());
      return;
    }
    if (history.state?.sessionExpired) {
      this.error = 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.';
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  navigateByRole(user: any): void {
    const role = user?.role;
    if (role === 'client') {
      this.router.navigate(['/home']);
    } else if (role === 'employee') {
      // El empleado especializado en turnos virtuales (sede_id='VIRTUAL')
      // solo tiene acceso a esa interfaz, no al panel presencial.
      this.router.navigate([user?.sede_id === 'VIRTUAL' ? '/virtual-turns' : '/employee']);
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
          this.navigateByRole(data.user);
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
