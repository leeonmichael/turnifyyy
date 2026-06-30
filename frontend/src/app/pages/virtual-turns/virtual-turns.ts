import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { TurnService } from '../../services/turn.service';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs';

@Component({
  selector: 'app-virtual-turns',
  standalone: true,
  imports: [NgIf, NgFor, FormsModule],
  templateUrl: './virtual-turns.html',
  styleUrl: './virtual-turns.css'
})
export class VirtualTurns implements OnInit {
  turns: any[] = [];
  filteredTurns: any[] = [];
  filterSede = '';
  sedes: string[] = [];
  loading = false;

  constructor(
    private turn: TurnService,
    private auth: AuthService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    const role = this.auth.getCurrentRole();
    if (!role) {
      this.router.navigate(['/login']);
    }
    this.loadData();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      if (event.urlAfterRedirects.includes('/virtual-turns')) {
        this.loadData();
      }
    });
  }

  loadData(): void {
    this.loading = true;
    this.http.get(`${this.turn.getBaseUrl()}/sedes/`).subscribe({
      next: (data: any) => {
        this.sedes = (data.sedes || []).map((s: any) => s.name);
      },
      error: () => this.sedes = []
    });

    this.turn.getAllTurns().subscribe({
      next: (data: any) => {
        this.turns = (data.turns || []).filter((t: any) => t.service_type === 'virtual');
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.filteredTurns = this.turns.filter((t: any) => {
      if (this.filterSede && t.sede !== this.filterSede) return false;
      return true;
    });
  }

  attendVirtual(turn_number: string): void {
    this.turn.callSpecific(turn_number).subscribe({
      next: (data: any) => {
        if (data.success) {
          this.loadData();
        } else {
          alert(data.message || 'Error al atender turno virtual');
        }
      },
      error: () => alert('Error al atender turno virtual')
    });
  }
}