import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import type { DocumentStatusEvent } from '@tech-docs/shared';
import { Observable, Subject } from 'rxjs';

const EVENTS_URL = '/api/events/documents';
const MAX_REMEMBERED_EVENTS = 500;

/**
 * Canal SSE único para toda la app.
 * - EventSource se reconecta solo; al reconectar se emite reconnected$ para re-sincronizar.
 * - Recuerda los últimos eventos: resuelve la carrera en la que el documento se indexa
 *   antes de que llegue la respuesta HTTP del upload.
 */
@Injectable({ providedIn: 'root' })
export class DocumentEvents {
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly events = new Subject<DocumentStatusEvent>();
  private readonly reconnections = new Subject<void>();
  private readonly tracked = new Set<string>();
  private readonly latest = new Map<string, DocumentStatusEvent>();
  private source: EventSource | null = null;

  readonly connected = signal(false);
  readonly events$: Observable<DocumentStatusEvent> = this.events.asObservable();
  readonly reconnected$: Observable<void> = this.reconnections.asObservable();

  connect(): void {
    if (this.source) return;
    let connectionLost = false;

    this.source = new EventSource(EVENTS_URL);
    this.source.onopen = () => {
      this.connected.set(true);
      if (connectionLost) {
        connectionLost = false;
        this.reconnections.next();
      }
    };
    this.source.onerror = () => {
      this.connected.set(false);
      connectionLost = true;
    };
    this.source.addEventListener('document-status', (message) => {
      const event = JSON.parse((message as MessageEvent<string>).data) as DocumentStatusEvent;
      this.remember(event);
      this.events.next(event);
      if (this.tracked.has(event.documentId)) this.notify(event);
    });
  }

  /** Marca un documento como "mío" para notificarlo. Devuelve su último estado conocido, si llegó antes. */
  track(documentId: string): DocumentStatusEvent | undefined {
    this.tracked.add(documentId);
    const known = this.latest.get(documentId);
    if (known) this.notify(known);
    return known;
  }

  private remember(event: DocumentStatusEvent): void {
    this.latest.set(event.documentId, event);
    if (this.latest.size > MAX_REMEMBERED_EVENTS) {
      const oldest = this.latest.keys().next().value;
      if (oldest) this.latest.delete(oldest);
    }
  }

  private notify(event: DocumentStatusEvent): void {
    if (event.status === 'INDEXADO') {
      this.snackBar
        .open(`"${event.title}" ya está indexado y disponible`, 'Ver', { duration: 6000 })
        .onAction()
        .subscribe(() => void this.router.navigate(['/documents', event.documentId]));
    } else if (event.status === 'ERROR') {
      this.snackBar.open(
        `Error al procesar "${event.title}": ${event.errorMessage ?? 'error desconocido'}`,
        'Cerrar',
        { duration: 8000, panelClass: 'snack-error' },
      );
    }
  }
}
