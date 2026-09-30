import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { DocumentStatus } from '@tech-docs/shared';

const LABELS: Record<DocumentStatus, string> = {
  PROCESANDO: 'Procesando',
  INDEXADO: 'Indexado',
  ERROR: 'Error',
};

@Component({
  selector: 'app-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="chip" [attr.data-status]="status()">{{ label() }}</span>`,
  styles: `
    .chip { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: .75rem; font-weight: 500; white-space: nowrap; }
    .chip[data-status='PROCESANDO'] { background: #fff4e0; color: #8a5300; }
    .chip[data-status='INDEXADO'] { background: #e3f6e8; color: #1b6b35; }
    .chip[data-status='ERROR'] { background: #fde7e7; color: #a4262c; }
  `,
})
export class StatusChip {
  readonly status = input.required<DocumentStatus>();
  readonly label = computed(() => LABELS[this.status()]);
}
