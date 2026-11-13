/**
 * Built-in Template Definitions (Master Build Specification - Section 4 & 5)
 * Agnostic core - these 5 templates are copied to new organizations upon registration.
 */

const builtInTemplates = [
  {
    name: 'Invoice',
    description: 'Tax invoice or bill issued by a supplier for goods or services',
    keywords: ['invoice', 'tax invoice', 'bill to', 'GSTIN', 'invoice no'],
    isBuiltIn: true,
    fields: [
      { key: 'invoice_number', label: 'Invoice number', type: 'string', required: true },
      { key: 'invoice_date', label: 'Invoice date', type: 'date', required: true },
      { key: 'supplier_name', label: 'Supplier name', type: 'string', required: true },
      { key: 'supplier_gstin', label: 'Supplier GSTIN', type: 'string' },
      { key: 'buyer_name', label: 'Buyer name', type: 'string' },
      { key: 'buyer_gstin', label: 'Buyer GSTIN', type: 'string' },
      { key: 'taxable_amount', label: 'Taxable amount', type: 'number' },
      { key: 'cgst', label: 'CGST', type: 'number' },
      { key: 'sgst', label: 'SGST', type: 'number' },
      { key: 'igst', label: 'IGST', type: 'number' },
      { key: 'total_amount', label: 'Total amount', type: 'number', required: true },
      {
        key: 'line_items',
        label: 'Line items',
        type: 'table',
        columns: [
          { key: 'description', label: 'Description', type: 'string' },
          { key: 'quantity', label: 'Qty', type: 'number' },
          { key: 'rate', label: 'Rate', type: 'number' },
          { key: 'amount', label: 'Amount', type: 'number' }
        ]
      }
    ],
    rules: [
      {
        type: 'regex',
        field: 'supplier_gstin',
        pattern: '^\\d{2}[A-Z]{5}\\d{4}[A-Z]{1}[A-Z\\d]{1}Z[A-Z\\d]{1}$',
        message: 'Supplier GSTIN format is invalid',
        severity: 'error'
      },
      {
        type: 'regex',
        field: 'buyer_gstin',
        pattern: '^\\d{2}[A-Z]{5}\\d{4}[A-Z]{1}[A-Z\\d]{1}Z[A-Z\\d]{1}$',
        message: 'Buyer GSTIN format is invalid',
        severity: 'warning'
      },
      {
        type: 'table_sum_equals',
        table: 'line_items',
        column: 'amount',
        target: 'taxable_amount',
        tolerance: 1,
        message: 'Line items sum must equal taxable amount',
        severity: 'warning'
      },
      {
        type: 'sum_of_fields_equals',
        fields: ['taxable_amount', 'cgst', 'sgst', 'igst'],
        target: 'total_amount',
        tolerance: 1,
        message: 'Taxable amount + taxes must equal total amount',
        severity: 'error'
      },
      {
        type: 'unique_in_org',
        fields: ['invoice_number', 'supplier_gstin'],
        message: 'Possible duplicate invoice (duplicate invoice number and supplier GSTIN)',
        severity: 'warning'
      }
    ]
  },
  {
    name: 'Contract or Agreement',
    description: 'Commercial contract, NDA, service agreement or terms between parties',
    keywords: ['agreement', 'contract', 'parties', 'undertaking', 'covenant', 'jurisdiction'],
    isBuiltIn: true,
    fields: [
      { key: 'agreement_title', label: 'Agreement title', type: 'string', required: true },
      { key: 'parties', label: 'Parties', type: 'list', required: true },
      { key: 'effective_date', label: 'Effective date', type: 'date' },
      { key: 'end_date', label: 'End date', type: 'date' },
      { key: 'term', label: 'Term/Duration', type: 'string' },
      { key: 'payment_terms', label: 'Payment terms', type: 'string' },
      { key: 'termination_clause', label: 'Termination clause', type: 'string' },
      { key: 'governing_law', label: 'Governing law', type: 'string' },
      { key: 'key_obligations', label: 'Key obligations', type: 'list' }
    ],
    rules: [
      {
        type: 'required',
        field: 'agreement_title',
        message: 'Agreement title is required',
        severity: 'error'
      },
      {
        type: 'required',
        field: 'parties',
        message: 'At least one party must be specified',
        severity: 'error'
      },
      {
        type: 'date_order',
        before: 'effective_date',
        after: 'end_date',
        message: 'Effective date must precede end date',
        severity: 'warning'
      }
    ]
  },
  {
    name: 'Mark Sheet',
    description: 'Academic mark sheet, grade card or transcript from a college or school',
    keywords: ['mark sheet', 'marks card', 'statement of marks', 'register number', 'semester', 'grade point', 'result'],
    isBuiltIn: true,
    fields: [
      { key: 'student_name', label: 'Student name', type: 'string', required: true },
      { key: 'register_number', label: 'Register number', type: 'string', required: true },
      { key: 'institution', label: 'Institution / College', type: 'string' },
      { key: 'course', label: 'Course / Degree', type: 'string' },
      { key: 'semester', label: 'Semester', type: 'string' },
      { key: 'exam_session', label: 'Exam session', type: 'string' },
      {
        key: 'subjects',
        label: 'Subjects',
        type: 'table',
        columns: [
          { key: 'code', label: 'Subject code', type: 'string' },
          { key: 'name', label: 'Subject name', type: 'string' },
          { key: 'marks', label: 'Marks', type: 'number' },
          { key: 'grade', label: 'Grade', type: 'string' }
        ]
      },
      { key: 'total_marks', label: 'Total marks', type: 'number' },
      { key: 'result', label: 'Result (Pass/Fail)', type: 'string' }
    ],
    rules: [
      {
        type: 'required',
        field: 'student_name',
        message: 'Student name is required',
        severity: 'error'
      },
      {
        type: 'required',
        field: 'register_number',
        message: 'Register number is required',
        severity: 'error'
      },
      {
        type: 'table_sum_equals',
        table: 'subjects',
        column: 'marks',
        target: 'total_marks',
        tolerance: 0,
        message: 'Sum of subject marks must equal total marks',
        severity: 'warning'
      }
    ]
  },
  {
    name: 'Lab Report',
    description: 'Medical laboratory diagnostic report, blood test or pathology report',
    keywords: ['lab report', 'laboratory', 'pathology', 'patient name', 'specimen', 'reference interval', 'investigation'],
    isBuiltIn: true,
    fields: [
      { key: 'patient_name', label: 'Patient name', type: 'string', required: true },
      { key: 'patient_id', label: 'Patient ID / UHID', type: 'string' },
      { key: 'age', label: 'Age', type: 'string' },
      { key: 'gender', label: 'Gender', type: 'string' },
      { key: 'report_date', label: 'Report date', type: 'date', required: true },
      { key: 'referring_doctor', label: 'Referring doctor', type: 'string' },
      { key: 'lab_name', label: 'Laboratory / Hospital name', type: 'string' },
      {
        key: 'tests',
        label: 'Tests',
        type: 'table',
        columns: [
          { key: 'test_name', label: 'Test name', type: 'string' },
          { key: 'value', label: 'Value', type: 'string' },
          { key: 'unit', label: 'Unit', type: 'string' },
          { key: 'reference_range', label: 'Reference range', type: 'string' },
          { key: 'flag', label: 'Flag (High/Low/Normal)', type: 'string' }
        ]
      }
    ],
    rules: [
      {
        type: 'required',
        field: 'patient_name',
        message: 'Patient name is required',
        severity: 'error'
      },
      {
        type: 'required',
        field: 'report_date',
        message: 'Report date is required',
        severity: 'error'
      }
    ]
  },
  {
    name: 'Purchase Order',
    description: 'Commercial purchase order sent to a vendor or contractor',
    keywords: ['purchase order', 'po number', 'vendor', 'delivery date', 'ship to', 'p.o. no'],
    isBuiltIn: true,
    fields: [
      { key: 'po_number', label: 'PO number', type: 'string', required: true },
      { key: 'po_date', label: 'PO date', type: 'date', required: true },
      { key: 'vendor_name', label: 'Vendor name', type: 'string', required: true },
      { key: 'delivery_date', label: 'Delivery date', type: 'date' },
      { key: 'total_amount', label: 'Total amount', type: 'number', required: true },
      {
        key: 'line_items',
        label: 'Line items',
        type: 'table',
        columns: [
          { key: 'description', label: 'Description', type: 'string' },
          { key: 'quantity', label: 'Qty', type: 'number' },
          { key: 'rate', label: 'Rate', type: 'number' },
          { key: 'amount', label: 'Amount', type: 'number' }
        ]
      }
    ],
    rules: [
      {
        type: 'required',
        field: 'po_number',
        message: 'PO number is required',
        severity: 'error'
      },
      {
        type: 'table_sum_equals',
        table: 'line_items',
        column: 'amount',
        target: 'total_amount',
        tolerance: 1,
        message: 'Sum of line item amounts must match total amount',
        severity: 'warning'
      },
      {
        type: 'date_order',
        before: 'po_date',
        after: 'delivery_date',
        message: 'PO date must precede delivery date',
        severity: 'warning'
      },
      {
        type: 'unique_in_org',
        fields: ['po_number'],
        message: 'Duplicate PO number in this organization',
        severity: 'warning'
      }
    ]
  }
];

const genericTemplate = {
  name: 'Other',
  description: 'Generic document format when no specific template matches',
  keywords: [],
  isBuiltIn: true,
  fields: [
    { key: 'document_title', label: 'Document title', type: 'string' },
    { key: 'document_date', label: 'Document date', type: 'date' },
    { key: 'parties', label: 'Parties / Entities', type: 'list' },
    { key: 'key_points', label: 'Key points / Summary', type: 'list' }
  ],
  rules: []
};

module.exports = {
  builtInTemplates,
  genericTemplate
};

