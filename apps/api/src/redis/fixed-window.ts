import type { RedisService } from './redis.service.js';

/**
 * The fixed-window rule, shared by every counter: a hit increments the key, and the key gets its
 * expiry with its first hit only (NX), so later hits never extend the window. Scripts run as one
 * step, so parallel callers on any instance each see their own count.
 */
const COUNT_HIT_FUNCTION = `
local function countHit(key, windowMs)
  local hits = redis.call('INCR', key)
  redis.call('PEXPIRE', key, windowMs, 'NX')
  return hits
end
`;

/** KEYS: the counters. ARGV: window ms. Returns the new count of each key. */
const COUNT_HITS_SCRIPT = `${COUNT_HIT_FUNCTION}
local counts = {}
for index, key in ipairs(KEYS) do
  counts[index] = countHit(key, ARGV[1])
end
return counts
`;

/**
 * KEYS: the counter, the block flag. ARGV: window ms, limit, block ms. Blocks the key for block ms
 * once a hit passes the limit (never with a block of 0, which Redis would reject). Returns hits,
 * ms left in the window, ms left in the block (0 if none).
 */
const COUNT_HIT_WITH_BLOCK_SCRIPT = `${COUNT_HIT_FUNCTION}
local hits = countHit(KEYS[1], ARGV[1])
local windowLeft = redis.call('PTTL', KEYS[1])
local blockLeft = redis.call('PTTL', KEYS[2])
local blockMs = tonumber(ARGV[3])
if blockLeft <= 0 and blockMs > 0 and hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', blockMs)
  blockLeft = blockMs
end
if blockLeft < 0 then blockLeft = 0 end
return { hits, windowLeft, blockLeft }
`;
const BLOCK_SCRIPT_KEY_COUNT = 2;
const BLOCK_SCRIPT_RESULT_LENGTH = 3;

export interface BlockingHit {
  hits: number;
  windowLeftMs: number;
  /** 0 when the key is not blocked. */
  blockLeftMs: number;
}

function isNumberList(value: unknown, length: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((item) => typeof item === 'number')
  );
}

/**
 * Fixed-window counters shared by every API instance: counts this hit on each key and returns
 * the counts, in key order. A window starts at a key's first hit and lasts `windowMs`.
 */
export async function countHits(
  redis: RedisService,
  keys: readonly string[],
  windowMs: number,
): Promise<number[]> {
  const counts: unknown = await redis.eval(COUNT_HITS_SCRIPT, keys.length, ...keys, windowMs);
  if (!isNumberList(counts, keys.length)) {
    throw new TypeError('The hit counting script returned something other than one count per key');
  }
  return counts;
}

/** One hit on a fixed-window counter that blocks its key for `blockMs` once over `limit`. */
export async function countHitWithBlock(
  redis: RedisService,
  keys: { counter: string; block: string },
  limits: { windowMs: number; limit: number; blockMs: number },
): Promise<BlockingHit> {
  const result: unknown = await redis.eval(
    COUNT_HIT_WITH_BLOCK_SCRIPT,
    BLOCK_SCRIPT_KEY_COUNT,
    keys.counter,
    keys.block,
    limits.windowMs,
    limits.limit,
    limits.blockMs,
  );
  if (!isNumberList(result, BLOCK_SCRIPT_RESULT_LENGTH)) {
    throw new TypeError('The blocking hit script returned something other than three numbers');
  }
  const [hits = 0, windowLeftMs = 0, blockLeftMs = 0] = result;
  return { hits, windowLeftMs, blockLeftMs };
}
