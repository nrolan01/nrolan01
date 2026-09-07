// Field names must match the columns you create in the Airtable "Episodes" table exactly.
const FIELDS = {
  OCCURRED_AT: 'Occurred At',   // Airtable "Date" field type, with "include a time field" turned on
  DURATION: 'Duration (min)',   // Number
  INTENSITY: 'Intensity',       // Single select: 1..5
  SYMPTOMS: 'Symptoms',         // Multiple select
  ACTIVITY: 'Activity',         // Single line text
  HEART_RATE: 'Heart Rate (bpm)', // Number
  NOTES: 'Notes',               // Long text
  EKG: 'EKG PDF',                // Attachment (used starting Phase 2)
};

// Must match the "Symptoms" multiple-select choices in the Airtable Episodes table exactly.
const SYMPTOM_OPTIONS = [
  'Light Headed',
  'Heart Racing',
  'Skipped Beat',
  'Tingling/Weak Arms',
  'Short of Breath',
  'Chest Pain/Pressure',
  'Fainting/Near-Fainting',
  'Sweating',
  'Fatigue',
  'Diaphragm Quivering',
  'Other',
];

const INTENSITY_OPTIONS = [
  { value: '1', label: '1 – Barely noticeable' },
  { value: '2', label: '2 – Mild' },
  { value: '3', label: '3 – Moderate' },
  { value: '4', label: '4 – Strong' },
  { value: '5', label: '5 – Severe' },
];
