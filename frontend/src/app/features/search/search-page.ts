import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import type { PaginatedResponse, SearchHitDto } from '@tech-docs/shared';
import { catchError, finalize, map, of, switchMap, tap } from 'rxjs';
import { DocumentsApi } from '../../core/api/documents-api';

@Component({
  selector: 'app-search-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink, DatePipe, DecimalPipe, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatPaginatorModule, MatProgressBarModule,
  ],
  template: `
    <section class="page">
      <header class="page-header">
        <h1>Buscar documentos</h1>
        <p>Búsqueda full-text en títulos, metadatos y contenido</p>
      </header>

      <form class="card search-form" [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field appearance="outline" class="grow" subscriptSizing="dynamic">
          <mat-label>¿Qué estás buscando?</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput formControlName="q" autocomplete="off" />
          <mat-hint>Tip: "frase exacta", -excluir, término OR término</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Categoría</mat-label>
          <mat-select formControlName="category">
            <mat-option value="">Todas</mat-option>
            @for (category of categories(); track category) {
              <mat-option [value]="category">{{ category }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Etiquetas</mat-label>
          <input matInput formControlName="tags" placeholder="docker, api" />
        </mat-form-field>
        <button mat-flat-button type="submit" class="search-button">Buscar</button>
      </form>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (results(); as r) {
        <p class="muted">{{ r.total | number }} resultados · {{ r.tookMs }} ms</p>

        @for (hit of r.items; track hit.id) {
          <article class="card hit">
            <a class="hit-title" [routerLink]="['/documents', hit.id]" [queryParams]="{ q: form.controls.q.value }">
              {{ hit.title }}
            </a>
            <div class="muted">
              {{ hit.category }} · {{ hit.author }} · v{{ hit.version }} · {{ hit.createdAt | date: 'mediumDate' }}
            </div>
            <p class="snippet" [innerHTML]="hit.highlight"></p>
            @if (hit.tags.length) {
              <div class="tags">
                @for (tag of hit.tags; track tag) {
                  <span class="tag">#{{ tag }}</span>
                }
              </div>
            }
          </article>
        } @empty {
          <div class="empty">
            <mat-icon>search_off</mat-icon>
            <p>No se encontraron documentos para esta búsqueda.</p>
          </div>
        }

        @if (r.total > r.pageSize) {
          <mat-paginator
            [length]="r.total"
            [pageIndex]="r.page - 1"
            [pageSize]="r.pageSize"
            [pageSizeOptions]="[10, 20, 50]"
            (page)="onPage($event)" />
        }
      } @else if (!loading()) {
        <div class="empty">
          <mat-icon>manage_search</mat-icon>
          <p>Escribe al menos 2 caracteres para buscar entre los documentos indexados.</p>
        </div>
      }
    </section>
  `,
  styles: `
    .search-form { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
    .grow { flex: 1 1 320px; }
    .search-button { height: 56px; }
    .hit { display: flex; flex-direction: column; gap: 6px; }
    .hit-title { font-size: 1.15rem; font-weight: 500; color: var(--app-accent); text-decoration: none; }
    .hit-title:hover { text-decoration: underline; }
    .snippet { margin: 4px 0; line-height: 1.55; }
    mat-paginator { background: transparent; }
  `,
})
export class SearchPage {
  private readonly api = inject(DocumentsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly form = inject(NonNullableFormBuilder).group({ q: [''], category: [''], tags: [''] });
  readonly categories = toSignal(this.api.categories(), { initialValue: [] as string[] });
  readonly loading = signal(false);
  readonly results = signal<PaginatedResponse<SearchHitDto> | null>(null);

  constructor() {
    // La URL es la fuente de verdad: búsqueda compartible y botón "atrás" funcional.
    // switchMap cancela peticiones anteriores y evita respuestas fuera de orden.
    this.route.queryParamMap
      .pipe(
        map((p) => ({
          q: p.get('q') ?? '',
          category: p.get('category') ?? '',
          tags: p.get('tags') ?? '',
          page: Number(p.get('page') ?? 1),
          pageSize: Number(p.get('pageSize') ?? 10),
        })),
        tap(({ q, category, tags }) => this.form.setValue({ q, category, tags }, { emitEvent: false })),
        switchMap((params) => {
          if (params.q.trim().length < 2) return of(null);
          this.loading.set(true);
          return this.api
            .search({
              ...params,
              tags: params.tags.split(',').map((t) => t.trim()).filter(Boolean),
            })
            .pipe(
              catchError(() => of(null)),
              finalize(() => this.loading.set(false)),
            );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((results) => this.results.set(results));
  }

  submit(): void {
    const { q, category, tags } = this.form.getRawValue();
    this.navigate({ q: q.trim() || null, category: category || null, tags: tags.trim() || null, page: null });
  }

  onPage(event: PageEvent): void {
    this.navigate({ page: event.pageIndex + 1, pageSize: event.pageSize });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private navigate(queryParams: Params): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }
}
