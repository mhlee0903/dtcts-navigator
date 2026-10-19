export const FILTER_FIELDS = new Set([
    'dt_capability', 'vct_capability', 'dt_level', 'temporal_lifecycle_class', 'x_axis', 'y_axis', 'validation', 'mode', 'publication_type', 'study_type', 'clinical_target_type', 'disease_group_primary',
    'direct_patient_record_input', 'forward_state_propagation', 'post_instantiation_assimilation', 'longitudinal_initialization', 'any_open_public_data', 'any_controlled_access_data', 'any_institutional_proprietary_data', 'any_data_on_request', 'any_data_not_public', 'any_data_unclear', 'any_public_source_any_license', 'any_open_source_licensed', 'any_public_non_source_artifact', 'any_code_on_request', 'any_code_not_public', 'any_code_unclear'
]);
export const OPTION_FIELDS = [
    'dt_capability', 'vct_capability', 'dt_level', 'temporal_lifecycle_class', 'x_axis', 'y_axis', 'validation', 'mode', 'publication_type', 'study_type', 'clinical_target_type', 'disease_group_primary'
];
export const BOOLEAN_FIELDS = new Set([
    'direct_patient_record_input', 'forward_state_propagation', 'post_instantiation_assimilation', 'longitudinal_initialization', 'any_open_public_data', 'any_controlled_access_data', 'any_institutional_proprietary_data', 'any_data_on_request', 'any_data_not_public', 'any_data_unclear', 'any_public_source_any_license', 'any_open_source_licensed', 'any_public_non_source_artifact', 'any_code_on_request', 'any_code_not_public', 'any_code_unclear'
]);
export const CROSSTAB_FIELDS = new Set(['dt_capability', 'vct_capability', 'dt_level', 'temporal_lifecycle_class', 'x_axis', 'y_axis', 'validation', 'mode', 'disease_group_primary']);
export const ROLE_ORDER = ['trial_harness', 'virtual_cohort_synthesis', 'mechanistic_world_model', 'observational_effect_estimation', 'learned_generative_model', 'policy_learning'];
const ORDERING = {
    dt_capability: ['DT+', 'DT-'], vct_capability: ['VCT+', 'VCT-'], dt_level: ['DT-L1', 'DT-L2', null], temporal_lifecycle_class: ['TM0', 'TM1', 'TM2', null],
    x_axis: ['X0', 'X1', 'X2', 'X3'], y_axis: ['Y0', 'Y1', 'Y2a', 'Y2b'], validation: ['V0', 'V1', 'V2']
};
function marker(v) {
    if (v === null)
        return 'null:null';
    return `${typeof v}:${JSON.stringify(v)}`;
}
function dedupe(values) {
    const seen = new Set();
    const out = [];
    for (const value of values) {
        const m = marker(value);
        if (!seen.has(m)) {
            seen.add(m);
            out.push(value);
        }
    }
    return out;
}
export function orderedValues(records, field) {
    const values = dedupe(records.map(r => r[field]));
    if (field in ORDERING) {
        const rank = new Map(ORDERING[field].map((v, i) => [marker(v), i]));
        return values.sort((a, b) => {
            const ra = rank.get(marker(a)) ?? 999;
            const rb = rank.get(marker(b)) ?? 999;
            if (ra !== rb)
                return ra - rb;
            return String(a).localeCompare(String(b), 'en', { sensitivity: 'variant' });
        });
    }
    return values.sort((a, b) => {
        const an = a === null || a === undefined ? 1 : 0;
        const bn = b === null || b === undefined ? 1 : 0;
        if (an !== bn)
            return an - bn;
        return String(a).localeCompare(String(b), 'en', { sensitivity: 'variant' });
    });
}
export class ReviewerQueryEngine {
    corpus;
    records;
    constructor(corpus) { this.corpus = corpus; this.records = [...corpus.records]; }
    options() {
        const fields = {};
        for (const field of OPTION_FIELDS)
            fields[field] = orderedValues(this.records, field);
        return { fields, roles: ROLE_ORDER, boolean_fields: [...BOOLEAN_FIELDS].sort(), crosstab_fields: [...CROSSTAB_FIELDS].sort() };
    }
    summary() {
        const dt = this.records.filter(r => r.dt_capability === 'DT+');
        return {
            ...this.corpus.headlineSummary(),
            tm: Object.fromEntries(['TM0', 'TM1', 'TM2'].map(k => [k, dt.filter(r => r.temporal_lifecycle_class === k).length])),
            direct_patient_record_input_dt: dt.filter(r => r.direct_patient_record_input === true).length,
            forward_state_propagation_dt: dt.filter(r => r.forward_state_propagation === true).length,
            x3_dt: dt.filter(r => r.x_axis === 'X3').length,
            y2b_dt: dt.filter(r => r.y_axis === 'Y2b').length,
            v2_dt: dt.filter(r => r.validation === 'V2').length,
            open_public_data: this.records.filter(r => r.any_open_public_data === true).length,
            public_source_code: this.records.filter(r => r.any_public_source_any_license === true).length,
            open_source_licensed: this.records.filter(r => r.any_open_source_licensed === true).length,
            multimodal: { operational: this.corpus.multimodalSummary('operational'), manuscript: this.corpus.multimodalSummary('manuscript') }
        };
    }
    getRecord(studyUnitId) { return this.records.find(r => r.study_unit_id === studyUnitId) ?? null; }
    query(args = {}) {
        const filters = args.filters ?? {};
        const roleInclude = (args.role_include ?? []).filter(Boolean);
        const roleExclude = (args.role_exclude ?? []).filter(Boolean);
        const unknown = Object.keys(filters).filter(k => !FILTER_FIELDS.has(k)).sort();
        if (unknown.length)
            throw new Error(`Unsupported filter field(s): ${unknown.join(', ')}`);
        const invalidRoles = [...new Set([...roleInclude, ...roleExclude].filter(r => !ROLE_ORDER.includes(r)))].sort();
        if (invalidRoles.length)
            throw new Error(`Unsupported role(s): ${invalidRoles.join(', ')}`);
        const q = (args.search ?? '').trim().toLowerCase();
        const matched = [];
        for (const record of this.records) {
            if (q) {
                const haystack = [record.study_unit_id ?? '', record.title ?? '', ...(record.report_ids ?? []), record.population_or_indication ?? ''].map(String).join(' ').toLowerCase();
                if (!haystack.includes(q))
                    continue;
            }
            let ok = true;
            for (const [field, allowedRaw] of Object.entries(filters)) {
                const allowed = [...allowedRaw];
                if (!allowed.length)
                    continue;
                if (!allowed.some(v => Object.is(record[field], v))) {
                    ok = false;
                    break;
                }
            }
            if (!ok)
                continue;
            const roles = new Set(record.functional_roles ?? []);
            if (roleInclude.some(role => !roles.has(role)))
                continue;
            if (roleExclude.some(role => roles.has(role)))
                continue;
            matched.push(record);
        }
        matched.sort((a, b) => {
            const ai = String(a.study_unit_id ?? ''), bi = String(b.study_unit_id ?? '');
            if (ai < bi)
                return -1;
            if (ai > bi)
                return 1;
            const at = String(a.title ?? ''), bt = String(b.title ?? '');
            return at < bt ? -1 : at > bt ? 1 : 0;
        });
        const page = Math.max(Math.trunc(args.page ?? 1), 1);
        const pageSize = Math.min(Math.max(Math.trunc(args.page_size ?? 50), 1), 103);
        const start = (page - 1) * pageSize;
        return { total: matched.length, records: matched.slice(start, start + pageSize), page, page_size: pageSize };
    }
    crosstab(fieldA, fieldB, records) {
        if (!CROSSTAB_FIELDS.has(fieldA) || !CROSSTAB_FIELDS.has(fieldB))
            throw new Error('Unsupported crosstab field');
        const source = records ? [...records] : [...this.records];
        const rows = orderedValues(source, fieldA), cols = orderedValues(source, fieldB);
        const cells = rows.map(row => cols.map(col => source.filter(r => Object.is(r[fieldA], row) && Object.is(r[fieldB], col)).length));
        return { field_a: fieldA, field_b: fieldB, rows, cols, cells, denominator: source.length };
    }
    groupBy(field, records) {
        if (!CROSSTAB_FIELDS.has(field) && !OPTION_FIELDS.includes(field))
            throw new Error('Unsupported group-by field');
        const source = records ? [...records] : [...this.records];
        const values = orderedValues(source, field);
        return values.map(value => ({ value, n: source.filter(r => Object.is(r[field], value)).length }));
    }
}