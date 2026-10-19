import { CANONICAL_SHA256 } from './generated/canonicalSource.js';
import { CanonicalCorpus } from './domain/query.js';
import { BOOLEAN_FIELDS, FILTER_FIELDS, ReviewerQueryEngine } from './domain/reviewerQueryEngine.js';
import { NLQInterpreter } from './domain/nlq.js?v=76e583318abcd558';
import { EmergingUIStore, MODE2_FILTER_FIELDS } from './domain/mode2Store.js';
export const ENGINE = new ReviewerQueryEngine(CanonicalCorpus.fromEmbeddedJsonl());
export const NLQ = new NLQInterpreter(ENGINE);
export const MODE2 = new EmergingUIStore();
function jsonResponse(obj, status = 200) {
    return new Response(JSON.stringify(obj, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function parseScalar(field, raw) {
    if (BOOLEAN_FIELDS.has(field)) {
        const text = raw.trim().toLowerCase();
        if (['true', '1', 'yes'].includes(text))
            return true;
        if (['false', '0', 'no'].includes(text))
            return false;
        throw new Error(`Invalid boolean for ${field}`);
    }
    if (raw === '__NULL__')
        return null;
    return raw;
}
function parseIntStrict(raw, fallback) {
    if (raw === undefined)
        return fallback;
    const t = raw.trim();
    if (!/^[+-]?\d+$/.test(t))
        throw new Error(`invalid literal for int(): ${raw}`);
    return Number.parseInt(t, 10);
}
function getAll(url, key) { return url.searchParams.getAll(key); }
export async function handleRequest(request) {
    try {
        if (request.method !== 'GET')
            return jsonResponse({ error: 'method not allowed' }, 405);
        const url = new URL(request.url);
        const path = url.pathname;
        if (path === '/api/nlq')
            return jsonResponse(NLQ.execute(url.searchParams.get('prompt') ?? ''));
        if (path === '/api/summary')
            return jsonResponse(ENGINE.summary());
        if (path === '/api/options')
            return jsonResponse(ENGINE.options());
        if (path === '/api/crosstab')
            return jsonResponse(ENGINE.crosstab(url.searchParams.get('field_a') ?? 'dt_capability', url.searchParams.get('field_b') ?? 'vct_capability'));
        if (path === '/api/records') {
            const filters = {};
            for (const field of FILTER_FIELDS) {
                const vals = getAll(url, field);
                if (vals.length)
                    filters[field] = vals.map(v => parseScalar(field, v));
            }
            const result = ENGINE.query({ filters, role_include: getAll(url, 'role_include'), role_exclude: getAll(url, 'role_exclude'), search: url.searchParams.get('search') ?? '', page: parseIntStrict(url.searchParams.get('page') ?? undefined, 1), page_size: parseIntStrict(url.searchParams.get('page_size') ?? undefined, 50) });
            return jsonResponse({ total: result.total, records: result.records, page: result.page, page_size: result.page_size });
        }
        if (path.startsWith('/api/record/')) {
            const id = decodeURIComponent(path.slice('/api/record/'.length));
            const record = ENGINE.getRecord(id);
            return record === null ? jsonResponse({ error: 'record not found' }, 404) : jsonResponse(record);
        }
        if (path === '/api/mode2/summary')
            return jsonResponse(MODE2.summary());
        if (path === '/api/mode2/options')
            return jsonResponse(MODE2.options());
        if (path === '/api/mode2/candidates') {
            const filters = {};
            for (const field of MODE2_FILTER_FIELDS) {
                const vals = getAll(url, field);
                if (vals.length)
                    filters[field] = vals;
            }
            const result = MODE2.query({ filters, search: url.searchParams.get('search') ?? '', page: parseIntStrict(url.searchParams.get('page') ?? undefined, 1), page_size: parseIntStrict(url.searchParams.get('page_size') ?? undefined, 50) });
            return jsonResponse(result);
        }
        if (path.startsWith('/api/mode2/record/'))
            return jsonResponse({ error: 'emerging record not found' }, 404);
        if (path === '/api/mode2/review-queue')
            return jsonResponse({ records: MODE2.reviewQueue(url.searchParams.get('state')) });
        if (path === '/api/health')
            return jsonResponse({ status: 'ok', canonical_study_units: ENGINE.records.length, canonical_read_only: true, canonical_sha256: CANONICAL_SHA256, mode2_candidate_count: 0, mode2_included_in_canonical_denominator: 0, stores_separate: true });
        return jsonResponse({ error: 'not found' }, 404);
    }
    catch (exc) {
        const msg = String(exc?.message ?? exc);
        const isClient = msg.startsWith('Invalid ') || msg.startsWith('Unsupported ') || msg.startsWith('invalid literal');
        return jsonResponse({ error: isClient ? msg : `internal error: ${exc?.constructor?.name ?? 'Error'}` }, isClient ? 400 : 500);
    }
}