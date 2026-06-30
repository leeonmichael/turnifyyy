import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TurnService } from '../../services/turn.service';

@Component({
  selector: 'app-my-turns',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-turns.html',
  styleUrl: './my-turns.css'
})
export class MyTurns implements OnInit {
  turns: any[] = [];
  loading = false;

  constructor(private turn: TurnService) {}

  ngOnInit(): void {
    this.loadMyTurns();
  }

  loadMyTurns(): void {
    this.loading = true;
    let currentUsername = '';
    const userStr = localStorage.getItem('turnify_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        currentUsername = user.username || '';
      } catch {}
    }
    
    this.turn.getAllTurns().subscribe({
      next: (data: any) => {
        this.loading = false;
        this.turns = (data.turns || []).filter((t: any) => {
          return (t.client_data && t.client_data.username) === currentUsername;
        });
      },
      error: () => {
        this.loading = false;
        this.turns = [];
      }
    });
  }

  cancelTurn(turnNumber: string): void {
    if (confirm('¿Cancelar este turno?')) {
      this.turn.cancelCurrent().subscribe({
        next: () => this.loadMyTurns(),
        error: () => alert('Error al cancelar')
      });
    }
  }
}