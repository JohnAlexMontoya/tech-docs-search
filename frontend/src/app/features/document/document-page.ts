import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { marked } from 'marked';
import { catchError, filter, map, merge, of, switchMap } from 'rxjs';
import { DocumentsApi } from '../../core/api/documents-api';
import { DocumentEvents } from '../../core/realtime/document-events';
import { formatSize } from '../../core/ui/format-size';
import { StatusChip } from '../../core/ui/status-chip';

@Component({
  selector: 'app-document-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, MatButtonModule, MatIconModule, MatProgressBarModule, StatusChip],
  template: `
    <section class="page">
      <div>
        <a mat-button routerLink="/" [queryParams]="q() ? { q: q() } : {}">
          <mat-icon>arrow_back</mat-icon> Volver a la búsqueda
        </a>
      </div>

      @if (state(); as s) {
        @if (s.document; as doc) {
          <article class="card">
            <header class="doc-header">
              <div>
                <h1>{{ doc.title }}</h1>
                <p class="muted">{{ doc.fileName }} · {{ formatSize(doc.sizeBytes) }}</p>
              </div>
              <app-status-chip [status]="doc.status" />
            </header>

            <dl class="meta">
              <div><dt>Autor</dt><dd>{{ doc.author }}</dd></div>
              <div><dt>Categoría</dt><dd>{{ doc.category }}</dd></div>
              <div><dt>Versión</dt><dd>{{ doc.version }}</dd></div>
              <div><dt>Cargado</dt><dd>{{ doc.createdAt | date: 'medium' }}</dd></div>
              <div><dt>Indexado</dt><dd>{{ doc.indexedAt ? (doc.indexedAt | date: 'medium') : '—' }}</dd></div>
            </dl>

            @if (doc.tags.length) {
              <div class="tags">
                @for (tag of doc.tags; track tag) {
                  <span class="tag">#{{ tag }}</span>
                }
              </div>
            }

            @if (doc.summary) {
              <section class="summary">
                <h2>Resumen</h2>
                <p>{{ doc.summary }}</p>
                @if (doc.keywords.length) {
                  <div class="keywords">
                    <span class="muted">Palabras clave:</span>
                    @for (keyword of doc.keywords; track keyword) {
                      <span class="keyword">{{ keyword }}</span>
                    }
                  </div>
                }
              </section>
            }

            @if (doc.errorMessage) {
              <p class="error">{{ doc.errorMessage }}</p>
            }
          </article>

          <article class="card content">
            @if (markdownHtml(); as html) {
              <div class="markdown" [innerHTML]="html"></div>
            } @else if (doc.body) {
              <pre class="plain">{{ doc.body }}</pre>
            } @else {
              <p class="muted">El contenido estará disponible cuando termine el procesamiento.</p>
            }
          </article>
        } @else {
          <div class="empty">
            <mat-icon>error_outline</mat-icon>
            <p>{{ s.error }}</p>
          </div>
        }
      } @else {
        <mat-progress-bar mode="indeterminate" />
      }
    </section>
  `,
  styles: `
    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    h1 { margin: 0 0 4px; font-size: 1.6rem; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 20px 0; }
    .meta dt { font-size: .75rem; text-transform: uppercase; letter-spacing: .04em; color: var(--app-text-muted); }
    .meta dd { margin: 2px 0 0; font-weight: 500; }
    .summary { margin-top: 20px; padding: 16px; background: var(--app-bg); border-radius: 10px; }
    .summary h2 { margin: 0 0 8px; font-size: 1rem; }
    .summary p { margin: 0 0 12px; line-height: 1.55; }
    .keywords { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .keyword { background: #fff; border: 1px solid var(--app-border); border-radius: 6px; padding: 1px 8px; font-size: .8rem; }
    .content { line-height: 1.7; }
    .plain { white-space: pre-wrap; word-break: break-word; font-family: inherit; margin: 0; }
    .markdown :is(pre) { background: #f4f5f9; padding: 12px; border-radius: 8px; overflow-x: auto; }
  `,
})
export class DocumentPage {
  private readonly api = inject(DocumentsApi);
  private readonly events = inject(DocumentEvents);

  /** Parámetros de ruta enlazados como inputs (withComponentInputBinding) */
  readonly id = input.required<string>();
  readonly q = input<string>();
  readonly formatSize = formatSize;

  // Carga inicial + recarga automática si llega un evento SSE para este documento
  readonly state = toSignal(
    merge(
      toObservable(this.id),
      this.events.events$.pipe(
        filter((event) => event.documentId === this.id()),
        map(() => this.id()),
      ),
    ).pipe(
      switchMap((id) =>
        this.api.get(id).pipe(
          map((document) => ({ document, error: null as string | null })),
          catchError((error: HttpErrorResponse) =>
            of({
              document: null,
              error: error.status === 404 ? 'El documento no existe' : 'No fue posible cargar el documento',
            }),
          ),
        ),
      ),
    ),
  );

  readonly markdownHtml = computed(() => {
    const doc = this.state()?.document;
    if (!doc?.body || doc.mimeType !== 'text/markdown') return null;
    return marked.parse(doc.body, { async: false }) as string; // Angular sanitiza el HTML al enlazarlo
  });
}
