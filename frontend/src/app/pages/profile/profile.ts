import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile implements OnInit {
  user: any = {
    full_name: '',
    email: '',
    phone: '',
    cedula: ''
  };
  loading = false;
  message = '';
  messageType = '';
  auth = inject(AuthService);

  ngOnInit(): void {
    this.loadUserProfile();
  }

  loadUserProfile(): void {
    this.auth.verifySession().subscribe({
      next: (data: any) => {
        if (data.authenticated) {
          this.user = {
            full_name: data.user?.full_name || '',
            email: data.user?.email || '',
            phone: data.user?.phone || '',
            cedula: data.user?.cedula || ''
          };
        }
      },
      error: () => {}
    });
  }

updateProfile(): void {
    this.loading = true;
    this.message = '';

    // Solo correo y teléfono son editables — la cédula y el nombre son
    // datos únicos/identificativos y no se envían aunque estén en el modelo.
    this.auth.updateProfile({ email: this.user.email, phone: this.user.phone }).subscribe({
      next: (data: any) => {
        this.loading = false;
        if (data.success) {
          this.message = 'Perfil actualizado correctamente';
          this.messageType = 'success';
        } else {
          this.message = data.message || 'Error al actualizar el perfil';
          this.messageType = 'error';
        }
      },
      error: (err: any) => {
        this.loading = false;
        this.message = err?.error?.message || 'Error de conexión';
        this.messageType = 'error';
      }
    });
  }
}