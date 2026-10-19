import { CANONICAL_JSONL } from '../generated/canonicalSource.js';
import { validateRecords } from './validate.js';
export function loadCanonicalRecords() {
    const records = [];
    for (const [idx, line] of CANONICAL_JSONL.split(/\r?\n/).entries()) {
        if (!line.trim())
            continue;
        const obj = JSON.parse(line);
        if (!obj || typeof obj !== 'object' || Array.isArray(obj))
            throw new Error(`Line ${idx + 1}: expected JSON object`);
        records.push(obj);
    }
    return records;
}
function countBy(records, field) {
    const out = {};
    for (const r of records) {
        const key = String(r[field]);
        out[key] = (out[key] ?? 0) + 1;
    }
    return out;
}
export class CanonicalCorpus {
    records;
    constructor(records) {
        const errors = validateRecords(records);
        if (errors.length)
            throw new Error(`Canonical dataset validation failed:\n${errors.join('\n')}`);
        this.records = records;
    }
    static fromEmbeddedJsonl() {
        return new CanonicalCorpus(loadCanonicalRecords());
    }
    filter(criteria) {
        return this.records.filter(r => Object.entries(criteria).every(([k, v]) => {
            const rv = r[k];
            if (Array.isArray(rv))
                return rv.includes(v);
            return rv === v;
        }));
    }
    count(criteria = {}) {
        return Object.keys(criteria).length ? this.filter(criteria).length : this.records.length;
    }
    crosstab(fieldA, fieldB) {
        const out = {};
        for (const r of this.records) {
            const a = String(r[fieldA]);
            const b = String(r[fieldB]);
            out[a] ??= {};
            out[a][b] = (out[a][b] ?? 0) + 1;
        }
        return out;
    }
    multimodalSummary(context = 'operational') {
        let field;
        let note;
        if (context === 'operational') {
            field = 'multimodal_instantiation_current';
            note = 'Frozen Representation-v1 consumed-object rule.';
        }
        else if (context === 'manuscript') {
            field = 'legacy_multimodal';
            note = 'Legacy field used by manuscript v1.5 Table 3.';
        }
        else {
            throw new Error("context must be 'operational' or 'manuscript'");
        }
        const dt = this.records.filter(r => r.dt_capability === 'DT+');
        const n = dt.filter(r => r[field] === true).length;
        return { context, field, n, denominator: dt.length, percent: Math.round((1000 * n) / dt.length) / 10, note };
    }
    headlineSummary() {
        return {
            study_units: this.records.length,
            analytic_reports: this.records.reduce((s, r) => s + Number(r.report_count), 0),
            dt_positive: this.count({ dt_capability: 'DT+' }),
            vct_positive: this.count({ vct_capability: 'VCT+' }),
            dt_vct_crosstab: this.crosstab('dt_capability', 'vct_capability'),
            dt_l1: this.count({ dt_level: 'DT-L1' }),
            dt_l2: this.count({ dt_level: 'DT-L2' }),
            assimilation_yes: this.count({ post_instantiation_assimilation: true }),
        };
    }
}