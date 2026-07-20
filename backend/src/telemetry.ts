/**
 * OpenTelemetry SDK bootstrap for the NovaLabs backend.
 *
 * This file MUST be loaded BEFORE any application code is required so the
 * SDK can monkey-patch http, express, typeorm/pg, ioredis, etc. The Nest
 * boot pipeline uses `node -r ./dist/telemetry dist/main` from the
 * `start:prod` npm script to guarantee preloading.
 *
 * Design rules:
 *  - No-op when OTEL_SDK_DISABLED=true (CI, local dev without a collector).
 *  - Swallow ALL errors — telemetry must never prevent the API from
 *    booting or block graceful shutdown.
 *  - Resource attributes pulled from env where possible.
 *  - fs instrumentation is disabled by default because it is extremely
 *    noisy and rarely useful for backend latency analysis.
 */

import { diag, DiagConsoleLogger } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions';

function start(): void {
  if (process.env.OTEL_SDK_DISABLED === 'true') {
    return;
  }

  try {
    const numericLogLevel = Number(process.env.OTEL_LOG_LEVEL ?? '');
    if (Number.isFinite(numericLogLevel)) {
      diag.setLogger(new DiagConsoleLogger(), numericLogLevel);
    }

    const sdk = new NodeSDK({
      resource: new Resource({
        [ATTR_SERVICE_NAME]:
          process.env.OTEL_SERVICE_NAME ?? 'novalabs-backend',
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.1',
        [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]:
          process.env.NODE_ENV ?? 'development',
      }),
      traceExporter: new OTLPTraceExporter(),
      instrumentations: [
        getNodeAutoInstrumentations({
          // fs spans are noisy and seldom useful — disable by default.
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });

    sdk.start();

    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
      try {
        await sdk.shutdown();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[telemetry] SDK shutdown on ${signal} failed:`, err);
      }
    };

    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });
    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[telemetry] OpenTelemetry SDK failed to start:', err);
  }
}

start();
