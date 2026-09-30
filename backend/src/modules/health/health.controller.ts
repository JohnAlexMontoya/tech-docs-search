import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { DOCUMENT_QUEUE } from '../processing/processing.constants';

type ProbeStatus = 'up' | 'down';
const PROBE_TIMEOUT_MS = 2000;

/** Liveness/readiness: usado por healthchecks de Docker, balanceadores u orquestadores. */
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue(DOCUMENT_QUEUE) private readonly queue: Queue,
  ) {}

  @Get()
  async check() {
    const [database, redis] = await Promise.all([
      this.probe(() => this.dataSource.query('SELECT 1')),
      this.probe(() => this.queue.getJobCounts()),
    ]);

    const body = {
      status: database === 'up' && redis === 'up' ? 'ok' : 'error',
      checks: { database, redis },
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };

    if (body.status !== 'ok') throw new ServiceUnavailableException(body);
    return body;
  }

  private async probe(check: () => Promise<unknown>): Promise<ProbeStatus> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('timeout')), PROBE_TIMEOUT_MS);
    });
    try {
      await Promise.race([check(), timeout]);
      return 'up';
    } catch {
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }
}
