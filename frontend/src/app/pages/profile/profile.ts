import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
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
  // La app corre sin zone.js, así que hay que pedir el repintado a mano
  // después de cada respuesta asíncrona (mismo patrón que el resto de páginas).
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.loadUserProfile();
  }

  loadUserProfile(): void {
    // Se parte de lo que ya hay en sesión para que el formulario no se vea
    // vacío mientras responde el servidor.
    const cached = this.auth.getCurrentUser();
    if (cached) {
      this.user = {
        full_name: cached.full_name || '',
        email:     cached.email     || '',
        phone:     cached.phone     || '',
        cedula:    cached.cedula    || ''
      };
      this.cdr.detectChanges();
    }

    this.auth.verifySession().subscribe({
      next: (data: any) => {
        if (data.authenticated && data.user) {
          this.user = {
            full_name: data.user.full_name || '',
            email: data.user.email || '',
            phone: data.user.phone || '',
            cedula: data.user.cedula || ''
          };
          this.cdr.detectChanges();
        }
      },
      error: () => {
        if (!cached) {
          this.message = 'No se pudieron cargar tus datos. Recarga la página.';
          this.messageType = 'error';
          this.cdr.detectChanges();
        }
      }
    });
  }

updateProfile(): void {
    this.loading = true;
    this.message = '';
    this.cdr.detectChanges();

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
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        this.message = err?.error?.message || 'Error de conexión';
        this.messageType = 'error';
        this.cdr.detectChanges();
      }
    });
  }
}