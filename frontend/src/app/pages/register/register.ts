import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [NgIf, FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register implements OnInit {
  username = '';
  password = '';
  confirm_password = '';
  full_name = '';
  document_type = 'CC';
  cedula = '';
  email = '';
  phone = '';
  accept_terms = false;

  showSuccess = false;
  error = '';
  errorField = '';
  loading = false;

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    setTimeout(() => {
      const el = document.getElementById('error-container');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }

  onSubmit(): void {
    this.error = '';
    this.errorField = '';

    if (!this.username) {
      this.error = 'El nombre de usuario es requerido';
      this.errorField = 'username';
      this.focusError();
      return;
    }
    if (this.username.length < 3) {
      this.error = 'El usuario debe tener mínimo 3 caracteres';
      this.errorField = 'username';
      this.focusError();
      return;
    }

    if (!this.password) {
      this.error = 'La contraseña es requerida';
      this.errorField = 'password';
      this.focusError();
      return;
    }
    // Reglas: 6-8 caracteres, 1 letra, 1 número y 1 símbolo.
    const pwd = this.password;
    const pwdPattern = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{6,8}$/;

    if (!pwdPattern.test(pwd)) {
      this.error = 'La contraseña debe tener 6-8 caracteres e incluir al menos 1 letra, 1 número y 1 símbolo';
      this.errorField = 'password';
      this.focusError();
      return;
    }


    if (!this.confirm_password) {
      this.error = 'Confirme su contraseña';
      this.errorField = 'confirm_password';
      this.focusError();
      return;
    }
    if (this.password !== this.confirm_password) {
      this.error = 'Las contraseñas no coinciden';
      this.errorField = 'confirm_password';
      this.focusError();
      return;
    }

    if (!this.full_name) {
      this.error = 'El nombre completo es requerido';
      this.errorField = 'full_name';
      this.focusError();
      return;
    }

    if (!this.cedula) {
      this.error = 'El número de documento es requerido';
      this.errorField = 'cedula';
      this.focusError();
      return;
    }
    if (!this.cedula.match(/^\d+$/)) {
      this.error = 'El documento debe contener solo números';
      this.errorField = 'cedula';
      this.focusError();
      return;
    }
    if (this.cedula.length < 10) {
      this.error = 'El documento debe tener mínimo 10 dígitos';
      this.errorField = 'cedula';
      this.focusError();
      return;
    }

    if (!this.email) {
      this.error = 'El correo electrónico es requerido';
      this.errorField = 'email';
      this.focusError();
      return;
    }
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(this.email)) {
      this.error = 'Ingrese un correo electrónico válido';
      this.errorField = 'email';
      this.focusError();
      return;
    }

    if (!this.phone) {
      this.error = 'El teléfono es requerido';
      this.errorField = 'phone';
      this.focusError();
      return;
    }
    if (!this.phone.match(/^\d+$/)) {
      this.error = 'El teléfono debe contener solo números';
      this.errorField = 'phone';
      this.focusError();
      return;
    }
    if (this.phone.length < 10) {
      this.error = 'El teléfono debe tener mínimo 10 dígitos';
      this.errorField = 'phone';
      this.focusError();
      return;
    }

    if (!this.accept_terms) {
      this.error = 'Debe aceptar términos y condiciones';
      this.errorField = 'accept_terms';
      this.focusError();
      return;
    }

    this.loading = true;
    this.error = '';

    this.auth.register({
      username: this.username,
      password: this.password,
      confirm_password: this.confirm_password,
      full_name: this.full_name,
      document_type: this.document_type,
      cedula: this.cedula,
      email: this.email,
      phone: this.phone,
      accept_terms: this.accept_terms,
      role: 'client'
    }).subscribe({
      next: (data: any) => {
        this.loading = false;
        if (data.success) {
          this.showSuccess = true;
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setTimeout(() => this.router.navigate(['/login']), 2000);
        } else {
          this.error = data.message;
          this.errorField = data.field || '';
          this.focusError();
          this.scrollToTop();
        }
      },

      error: (err: any) => {
        this.loading = false;
        const msg = err?.error?.message || 'Error de conexión. Intente nuevamente.';
        this.error = msg;
        this.errorField = err?.error?.field || '';
        this.focusError();
      }
    });
  }

  private focusError(): void {
    // No hacemos scroll para evitar que el navegador “recorte” el layout mientras escribes.
    // Solo enfocamos visualmente el contenedor del error.
    setTimeout(() => {
      const el = document.getElementById('error-container');
      if (el) {
        try {
          (el as HTMLElement).focus?.();
        } catch {
          // ignore
        }
      }
    }, 50);
  }


  private scrollToTop(): void {
    // Asegura que el usuario vea la tarjeta completa tras fallos/success.
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  }

}
