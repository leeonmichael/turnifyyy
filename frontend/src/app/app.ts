import { Component, signal, OnInit, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { Navbar } from './components/navbar/navbar';
import { Footer } from './components/footer/footer';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('frontend');
  showNavbar = true;
  showFooter = true;
  userRole: string = 'client';
  router = inject(Router);

  routesWithoutLayout = ['/login', '/register'];

  ngOnInit(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        const url = this.router.url;
        this.showNavbar = !this.routesWithoutLayout.includes(url);
        this.showFooter = !this.routesWithoutLayout.includes(url);
        
        const role = localStorage.getItem('turnify_role');
        this.userRole = role || 'client';
      });
  }
}
