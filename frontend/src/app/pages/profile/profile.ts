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

    fetch('/api/update-profile/', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': this.getCookie('csrftoken') || ''
      },
      body: JSON.stringify(this.user)
    })
    .then(res => res.json())
    .then(data => {
      this.loading = false;
      if (data.success) {
        this.message = 'Perfil actualizado correctamente';
        this.messageType = 'success';
      } else {
        this.message = data.message || 'Error al actualizar el perfil';
        this.messageType = 'error';
      }
    })
    .catch(() => {
      this.loading = false;
      this.message = 'Error de conexión';
      this.messageType = 'error';
    });
  }

  getCookie(name: string): string | null {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }
}