import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TurnService } from '../../services/turn.service';
import { WebsocketService } from '../../services/websocket.service';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

declare var Chart: any;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit, OnDestroy {
  turns: any[] = [];
  currentTurn: any = null;
  nextTurn: string = 'NO HAY';
  waitingTurns = 0;
  totalTurns = 0;
  completedToday = 0;
  totalUsers = 0;
  employees: any[] = [];
  
   empUsername = '';
   empPassword = '';
   empFullName = '';
   empDocumentType = 'CC';
   empCedula = '';
   empEmail = '';
   empPhone = '';
   empCargo = 'Empleado';
   empEntidad = 'EPS';
   empSede = '';

   sedes: any[] = [];
   newSedeName = '';
   newSedeCity = '';
   newSedeAddress = '';
   editingSede: any = null;
   showSedeForm = false;

   editingEmployee: any = null;
   showEditForm = false;

  statusChart: any;
  serviceChart: any;
  dailyChart: any;
  hourlyChart: any;
  usersChart: any;
  topServicesChart: any;

  stats: any = {
    total_users: 0,
    total_clients: 0,
    total_employees: 0,
    turns_today: 0,
    turns_active: 0,
    turns_attended: 0,
    turns_cancelled: 0,
    turns_presenciales: 0,
    turns_virtuales: 0,
    avg_attention_time: 0,
    avg_wait_time: 0,
    peak_hours: [],
    top_services: [],
    top_entities: [],
    pending_documents: 0,
    approved_documents: 0,
    rejected_documents: 0
  };

   private intervalId: any;
   private destroy$ = new Subject<void>();

  constructor(
    private auth: AuthService,
    private turn: TurnService,
    private http: HttpClient,
    private ws: WebsocketService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

   ngOnInit(): void {
    if (!this.auth.isAuthenticated() || this.auth.getCurrentRole() !== 'admin') {
      this.auth.clearSession();
      this.router.navigate(['/login']);
      return;
    }

    this.ws.messages$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (msg) => {
        if (Array.isArray(msg)) {
          this.turns = msg;
          this.currentTurn = this.turns.find((t: any) => t.status === 'called');
          const next = this.turns.find((t: any) => t.status === 'waiting');
          this.nextTurn = next?.number || 'NO HAY';
          this.cdr.detectChanges();
        }
      }
    });

    if (!this.ws.isConnected()) {
      this.ws.connect();
    }
    this.ws.send({ action: 'get_all' });

    setTimeout(() => this.initCharts(), 100);
    this.loadAllData();
    this.intervalId = setInterval(() => this.loadAllData(), 20000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  initCharts(): void {
    if (typeof Chart === 'undefined') return;

    const statusCtx = document.getElementById('statusChart');
    if (statusCtx) {
      this.statusChart = new Chart(statusCtx, {
        type: 'doughnut',
        data: { labels: ['Esperando', 'Llamando', 'Completados'], datasets: [{ data: [0, 0, 0], backgroundColor: ['#f39c12', '#e74c3c', '#27ae60'] }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }

    const serviceCtx = document.getElementById('serviceChart');
    if (serviceCtx) {
      this.serviceChart = new Chart(serviceCtx, {
        type: 'pie',
        data: { labels: ['General', 'Preferencial', 'Emergencia', 'VIP', 'Virtual'], datasets: [{ data: [0, 0, 0, 0, 0], backgroundColor: ['#3498db', '#9b59b6', '#e74c3c', '#f1c40f', '#1abc9c'] }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }

    const dailyCtx = document.getElementById('dailyChart');
    if (dailyCtx) {
      this.dailyChart = new Chart(dailyCtx, {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Turnos', data: [], borderColor: '#667eea', backgroundColor: 'rgba(102,126,234,0.1)', fill: true, tension: 0.4 }] },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
      });
    }

    const hourlyCtx = document.getElementById('hourlyChart');
    if (hourlyCtx) {
      this.hourlyChart = new Chart(hourlyCtx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Turnos', data: [], backgroundColor: '#00f2fe' }] },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
      });
    }

    const usersCtx = document.getElementById('usersChart');
    if (usersCtx) {
      this.usersChart = new Chart(usersCtx, {
        type: 'doughnut',
        data: { labels: ['Clientes', 'Empleados'], datasets: [{ data: [0, 0], backgroundColor: ['#3498db', '#e74c3c'] }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      });
    }

    const topServicesCtx = document.getElementById('topServicesChart');
    if (topServicesCtx) {
      this.topServicesChart = new Chart(topServicesCtx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Cantidad', data: [], backgroundColor: ['#3498db', '#9b59b6', '#e74c3c', '#f1c40f', '#1abc9c'] }] },
        options: { responsive: true, indexAxis: 'y', scales: { x: { beginAtZero: true } } }
      });
    }
  }

  loadAllData(): void {
    this.turn.getAdminStatistics().subscribe({
      next: (data: any) => {
        this.stats = data;
        this.updateCharts(data);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading stats:', err);
        this.cdr.detectChanges();
      }
    });

    this.turn.getEmployees().subscribe({
      next: (data: any) => {
        this.employees = data.employees || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading employees:', err);
        this.cdr.detectChanges();
      }
    });

    this.http.get(`${this.turn.getBaseUrl()}/sedes/`).subscribe({
      next: (data: any) => {
        this.sedes = data.sedes || [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.sedes = [];
        this.cdr.detectChanges();
      }
    });
  }

  updateCharts(data: any): void {
    if (this.statusChart && data) {
      const waiting = data.turns_today - (data.turns_active + data.turns_attended + data.turns_cancelled);
      this.statusChart.data.datasets[0].data = [Math.max(0, waiting), data.turns_active, data.turns_attended];
      this.statusChart.update();
    }

    if (this.serviceChart && data.service_stats) {
      const s = data.service_stats;
      this.serviceChart.data.datasets[0].data = [
        s.general || 0,
        s.preferencial || 0,
        s.emergency || 0,
        s.vip || 0,
        s.virtual || 0
      ];
      this.serviceChart.update();
    }

    if (this.usersChart && data) {
      this.usersChart.data.datasets[0].data = [data.total_clients || 0, data.total_employees || 0];
      this.usersChart.update();
    }

    if (this.hourlyChart && data.peak_hours) {
      this.hourlyChart.data.labels = data.peak_hours.map((h: any) => h.hour);
      this.hourlyChart.data.datasets[0].data = data.peak_hours.map((h: any) => h.count);
      this.hourlyChart.update();
    }

    if (this.dailyChart && data.last_7_days) {
      this.dailyChart.data.labels = data.last_7_days.map((d: any) => d.date.slice(5));
      this.dailyChart.data.datasets[0].data = data.last_7_days.map((d: any) => d.turns);
      this.dailyChart.update();
    }

    if (this.topServicesChart && data.top_services) {
      this.topServicesChart.data.labels = data.top_services.map((s: any) => s.service_type);
      this.topServicesChart.data.datasets[0].data = data.top_services.map((s: any) => s.count);
      this.topServicesChart.update();
    }
  }

  createEmployee(): void {
    if (!this.empUsername || !this.empPassword || !this.empFullName) {
      alert('Complete todos los campos requeridos');
      return;
    }
    if (this.empPassword.length < 4) {
      alert('La contraseña debe tener mínimo 4 caracteres');
      return;
    }

    this.http.post(`${this.turn.getBaseUrl()}/create-employee/`, {
      username: this.empUsername,
      password: this.empPassword,
      full_name: this.empFullName,
      document_type: this.empDocumentType,
      cedula: this.empCedula,
      email: this.empEmail,
      phone: this.empPhone,
      sede_id: this.empSede
    }).subscribe({
      next: (data: any) => {
        if (data.success) {
          this.empUsername = '';
          this.empPassword = '';
          this.empFullName = '';
          this.empDocumentType = 'CC';
          this.empCedula = '';
          this.empEmail = '';
          this.empPhone = '';
          this.empCargo = 'Empleado';
          this.empEntidad = 'EPS';
          this.empSede = '';
          this.loadAllData();
        } else {
          alert(data.message || 'Error al crear empleado');
        }
      },
      error: (err) => alert(err?.error?.message || 'Error al crear empleado')
    });
  }

  editEmployee(emp: any): void {
    this.editingEmployee = { ...emp };
    this.showEditForm = true;
  }

  saveEdit(): void {
    if (!this.editingEmployee) return;
    const payload: any = { ...this.editingEmployee };
    if (payload.new_password) {
      payload.password = payload.new_password;
      delete payload.new_password;
    } else {
      delete payload.password;
    }
    this.http.post(`${this.turn.getBaseUrl()}/update-employee/${payload.username}/`, payload).subscribe({
      next: (data: any) => {
        if (data.success) {
          this.showEditForm = false;
          this.editingEmployee = null;
          this.loadAllData();
        } else {
          alert(data.message || 'Error al actualizar empleado');
        }
      },
      error: (err) => alert(err?.error?.message || 'Error al actualizar empleado')
    });
  }

  cancelEdit(): void {
    this.showEditForm = false;
    this.editingEmployee = null;
  }

  deleteEmployee(username: string): void {
    this.http.post(`${this.turn.getBaseUrl()}/deactivate-employee/${username}/`, {}).subscribe({
      next: (data: any) => {
        if (data.success) {
          this.loadAllData();
        } else {
          alert(data.message);
        }
      },
      error: (err) => alert(err?.error?.message || 'Error al desactivar empleado')
    });
  }

  activateEmployee(username: string): void {
    this.http.post(`${this.turn.getBaseUrl()}/toggle-user-active/${username}/`, {}).subscribe({
      next: (data: any) => {
        if (data.success) {
          this.loadAllData();
        } else {
          alert(data.message);
        }
      },
      error: (err) => alert(err?.error?.message || 'Error al activar empleado')
    });
  }

  exportCSV(): void {
    this.turn.exportCSV();
  }

  exportExcel(): void {
    this.turn.exportExcel();
  }

  logout(): void {
    this.auth.clearSession();
    this.auth.logout().subscribe();
    this.router.navigate(['/login']);
  }

  createSede(): void {
    if (!this.newSedeName) {
      alert('Ingrese el nombre de la sede');
      return;
    }
    this.http.post(`${this.turn.getBaseUrl()}/sedes/create/`, {
      name: this.newSedeName,
      city: this.newSedeCity,
      address: this.newSedeAddress
    }).subscribe({
      next: (data: any) => {
        if (data.success) {
          this.newSedeName = '';
          this.newSedeCity = '';
          this.newSedeAddress = '';
          this.loadAllData();
        } else {
          alert(data.message || 'Error al crear sede');
        }
      },
      error: (err) => alert(err?.error?.message || 'Error al crear sede')
    });
  }

  editSede(sede: any): void {
    this.editingSede = { ...sede };
    this.showSedeForm = true;
  }

  cancelSedeEdit(): void {
    this.showSedeForm = false;
    this.editingSede = null;
  }

  saveSedeEdit(): void {
    if (!this.editingSede) return;
    this.http.post(`${this.turn.getBaseUrl()}/sedes/update/${this.editingSede.id}/`, this.editingSede).subscribe({
      next: (data: any) => {
        if (data.success) {
          this.editingSede = null;
          this.showSedeForm = false;
          this.loadAllData();
        } else {
          alert(data.message || 'Error al actualizar sede');
        }
      },
      error: (err) => alert(err?.error?.message || 'Error al actualizar sede')
    });
  }

  deleteSede(id: number): void {
    if (confirm('¿Eliminar sede?')) {
      this.http.delete(`${this.turn.getBaseUrl()}/sedes/delete/${id}/`).subscribe({
        next: (data: any) => {
          if (data.success) {
            this.loadAllData();
          } else {
            alert(data.message);
          }
        },
        error: (err) => alert(err?.error?.message || 'Error al eliminar sede')
      });
    }
  }
}
