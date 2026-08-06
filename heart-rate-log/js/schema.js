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

const SYMPTOM_OPTIONS = [
  'Lightheadedness',
  'Skipped beats / palpitations',
  'Racing heart',
  'Chest discomfort',
  'Shortness of breath',
  'Fatigue',
  'Other',
];

const INTENSITY_OPTIONS = [
  { value: '1', label: '1 – Barely noticeable' },
  { value: '2', label: '2 – Mild' },
  { value: '3', label: '3 – Moderate' },
  { value: '4', label: '4 – Strong' },
  { value: '5', label: '5 – Severe' },
];
