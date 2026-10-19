export const PUBLICATION_MAPPING = {
  "schema_version": "1.0",
  "status": "publication-facing display mapping for G10; no recoding authorized",
  "principles": {
    "preserve_internal_codes": true,
    "preserve_storage_keys": true,
    "preserve_frozen_counts": true,
    "display_semantic_labels_first": true,
    "retain_legacy_query_aliases": true
  },
  "dimensions": {
    "X": {
      "internal_field_aliases": [
        "X",
        "x_axis"
      ],
      "publication_facet": "Evidence provenance",
      "scale_type": "nominal",
      "values": {
        "X0": "No trial-structured comparison",
        "X1": "Observed-outcome evidence",
        "X2": "Hybrid evidence",
        "X3": "Model-generated principal evidence"
      }
    },
    "Y": {
      "internal_field_aliases": [
        "Y",
        "y_axis"
      ],
      "publication_facet": "Assumption scrutiny",
      "scale_type": "Y0 applicability state; Y1-Y2b ordered only among applicable claims",
      "values": {
        "Y0": "Not applicable",
        "Y1": "Implicit or weakly stated",
        "Y2a": "Explicitly stated",
        "Y2b": "Directly tested"
      },
      "notes": {
        "Y0": "No comparative or simulated-outcome claim required an assumption warrant. Y0 is not the lowest scrutiny grade."
      }
    },
    "V": {
      "internal_field_aliases": [
        "V",
        "validation"
      ],
      "publication_facet": "Evaluation scope",
      "scale_type": "ordered scope; not a universal quality ranking",
      "values": {
        "V0": "No qualifying evaluation",
        "V1": "Internal evaluation/calibration",
        "V2": "Independent external benchmark"
      }
    }
  },
  "query_aliases": {
    "X3": [
      "X3",
      "model-generated principal evidence",
      "model generated principal evidence"
    ],
    "Y0": [
      "Y0",
      "assumption scrutiny not applicable",
      "not applicable assumption scrutiny"
    ],
    "Y1": [
      "Y1",
      "implicit assumption",
      "weakly stated assumption",
      "implicit or weakly stated"
    ],
    "Y2a": [
      "Y2a",
      "explicitly stated assumption",
      "explicit assumption"
    ],
    "Y2b": [
      "Y2b",
      "directly tested assumption",
      "direct testing",
      "directly tested load-bearing assumption"
    ],
    "V0": [
      "V0",
      "no qualifying evaluation"
    ],
    "V1": [
      "V1",
      "internal evaluation",
      "internal calibration",
      "internal evaluation/calibration"
    ],
    "V2": [
      "V2",
      "external validation",
      "V2 validation",
      "external benchmark",
      "independent external benchmark",
      "independent external benchmarking"
    ]
  },
  "display_rules": {
    "default_ui": "Render publication-facing facet and value labels; do not require users to decode X/Y/V codes.",
    "technical_traceability": "Internal code may be shown secondarily only where traceability materially helps, e.g. 'Model-generated principal evidence (internal code X3)'.",
    "chips": "Use '<Publication facet>: <Publication value>'.",
    "results": "Use publication-facing labels in result summaries and detail panels.",
    "exports": "Prefer publication-facing labels while preserving internal code fields if exports already contain them.",
    "nlq": "Accept both semantic and legacy/internal aliases, but render the interpreted filter back to the user using publication-facing labels."
  }
};
const fields = {x_axis:'X',y_axis:'Y',validation:'V'};
export const publicationDimensions = Object.fromEntries(Object.entries(fields).map(([field,key])=>[field,PUBLICATION_MAPPING.dimensions[key]]));
export function fieldLabel(field){ return publicationDimensions[field]?.publication_facet ?? String(field??'').replaceAll('_',' '); }
export function valueLabel(field,value){
  if(Array.isArray(value)) return value.map(v=>valueLabel(field,v)).join(' OR ');
  return publicationDimensions[field]?.values[value] ?? (value===null||value===undefined||value===''?'—':String(value).replaceAll('_',' '));
}
export function publicationText(text){
  return String(text??'').replace(/\bV2 validation\b/g,PUBLICATION_MAPPING.dimensions.V.values.V2)
    .replace(/composite X\/Y\/V score/g,'composite score across evidence provenance, assumption scrutiny, and evaluation scope')
    .replace(/\bX\/Y\/V\b/g,'evidence provenance / assumption scrutiny / evaluation scope')
    .replace(/\b(?:x_axis|y_axis|validation)\b/g,fieldLabel)
    .replace(/\b(?:X[0-3]|Y0|Y1|Y2a|Y2b|V[0-2])\b/g,code=>{
      const dim=Object.values(publicationDimensions).find(d=>Object.hasOwn(d.values,code));return dim?.values[code]??code;
    });
}
export const publicationAliases = Object.entries(publicationDimensions).flatMap(([field,dim])=>Object.entries(dim.values).flatMap(([code,label])=>{
  const terms=[...(PUBLICATION_MAPPING.query_aliases[code]??[]),...(code==='Y0'?[]:[label])];
  return [...new Set(terms)].map(term=>({term,field,value:code}));
}));
