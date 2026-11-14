import { z } from 'zod';

const MIN_SECRET_LENGTH = 32;
const DEFAULT_API_PORT = 3000;
const MAX_PORT = 65_535;
const MAX_PROXY_HOPS = 5;

const NODE_ENVS = ['development', 'test', 'production'] as const;
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const httpUrl = z.url({ protocol: /^https?$/ });
const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ });

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

/** Raw environment variables. Names match `.env.example`. */
const envSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVS),
  LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),
  API_PORT: z.coerce.number().int().positive().max(MAX_PORT).default(DEFAULT_API_PORT),
  /** Reverse proxies in front of the API (Render, Vercel rewrite); needed for the real client IP. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(MAX_PROXY_HOPS).default(0),
  ADMIN_ORIGIN: httpUrl,
  DATABASE_URL: postgresUrl,
  SESSION_SECRET: z.string().min(MIN_SECRET_LENGTH),
  S3_ENDPOINT: httpUrl,
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanString,
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-haiku-5-5'),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
});

export type NodeEnv = (typeof NODE_ENVS)[number];
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface Config {
  readonly nodeEnv: NodeEnv;
  readonly isProduction: boolean;
  readonly logLevel: LogLevel;
  readonly port: number;
  readonly trustProxyHops: number;
  readonly adminOrigin: string;
  readonly databaseUrl: string;
  readonly sessionSecret: string;
  readonly s3: {
    readonly endpoint: string;
    readonly region: string;
    readonly bucket: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly forcePathStyle: boolean;
  };
  readonly ai: { readonly apiKey: string | undefined; readonly model: string };
  readonly github: { readonly clientId: string; readonly clientSecret: string } | undefined;
}

/** Thrown at startup when the environment is incomplete. Lists variable names, never values. */
export class ConfigError extends Error {
  constructor(readonly variables: readonly string[]) {
    super(`Invalid or missing environment variables: ${variables.join(', ')}`);
    this.name = 'ConfigError';
  }
}

type RawEnv = Readonly<Record<string, string | undefined>>;

/** Blank values count as unset, so defaults and "optional" behave the same for `KEY=` and no key. */
function dropBlankValues(env: RawEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).flatMap(([key, value]) => {
      const trimmed = value?.trim();
      return trimmed === undefined || trimmed === '' ? [] : [[key, trimmed]];
    }),
  );
}

export function parseConfig(env: RawEnv): Config {
  const result = envSchema.safeParse(dropBlankValues(env));
  if (!result.success) {
    const variables = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
    throw new ConfigError(variables.sort());
  }
  const values = result.data;
  // Production always runs behind Render's proxy: with 0 hops every client would share one IP,
  // breaking rate limits and lockouts.
  if (values.NODE_ENV === 'production' && values.TRUST_PROXY_HOPS === 0) {
    throw new ConfigError(['TRUST_PROXY_HOPS']);
  }
  const { GITHUB_CLIENT_ID: githubClientId, GITHUB_CLIENT_SECRET: githubClientSecret } = values;

  return {
    nodeEnv: values.NODE_ENV,
    isProduction: values.NODE_ENV === 'production',
    logLevel: values.LOG_LEVEL,
    port: values.API_PORT,
    trustProxyHops: values.TRUST_PROXY_HOPS,
    adminOrigin: new URL(values.ADMIN_ORIGIN).origin,
    databaseUrl: values.DATABASE_URL,
    sessionSecret: values.SESSION_SECRET,
    s3: {
      endpoint: values.S3_ENDPOINT,
      region: values.S3_REGION,
      bucket: values.S3_BUCKET,
      accessKeyId: values.S3_ACCESS_KEY_ID,
      secretAccessKey: values.S3_SECRET_ACCESS_KEY,
      forcePathStyle: values.S3_FORCE_PATH_STYLE,
    },
    ai: { apiKey: values.ANTHROPIC_API_KEY, model: values.ANTHROPIC_MODEL },
    github:
      githubClientId !== undefined && githubClientSecret !== undefined
        ? { clientId: githubClientId, clientSecret: githubClientSecret }
        : undefined,
  };
}
