export const MODE2_FILTER_FIELDS = new Set(['candidate_disposition', 'evidence_access_level', 'classification_status', 'dt_capability', 'vct_capability', 'verification_outcome', 'review_state']);
export class EmergingUIStore {
    // v1.3 first Sites port intentionally reproduces the current production empty store.
    candidates = [];
    summary() {
        return {
            mode: 'emerging_evidence_explorer', exploratory_not_exhaustive: true, included_in_canonical_denominator: 0,
            candidate_count: 0, eligible_emerging: 0, duplicate_blocked_or_review: 0, evidence_package_count: 0,
            assessment_count: 0, verified_provisional: 0, human_review_required: 0, pending_human_review: 0,
            evidence_access_counts: {}, classification_status_counts: {}
        };
    }
    options() {
        return Object.fromEntries([...MODE2_FILTER_FIELDS].map(field => [field, []]));
    }
    query(args = {}) {
        const page = args.page ?? 1, pageSize = args.page_size ?? 50;
        if (page < 1 || ![25, 50, 100].includes(pageSize))
            throw new Error('Invalid pagination');
        for (const field of Object.keys(args.filters ?? {}))
            if (!MODE2_FILTER_FIELDS.has(field))
                throw new Error(`Unsupported Mode 2 filter: ${field}`);
        return { total: 0, page, page_size: pageSize, records: [] };
    }
    detail(_rid) { return null; }
    reviewQueue(_state) { return []; }
}