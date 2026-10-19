const EXPECTED = {
    study_units: 103,
    reports: 104,
    dt: { 'DT+': 73, 'DT-': 30 },
    vct: { 'VCT-': 54, 'VCT+': 49 },
    cells: { 'DT+ / VCT+': 47, 'DT+ / VCT-': 26, 'DT- / VCT+': 2, 'DT- / VCT-': 28 },
    levels: { 'DT-L2': 45, 'DT-L1': 28, '__NULL__': 30 },
    tm: { 'TM1': 47, 'TM0': 19, 'TM2': 7, '__NULL__': 30 },
};
function counter(records, field) {
    const out = {};
    for (const r of records) {
        const raw = r[field];
        const key = raw === null || raw === undefined ? '__NULL__' : String(raw);
        out[key] = (out[key] ?? 0) + 1;
    }
    return out;
}
function sameCounts(actual, expected) {
    const a = Object.keys(actual).sort();
    const e = Object.keys(expected).sort();
    return a.length === e.length && a.every((k, i) => k === e[i] && actual[k] === expected[k]);
}
export function validateRecords(records) {
    const errors = [];
    if (records.length !== EXPECTED.study_units)
        errors.push(`study-unit count ${records.length} != 103`);
    const ids = records.map(r => r.study_unit_id);
    if (new Set(ids).size !== ids.length)
        errors.push('duplicate study_unit_id');
    if (records.reduce((s, r) => s + Number(r.report_count ?? 0), 0) !== EXPECTED.reports)
        errors.push('report_count sum != 104');
    const reportIds = records.flatMap(r => Array.isArray(r.report_ids) ? r.report_ids : []);
    if (reportIds.length !== 104 || new Set(reportIds).size !== 104)
        errors.push('report_ids are not exactly 104 unique IDs');
    if (records.filter(r => Number(r.report_count ?? 0) > 1).length !== 1)
        errors.push('expected exactly one multi-report study unit');
    if (!sameCounts(counter(records, 'dt_capability'), EXPECTED.dt))
        errors.push('DT aggregate mismatch');
    if (!sameCounts(counter(records, 'vct_capability'), EXPECTED.vct))
        errors.push('VCT aggregate mismatch');
    if (!sameCounts(counter(records, 'dt_vct_cell'), EXPECTED.cells))
        errors.push('DTxVCT cell mismatch');
    if (!sameCounts(counter(records, 'dt_level'), EXPECTED.levels))
        errors.push('DT-level aggregate mismatch');
    if (!sameCounts(counter(records, 'temporal_lifecycle_class'), EXPECTED.tm))
        errors.push('TM aggregate mismatch');
    if (records.filter(r => r.multimodal_instantiation_current === true).length !== 8)
        errors.push('current multimodal count mismatch');
    if (records.filter(r => r.legacy_multimodal === true).length !== 19)
        errors.push('legacy multimodal count mismatch');
    for (const r of records) {
        if (r.corpus_status !== 'canonical_review')
            errors.push(`${r.study_unit_id}: noncanonical corpus_status`);
        if (r.classification_status !== 'canonical')
            errors.push(`${r.study_unit_id}: noncanonical classification_status`);
        if (r.included_in_review_counts !== true)
            errors.push(`${r.study_unit_id}: excluded from canonical counts`);
        if (r.dt_capability === 'DT-') {
            for (const k of ['dt_level', 'direct_patient_record_input', 'forward_state_propagation', 'post_instantiation_assimilation', 'temporal_lifecycle_class']) {
                if (r[k] !== null && r[k] !== undefined)
                    errors.push(`${r.study_unit_id}: DT- has non-null ${k}`);
            }
        }
    }
    return errors;
}