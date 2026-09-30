import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import type {
  BatchUploadResultDto, DocumentListItemDto, DocumentStatusEvent,
} from '@tech-docs/shared';
import { Observable, finalize, map } from 'rxjs';
import { DocumentsApi } from '../../core/api/documents-api';
import { DocumentEvents } from '../../core/realtime/document-events';
import { formatSize } from '../../core/ui/format-size';
import { StatusChip } from '../../core/ui/status-chip';

const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md'];
const MAX_FILE_SIZE_MB = 20;
const MAX_FILES = 20;

@Component({
  selector: 'app-upload-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink, DatePipe, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatProgressBarModule, StatusChip,
  ],
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Cargar documentos</h1>
        <p>PDF, TXT o Markdown · máx. {{ maxSize }} MB por archivo · hasta {{ maxFiles }} archivos por carga</p>
      </header>

      <div class="layout">
        <form class="card upload-form" [formGroup]="form" (ngSubmit)="submit()">
          <input #fileInput type="file" multiple accept=".pdf,.txt,.md" hidden (change)="onFileInput($event)" />
          <div
            class="dropzone"
            [class.dropzone-active]="dragging()"
            (click)="fileInput.click()"
            (dragover)="$event.preventDefault(); dragging.set(true)"
            (dragleave)="dragging.set(false)"
            (drop)="onDrop($event)">
            <mat-icon>upload_file</mat-icon>
            <p><strong>Arrastra archivos aquí</strong> o haz clic para seleccionarlos</p>
          </div>

          @if (files().length) {
            <ul class="file-list">
              @for (file of files(); track $index) {
                <li>
                  <mat-icon>description</mat-icon>
                  <span class="file-name">{{ file.name }}</span>
                  <span class="muted">{{ formatSize(file.size) }}</span>
                  <button mat-icon-button type="button" (click)="removeFile($index)" aria-label="Quitar archivo">
                    <mat-icon>close</mat-icon>
                  </button>
                </li>
              }
            </ul>
          }

          @if (isBatch()) {
            <p class="hint">Carga masiva: el título de cada documento será el nombre de su archivo y los metadatos se aplican a todos.</p>
          } @else {
            <mat-form-field appearance="outline">
              <mat-label>Título</mat-label>
              <input matInput formControlName="title" />
              <mat-error>El título es obligatorio</mat-error>
            </mat-form-field>
          }

          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>Autor</mat-label>
              <input matInput formControlName="author" />
              <mat-error>El autor es obligatorio</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Versión</mat-label>
              <input matInput formControlName="version" />
              <mat-error>La versión es obligatoria</mat-error>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Categoría</mat-label>
            <input matInput formControlName="category" list="category-options" />
            <datalist id="category-options">
              @for (category of categories(); track category) {
                <option [value]="category"></option>
              }
            </datalist>
            <mat-error>La categoría es obligatoria</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Etiquetas</mat-label>
            <input matInput formControlName="tags" placeholder="docker, kubernetes, api" />
            <mat-hint>Separadas por coma</mat-hint>
          </mat-form-field>

          @if (submitting()) {
            <mat-progress-bar mode="indeterminate" />
          }
          <button mat-flat-button type="submit" [disabled]="submitting() || files().length === 0">
            <mat-icon>cloud_upload</mat-icon>
            {{ isBatch() ? 'Cargar ' + files().length + ' documentos' : 'Cargar documento' }}
          </button>
        </form>

        <aside class="card">
          <h2>Cargas recientes</h2>
          @for (doc of recent(); track doc.id) {
            <article class="recent">
              <div class="recent-main">
                @if (doc.status === 'INDEXADO') {
                  <a [routerLink]="['/documents', doc.id]">{{ doc.title }}</a>
                } @else {
                  <span>{{ doc.title }}</span>
                }
                <small class="muted">{{ doc.category }} · {{ doc.createdAt | date: 'short' }}</small>
                @if (doc.errorMessage) {
                  <small class="error">{{ doc.errorMessage }}</small>
                }
              </div>
              <app-status-chip [status]="doc.status" />
            </article>
            @if (doc.status === 'PROCESANDO') {
              <mat-progress-bar mode="indeterminate" />
            }
          } @empty {
            <p class="hint">Aún no hay documentos cargados.</p>
          }
        </aside>
      </div>
    </section>
  `,
  styles: `
    .layout { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; align-items: start; }
    @media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
    .upload-form { display: flex; flex-direction: column; gap: 8px; }
    .row { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; }
    .dropzone { border: 2px dashed var(--app-border); border-radius: 12px; padding: 28px; text-align: center; cursor: pointer; color: var(--app-text-muted); transition: all .15s; margin-bottom: 8px; }
    .dropzone:hover, .dropzone-active { border-color: var(--app-accent); background: #f1f4ff; color: var(--app-accent); }
    .dropzone mat-icon { font-size: 40px; width: 40px; height: 40px; }
    .file-list { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .file-list li { display: flex; align-items: center; gap: 8px; padding: 4px 8px; background: var(--app-bg); border-radius: 8px; }
    .file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    h2 { margin: 0 0 12px; font-size: 1.1rem; }
    .recent { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--app-border); }
    .recent-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .recent-main a, .recent-main span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .recent-main a { color: var(--app-accent); text-decoration: none; font-weight: 500; }
  `,
})
export class UploadPage {
  private readonly api = inject(DocumentsApi);
  private readonly events = inject(DocumentEvents);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly maxSize = MAX_FILE_SIZE_MB;
  readonly maxFiles = MAX_FILES;
  readonly formatSize = formatSize;

  readonly files = signal<File[]>([]);
  readonly dragging = signal(false);
  readonly submitting = signal(false);
  readonly recent = signal<DocumentListItemDto[]>([]);
  readonly isBatch = computed(() => this.files().length > 1);
  readonly categories = toSignal(this.api.categories(), { initialValue: [] as string[] });

  readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    author: ['', [Validators.required, Validators.maxLength(150)]],
    category: ['', [Validators.required, Validators.maxLength(100)]],
    version: ['1.0', [Validators.required, Validators.maxLength(30)]],
    tags: [''],
  });

  constructor() {
    // En carga masiva el título no aplica (se usa el nombre de cada archivo)
    effect(() => {
      const title = this.form.controls.title;
      if (this.isBatch()) title.disable();
      else title.enable();
    });

    this.loadRecent();
    this.events.events$.pipe(takeUntilDestroyed()).subscribe((event) => this.applyEvent(event));
    // Tras una reconexión SSE pudimos perder eventos: se re-sincroniza desde la API
    this.events.reconnected$.pipe(takeUntilDestroyed()).subscribe(() => this.loadRecent());
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(input.files);
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.addFiles(event.dataTransfer?.files ?? null);
  }

  removeFile(index: number): void {
    this.files.update((files) => files.filter((_, i) => i !== index));
  }

  submit(): void {
    if (this.files().length === 0 || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const files = this.files();
    const { title, author, category, version, tags } = this.form.getRawValue();
    const meta = { author, category, version, tags };

    const request$: Observable<BatchUploadResultDto> =
      files.length === 1
        ? this.api.upload(files[0], { ...meta, title }).pipe(map((r) => ({ accepted: [r], rejected: [] })))
        : this.api.uploadBatch(files, meta);

    this.submitting.set(true);
    request$
      .pipe(finalize(() => this.submitting.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        const tagList = tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
        const now = new Date().toISOString();

        const items = result.accepted.map((accepted): DocumentListItemDto => {
          // Si el evento SSE llegó antes que esta respuesta, se aplica su estado
          const known = this.events.track(accepted.id);
          return {
            id: accepted.id,
            title: files.length === 1 ? title : accepted.fileName.replace(/\.[^.]+$/, ''),
            author,
            version,
            category,
            tags: tagList,
            status: known?.status ?? accepted.status,
            errorMessage: known?.errorMessage ?? null,
            createdAt: now,
            indexedAt: known?.status === 'INDEXADO' ? known.occurredAt : null,
          };
        });

        this.recent.update((list) => [...items, ...list.filter((d) => !items.some((i) => i.id === d.id))]);

        const rejected = result.rejected.length
          ? ` · ${result.rejected.length} rechazado(s): ${result.rejected.map((r) => `${r.fileName} (${r.reason})`).join(', ')}`
          : '';
        this.snackBar.open(`${result.accepted.length} documento(s) en procesamiento${rejected}`, 'Cerrar', { duration: 6000 });

        this.files.set([]);
        this.form.controls.title.reset('');
      });
  }

  private addFiles(list: FileList | null): void {
    const accepted: File[] = [];
    const rejected: string[] = [];

    for (const file of Array.from(list ?? [])) {
      const dot = file.name.lastIndexOf('.');
      const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
      if (!ALLOWED_EXTENSIONS.includes(extension)) rejected.push(`${file.name}: formato no permitido`);
      else if (file.size === 0) rejected.push(`${file.name}: archivo vacío`);
      else if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) rejected.push(`${file.name}: supera ${MAX_FILE_SIZE_MB} MB`);
      else accepted.push(file);
    }

    const merged = [...this.files(), ...accepted].slice(0, MAX_FILES);
    this.files.set(merged);

    if (merged.length === 1 && !this.form.controls.title.value) {
      this.form.controls.title.setValue(merged[0].name.replace(/\.[^.]+$/, ''));
    }
    if (rejected.length) {
      this.snackBar.open(rejected.join(' · '), 'Cerrar', { duration: 6000, panelClass: 'snack-error' });
    }
  }

  private loadRecent(): void {
    this.api.list(1, 15).subscribe((page) => this.recent.set(page.items));
  }

  private applyEvent(event: DocumentStatusEvent): void {
    this.recent.update((list) =>
      list.map((doc) =>
        doc.id === event.documentId
          ? {
              ...doc,
              status: event.status,
              errorMessage: event.errorMessage,
              indexedAt: event.status === 'INDEXADO' ? event.occurredAt : doc.indexedAt,
            }
          : doc,
      ),
    );
  }
}
