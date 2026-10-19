import { publicationAliases } from '../publicationDisplay.js?v=1277f413b0b8dcff';
import { NLQ_ONTOLOGY } from '../generated/ontology.js';
const DIMENSIONS = {
    'dt capability': 'dt_capability', 'dt': 'dt_capability',
    'vct capability': 'vct_capability', 'vct': 'vct_capability',
    'dt level': 'dt_level', 'anchoring level': 'dt_level',
    'temporal lifecycle': 'temporal_lifecycle_class', 'lifecycle': 'temporal_lifecycle_class', 'tm': 'temporal_lifecycle_class',
    'evidence provenance': 'x_axis', 'x provenance': 'x_axis', 'x axis': 'x_axis', 'x': 'x_axis',
    'assumption scrutiny': 'y_axis', 'y assumption warrant': 'y_axis', 'y axis': 'y_axis', 'y': 'y_axis',
    'evaluation scope': 'validation', 'validation': 'validation', 'v': 'validation',
    'disease group': 'disease_group_primary', 'disease': 'disease_group_primary',
    'model mode': 'mode', 'mode': 'mode',
};
const FILLER = /\b(?:please|show|list|find|give|me|count|number|how|many|which|what|are|is|there|the|a|an|all|of|in|for|from|to|with|have|has|having|that|those|studies|study|units|unit|records|record|papers|paper|results|result|and|but|either|both|validation|role|roles|canonical|review|snapshot|evidence|navigator|summarize|summary|overview)\b/gi;
const QUOTED = /"([^"]+)"|“([^”]+)”/gi;
const NEGATION = /\b(?:not|without|excluding|exclude|no)\s+(?:(?:any|the|a|an)\s+)?$/i;
const SINGLE_VALUE_FIELDS = new Set(['dt_capability', 'vct_capability', 'dt_level', 'temporal_lifecycle_class', 'x_axis', 'y_axis', 'validation', 'mode', 'publication_type', 'study_type', 'clinical_target_type', 'disease_group_primary']);
const COMPARE_WORD = /\bcompare\b/gi;
const VERSUS_WORD = /\b(?:versus|vs\.?)\b/gi;
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function pattern(term) {
    if (['DT+', 'DT-', 'VCT+', 'VCT-'].includes(term.toUpperCase()))
        return new RegExp(`(?<![\\w])${escapeRegex(term)}(?![\\w])`, 'gi');
    const bits = term.trim().toLowerCase().split(/[\s_-]+/).map(escapeRegex);
    return new RegExp(`(?<![\\w])${bits.join('[\\s_-]+')}(?![\\w])`, 'gi');
}
function normalize(prompt) {
    return prompt.replace(/[‐‑–−—]/g, '-').replace(/×/g, ' x ').toLowerCase();
}
function findAll(regex, text) {
    const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
    const re = new RegExp(regex.source, flags);
    const out = [];
    for (const m of text.matchAll(re))
        out.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, text: m[0] });
    return out;
}
function firstMatch(regex, text) {
    const flags = regex.flags.replaceAll('g', '');
    return new RegExp(regex.source, flags).exec(text);
}
export class NLQInterpreter {
    engine;
    aliases;
    rules;
    constructor(engine) {
        this.engine = engine;
        this.aliases = [...NLQ_ONTOLOGY.aliases, ...publicationAliases].map(x => ({ term: String(x.term), field: String(x.field), value: x.value }));
        this.rules = this.aliases.map(alias => ({ alias, regex: pattern(alias.term) }));
    }
    parse(prompt) {
        if (typeof prompt !== 'string')
            throw new Error('prompt must be a string');
        if (prompt.length > 2000)
            throw new Error('prompt must be at most 2000 characters');
        const text = normalize(prompt.trim());
        const out = {
            schema_version: 'dtcts-nlq-v1.2', parser: 'deterministic_ontology_v1_2', language: 'en', prompt, status: 'needs_clarification', intent: 'list',
            filters: {}, role_include: [], role_exclude: [], search: '', crosstab: null, group_by: null, interpreted_terms: [], unresolved_terms: [], messages: [],
            logic: 'AND across fields; explicit OR unions values within one single-valued field; same-field AND clarifies; all included roles required'
        };
        if (!text) {
            out.messages.push('Enter an English query, for example: Show DT-L2 studies with V2 validation.');
            return out;
        }
        const consumed = Array(text.length).fill(false);
        const available = (a, b) => !consumed.slice(a, b).some(Boolean);
        const consume = (a, b) => { for (let i = a; i < b; i++)
            consumed[i] = true; };
        const unresolved = (message, terms) => { out.messages.push(message); if (terms)
            out.unresolved_terms.push(...terms); };
        const safetyText = text.replace(new RegExp(QUOTED.source, 'gi'), ' ');
        const forbidden = firstMatch(/\b(matur\w*|best|highest|lowest|rank\w*|quality\s+score|confidence\s+score|dt[0-3]|cts[0-3]|cmf\d+)\b/i, safetyText);
        if (forbidden) {
            unresolved('No maturity ranking, composite X/Y/V score, historical membership labels, or CMF-to-role inference is supported. Specify a frozen dimension such as DT-L2, TM2, X3, or V2.', [forbidden[0]]);
            return out;
        }
        if (/\bmultimodal\b/i.test(safetyText)) {
            unresolved('Multimodal has two retained definitions. See the visible operational and manuscript/Table 3 summaries; this MVP does not silently choose a definition.', ['multimodal']);
            return out;
        }
        if (/\b(how many|count|number of)\b/i.test(text))
            out.intent = 'count';
        if (/\b(summary|summarize|overview)\b/i.test(text))
            out.intent = 'summary';
        const dimexpr = Object.keys(DIMENSIONS).sort((a, b) => b.length - a.length).map(escapeRegex).join('|');
        const crossRe = new RegExp(`\\b(?:cross[ -]?tab(?:ulate)?|crosstab|cross tabulation|compare)\\s+(${dimexpr})\\s+(?:by|versus|vs\\.?|x|and|against)\\s+(${dimexpr})(?!\\w)`, 'i');
        const groupRe = new RegExp(`\\b(?:group(?:ed)?\\s+by|break(?:down| down)\\s+by|distribution\\s+by)\\s+(${dimexpr})(?!\\w)`, 'i');
        const cross = crossRe.exec(text), group = groupRe.exec(text);
        if (cross && cross.index !== undefined) {
            out.intent = 'crosstab';
            out.crosstab = [DIMENSIONS[cross[1]], DIMENSIONS[cross[2]]];
            consume(cross.index, cross.index + cross[0].length);
            out.interpreted_terms.push({ term: cross[0], operation: 'crosstab', value: out.crosstab });
        }
        else if (group && group.index !== undefined) {
            out.intent = 'group_by';
            out.group_by = DIMENSIONS[group[1]];
            consume(group.index, group.index + group[0].length);
            out.interpreted_terms.push({ term: group[0], operation: 'group_by', value: out.group_by });
        }
        const searches = [...text.matchAll(new RegExp(QUOTED.source, 'gi'))];
        if (searches.length > 1)
            unresolved('Use a single quoted title/search phrase. Multiple search expressions are not supported.', ['multiple quoted phrases']);
        else if (searches.length === 1) {
            const m = searches[0], start = m.index ?? 0, end = start + m[0].length;
            const rawSearch = [...prompt.trim().matchAll(new RegExp(QUOTED.source, 'gi'))][0];
            out.search = rawSearch ? (rawSearch[1] || rawSearch[2]) : (m[1] || m[2]);
            if (out.crosstab || out.group_by)
                unresolved('Combine literal search and aggregation using manual filtering, not a mixed NLQ command.', ['mixed lookup and aggregation']);
            out.intent = 'record_lookup';
            consume(start, end);
            const prefixText = text.slice(0, start);
            const prefix = /\b(?:title|search|lookup|look up|titled|named)\s*[:=]?\s*$/i.exec(prefixText);
            if (prefix && prefix.index !== undefined)
                consume(prefix.index, prefix.index + prefix[0].length);
            out.interpreted_terms.push({ term: m[0], operation: 'literal_record_search', value: out.search });
        }
        for (const m of text.matchAll(/\b(?:pi\d+_\d+|piadd_[a-z0-9_]+|rec\d+)\b/gi)) {
            const start = m.index ?? 0, end = start + m[0].length;
            if (!available(start, end))
                continue;
            if (out.search)
                unresolved('Use one record identifier or one quoted search phrase.', ['multiple lookups']);
            else {
                out.search = m[0];
                out.intent = 'record_lookup';
                consume(start, end);
                out.interpreted_terms.push({ term: m[0], operation: 'literal_record_search', value: m[0] });
            }
        }
        const matches = [];
        for (const { alias, regex } of this.rules) {
            for (const m of text.matchAll(new RegExp(regex.source, regex.flags))) {
                const start = m.index ?? 0, end = start + m[0].length;
                if (available(start, end))
                    matches.push({ start, end, text: m[0], alias });
            }
        }
        const selected = [];
        matches.sort((a, b) => ((b.end - b.start) - (a.end - a.start)) || (a.start - b.start));
        for (const m of matches)
            if (available(m.start, m.end)) {
                consume(m.start, m.end);
                selected.push(m);
            }
        selected.sort((a, b) => a.start - b.start);
        let lastEnd = 0;
        const resolved = [];
        for (const m of selected) {
            let field = m.alias.field, value = m.alias.value;
            const prefix = text.slice(lastEnd, m.start);
            const neg = NEGATION.exec(prefix);
            let op = 'include';
            if (neg && neg.index !== undefined) {
                consume(lastEnd + neg.index, m.start);
                op = 'exclude';
                if (field === 'dt_capability' || field === 'vct_capability')
                    value = String(value).slice(0, -1) + (String(value).endsWith('+') ? '-' : '+');
                else if (typeof value === 'boolean') {
                    value = !value;
                    out.messages.push('A false accessibility/input flag means the frozen descriptor is false; it does not prove absolute absence.');
                }
                else if (field !== 'role')
                    unresolved('Negation of this categorical value is not supported; select explicit allowed values. ', [text.slice(lastEnd + neg.index, m.end)]);
            }
            if (field === 'role') {
                const target = op === 'exclude' ? 'role_exclude' : 'role_include';
                if (!out[target].includes(value))
                    out[target].push(value);
            }
            else {
                out.filters[field] ??= [];
                if (!out.filters[field].some((x) => Object.is(x, value)))
                    out.filters[field].push(value);
            }
            out.interpreted_terms.push({ term: text.slice(m.start, m.end), field, value, operation: op });
            resolved.push({ start: m.start, end: m.end, field, value, op });
            lastEnd = m.end;
        }
        for (const m of text.matchAll(/\bor\b/gi)) {
            const start = m.index ?? 0, end = start + m[0].length;
            if (!available(start, end))
                continue;
            const left = resolved.filter(x => x.end <= start), right = resolved.filter(x => x.start >= end);
            consume(start, end);
            if (left.length && right.length && left[left.length - 1].field === right[0].field && left[left.length - 1].field === 'role')
                unresolved('Role OR is not supported. Run separate role queries; role AND means all included roles are required.', ['role OR']);
            else if (!(left.length && right.length && left[left.length - 1].field === right[0].field && SINGLE_VALUE_FIELDS.has(left[left.length - 1].field)))
                unresolved('Cross-field OR is not supported. Run separate queries or use AND for intersection across fields.', ['cross-field OR']);
        }
        const comparisonFields = new Set(), comparisonRejectedFields = new Set();
        const availableCompare = findAll(COMPARE_WORD, text).filter(m => available(m.start, m.end));
        for (const [field, values] of Object.entries(out.filters)) {
            if (!SINGLE_VALUE_FIELDS.has(field) || values.length < 2)
                continue;
            const occurrences = resolved.filter(x => x.field === field && x.op === 'include');
            if (occurrences.length < 2)
                continue;
            const gaps = occurrences.slice(0, -1).map((a, i) => text.slice(a.end, occurrences[i + 1].start));
            const hasVersus = gaps.some(g => /\b(?:versus|vs\.?)\b/i.test(g));
            const hasCompare = availableCompare.some(cm => available(cm.start, cm.end));
            if (!(hasCompare || hasVersus))
                continue;
            const consumeCompareAndVersus = () => {
                for (const cm of availableCompare)
                    if (available(cm.start, cm.end))
                        consume(cm.start, cm.end);
                gaps.forEach((g, i) => { const vm = /\b(?:versus|vs\.?)\b/i.exec(g); if (vm && vm.index !== undefined) {
                    const s = occurrences[i].end + vm.index, e = s + vm[0].length;
                    if (available(s, e))
                        consume(s, e);
                } });
            };
            if (values.length !== 2 || occurrences.length !== 2) {
                consumeCompareAndVersus();
                unresolved('Direct value comparison in v1.2 requires exactly two recognized values from one single-valued field.', [field]);
                comparisonRejectedFields.add(field);
                continue;
            }
            const spanText = text.slice(Math.max(0, occurrences[0].start - 12), occurrences[occurrences.length - 1].end);
            if (/\bboth\b/i.test(spanText) && gaps.some(g => /\bor\b/i.test(g))) {
                consumeCompareAndVersus();
                unresolved('Conflicting "both ... or ..." wording is ambiguous. Use either A OR B, or Compare A and B.', [field]);
                comparisonRejectedFields.add(field);
                continue;
            }
            consumeCompareAndVersus();
            out.intent = 'group_by';
            out.group_by = field;
            comparisonFields.add(field);
            const label = values.map(String).join(' versus ');
            out.interpreted_terms.push({ term: label, operation: 'group_by', value: field });
            out.messages.push('Comparison is rendered as grouped canonical study-unit counts over the union of the requested values; it is not a Boolean intersection or statistical test.');
        }
        for (const [field, values] of Object.entries(out.filters)) {
            if (values.length > 1 && values.some(v => typeof v === 'boolean'))
                unresolved('Boolean alternatives are not supported; choose one flag state or omit the condition.', [field]);
            if (!SINGLE_VALUE_FIELDS.has(field) || values.length <= 1 || comparisonFields.has(field) || comparisonRejectedFields.has(field))
                continue;
            const occurrences = resolved.filter(x => x.field === field);
            const gaps = occurrences.slice(0, -1).map((a, i) => text.slice(a.end, occurrences[i + 1].start));
            const allOr = gaps.length > 0 && gaps.every(g => /\bor\b/i.test(g));
            const spanText = occurrences.length ? text.slice(Math.max(0, occurrences[0].start - 12), occurrences[occurrences.length - 1].end) : '';
            if (allOr && /\bboth\b/i.test(spanText))
                unresolved('Conflicting "both ... or ..." wording is ambiguous. Use "either ... or ..." for a union, or explicit comparison wording.', [field]);
            else if (!allOr) {
                if (values.length === 2)
                    unresolved(`${field} is a single-valued categorical field, so multiple values joined without explicit OR are not executed as an intersection or silently broadened. To show either category, use "Show ${String(values[0])} or ${String(values[1])} studies". To compare them, use "Compare ${String(values[0])} and ${String(values[1])}".`, [field]);
                else
                    unresolved(`Multiple values of ${field} require explicit OR. Same-field AND/enumeration is not silently broadened.`, [field]);
            }
        }
        if (out.role_include.some((r) => out.role_exclude.includes(r)))
            unresolved('The same role cannot be both required and excluded.', ['role conflict']);
        let residual = [...text].map((c, i) => consumed[i] ? ' ' : c).join('');
        residual = residual.replace(/\bnumber of\b/gi, ' ');
        residual = residual.replace(FILLER, ' ');
        residual = residual.replace(/[\s.,?!:;]+/g, ' ').trim();
        if (residual)
            unresolved('Unrecognized or unsupported words remain. No filters were applied. Quote a literal title, or use supported English taxonomy terms.', [residual]);
        const actionable = Boolean(Object.keys(out.filters).length || out.role_include.length || out.role_exclude.length || out.search || out.crosstab || out.group_by);
        if (!actionable && !/\b(all|summary|summarize|overview)\b/i.test(text))
            unresolved('Specify a supported filter, or explicitly ask for all studies.', ['no supported condition']);
        if (!out.unresolved_terms.length)
            out.status = 'ok';
        return out;
    }
    execute(prompt) {
        const q = this.parse(prompt);
        const payload = { interpretation: q, applied: false, result: null, answer: null, canonical_read_only: true, included_emerging_records: false };
        if (q.status !== 'ok')
            return payload;
        const result = this.engine.query({ filters: q.filters, role_include: q.role_include, role_exclude: q.role_exclude, search: q.search, page: 1, page_size: 103 });
        const base = this.engine.query().total;
        payload.result = { total: result.total, records: result.records, page: result.page, page_size: result.page_size, canonical_denominator: base };
        if (q.intent === 'crosstab')
            payload.crosstab = this.engine.crosstab(q.crosstab[0], q.crosstab[1], result.records);
        else if (q.intent === 'group_by')
            payload.groups = this.engine.groupBy(q.group_by, result.records);
        else if (q.intent === 'summary')
            payload.groups_by_dimension = Object.fromEntries(['dt_capability', 'vct_capability', 'dt_level'].map(f => [f, this.engine.groupBy(f, result.records)]));
        payload.applied = true;
        payload.answer = `${result.total} matching analytic study units out of ${base} frozen canonical study units. Counts are study units, not reports; emerging evidence is excluded.`;
        return payload;
    }
}