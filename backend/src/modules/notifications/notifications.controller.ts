import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { interval, map, merge, Observable } from 'rxjs';
import { DocumentEventsSubscriber } from './document-events.subscriber';

const HEARTBEAT_MS = 25_000;

@Controller('events')
export class NotificationsController {
  constructor(private readonly subscriber: DocumentEventsSubscriber) {}

  /** HU-04: stream SSE con los cambios de estado (INDEXADO / ERROR). */
  @Sse('documents')
  documentEvents(): Observable<MessageEvent> {
    const events$ = this.subscriber.events$.pipe(
      map((event): MessageEvent => ({ type: 'document-status', data: event })),
    );
    const heartbeat$ = interval(HEARTBEAT_MS).pipe(
      map((): MessageEvent => ({ type: 'heartbeat', data: { at: new Date().toISOString() } })),
    );
    return merge(events$, heartbeat$);
  }
}
