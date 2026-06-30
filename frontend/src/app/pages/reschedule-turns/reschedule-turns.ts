import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { TurnService } from '../../services/turn.service';
import { AuthService } from '../../services/auth.service';
import { filter } from 'rxjs';

@Component({
  selector: 'app-reschedule-turns',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reschedule-turns.html',
  styleUrl: './reschedule-turns.css'
})
export class RescheduleTurns implements OnInit {
  turns: any[] = [];
  loading = false;

  constructor(
    private turn: TurnService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const role = this.auth.getCurrentRole();
    if (!role) {
      this.router.navigate(['/login']);
    }
    this.loadTurns();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      if (event.urlAfterRedirects.includes('/reschedule-turns')) {
        this.loadTurns();
      }
    });
  }

  loadTurns(): void {
    this.loading = true;
    this.turn.getAllTurns().subscribe({
      next: (data: any) => {
        this.loading = false;
        this.turns = (data.turns || []).filter((t: any) => t.status === 'waiting' || t.status === 'called');
      },
      error: () => {
        this.loading = false;
        this.turns = [];
      }
    });
  }

  rescheduleTurn(turnNumber: string): void {
    if (confirm('¿Reagendar este turno? El turno volverá al final de la cola.')) {
      this.turn.rescheduleSpecificTurn(turnNumber).subscribe({
        next: (data: any) => {
          if (data.success) {
            this.loadTurns();
          } else {
            alert(data.message || 'Error al reagendar');
          }
        },
        error: () => alert('Error al reagendar')
      });
    }
  }
}
