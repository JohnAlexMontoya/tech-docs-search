import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DocumentEvents } from './core/realtime/document-events';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatIconModule],
  template: `
    <mat-toolbar class="toolbar">
      <a routerLink="/" class="brand"><mat-icon>description</mat-icon> Tech Docs Search</a>
      <span class="spacer"></span>
      <a mat-button routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
        <mat-icon>search</mat-icon> Buscar
      </a>
      <a mat-button routerLink="/upload" routerLinkActive="active">
        <mat-icon>upload</mat-icon> Cargar
      </a>
      <span class="live" [class.live-on]="events.connected()">
        {{ events.connected() ? 'En vivo' : 'Reconectando…' }}
      </span>
    </mat-toolbar>
    <main class="container">
      <router-outlet />
    </main>
  `,
  styles: `
    .toolbar { position: sticky; top: 0; z-index: 10; background: #fff; border-bottom: 1px solid var(--app-border); gap: 4px; }
    .brand { display: flex; align-items: center; gap: 8px; font-weight: 600; color: var(--app-accent); text-decoration: none; }
    .spacer { flex: 1; }
    .active { background: #eef1fb; }
    .live { font-size: .75rem; margin-left: 12px; padding: 2px 10px; border-radius: 999px; background: #fde7e7; color: #a4262c; }
    .live::before { content: '●'; margin-right: 6px; }
    .live-on { background: #e3f6e8; color: #1b6b35; }
    @media (max-width: 600px) { .live { display: none; } }
  `,
})
export class App {
  protected readonly events = inject(DocumentEvents);

  constructor() {
    this.events.connect();
  }
}
