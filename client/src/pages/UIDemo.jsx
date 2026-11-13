import React, { useState } from 'react';
import {
  Button,
  IconButton,
  Input,
  Select,
  Textarea,
  Switch,
  Checkbox,
  SegmentedControl,
  Card,
  InsetGroupedList,
  StatusBadge,
  ConfidenceBar,
  Modal,
  Sheet,
  Toast,
  Skeleton,
  EmptyState,
  ErrorState
} from '../ui';
import {
  Sun,
  Moon,
  Zap,
  Folder,
  FileText,
  User,
  Shield,
  UploadCloud,
  Check,
  Search
} from 'lucide-react';
import { setLiteMode, getLiteMode } from '../lib/performance';

export default function UIDemo() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [isLite, setIsLite] = useState(() => getLiteMode());
  const [segmentedVal, setSegmentedVal] = useState('all');
  const [switchVal, setSwitchVal] = useState(true);
  const [checkVal, setCheckVal] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
  };

  const toggleLite = () => {
    const next = !isLite;
    setIsLite(next);
    setLiteMode(next);
  };

  const groupedListItems = [
    { title: 'Organization Name', subtitle: 'Global multi-tenant setting', value: 'Acme Corp', icon: <Shield className="w-4 h-4" /> },
    { title: 'Security Protocol', subtitle: 'Strict JWT Org-Isolation', value: 'Active', icon: <Check className="w-4 h-4" /> },
    { title: 'Document Categories', subtitle: '5 Agnostic Templates', value: 'Configured', icon: <Folder className="w-4 h-4" />, onClick: () => alert('Clicked!') }
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-6 md:p-12 transition-colors duration-200">
      {/* Top Header & Theme Controls */}
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-black/10 dark:border-white/10">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#007AFF]">iOS-Premium Design System</span>
            <h1 className="text-3xl font-bold tracking-tight text-[#1C1C1E] dark:text-[#F2F2F7] mt-1">
              DocuMind Component Library (/ui)
            </h1>
            <p className="text-sm text-[#6B7280] mt-1">
              Solid surfaces for content, glass only on navigation & overlays, ultra-fast 60 FPS transitions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={isDark ? Sun : Moon}
              onClick={toggleDark}
            >
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </Button>
            <Button
              variant={isLite ? 'primary' : 'secondary'}
              size="sm"
              icon={Zap}
              onClick={toggleLite}
            >
              {isLite ? 'Lite Mode (ON)' : 'Lite Mode (OFF)'}
            </Button>
          </div>
        </header>

        {showToast && (
          <Toast
            message="This is an iOS glass pill toast notification"
            type="success"
            onDismiss={() => setShowToast(false)}
          />
        )}

        {/* 1. Status Badges (Section 6 & 11) */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">1. Standard Document Status Badges</h2>
          <Card className="flex flex-wrap items-center gap-3">
            <StatusBadge status="uploaded" />
            <StatusBadge status="queued" />
            <StatusBadge status="processing" />
            <StatusBadge status="needs_review" />
            <StatusBadge status="completed" />
            <StatusBadge status="reviewed" />
            <StatusBadge status="failed" />
          </Card>
        </section>

        {/* 2. Buttons & Interactions */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">2. iOS Buttons & Segmented Controls</h2>
          <Card className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="plain">Plain Button</Button>
              <Button variant="destructive">Destructive Button</Button>
              <Button variant="primary" loading>Loading</Button>
              <Button variant="secondary" disabled>Disabled</Button>
              <IconButton icon={Search} label="Search" />
            </div>

            <div className="pt-4 border-t border-black/5 dark:border-white/10 flex flex-wrap items-center gap-6">
              <div>
                <span className="block text-xs text-[#6B7280] mb-2 font-medium">Segmented Control</span>
                <SegmentedControl
                  value={segmentedVal}
                  onChange={setSegmentedVal}
                  options={[
                    { label: 'All Documents', value: 'all' },
                    { label: 'Pending Review', value: 'review' },
                    { label: 'Approved', value: 'approved' }
                  ]}
                />
              </div>

              <div className="flex items-center gap-6">
                <Switch checked={switchVal} onChange={setSwitchVal} label="Enable Auto-OCR" />
                <Checkbox checked={checkVal} onChange={setCheckVal} label="Filter by Org" />
              </div>
            </div>
          </Card>
        </section>

        {/* 3. Form Inputs */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">3. Form Controls & Inputs</h2>
          <Card className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Input label="Organization ID" defaultValue="6af6a0e37302f65fd85f0e5b" readOnly />
            <Input label="Supplier GSTIN" placeholder="22AAAAA0000A1Z5" hint="Format: 15-character GSTIN" />
            <Input label="Validation Example" defaultValue="Invalid total" error="Taxable + taxes does not match total" />
            <Select
              label="Document Template"
              options={[
                { label: 'Tax Invoice (CA / Accounts)', value: 'invoice' },
                { label: 'Contract / Agreement (Legal)', value: 'contract' },
                { label: 'Student Mark Sheet (College)', value: 'marksheet' },
                { label: 'Diagnostic Lab Report (Hospital)', value: 'lab' },
                { label: 'Purchase Order (Procurement)', value: 'po' }
              ]}
            />
            <div className="md:col-span-2">
              <Textarea label="Extraction Schema Notes" placeholder="Enter notes..." rows={2} />
            </div>
          </Card>
        </section>

        {/* 4. Confidence Bar & Inset Lists */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">4. Confidence Indicators</h2>
            <Card className="space-y-4">
              <div>
                <div className="text-xs text-[#6B7280] mb-1">High Confidence (&gt;= 70%)</div>
                <ConfidenceBar score={0.95} />
              </div>
              <div>
                <div className="text-xs text-[#6B7280] mb-1">Low Confidence (&lt; 70% amber flag)</div>
                <ConfidenceBar score={0.52} />
              </div>
            </Card>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold">5. Inset Grouped List (Settings Style)</h2>
            <InsetGroupedList items={groupedListItems} />
          </div>
        </section>

        {/* 5. Modals, Sheets & Overlays */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">6. Overlays (Glass Modal & Sheet)</h2>
          <Card className="flex flex-wrap items-center gap-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(true)}>
              Open Glass Modal
            </Button>
            <Button variant="secondary" onClick={() => setIsSheetOpen(true)}>
              Open Side Sheet
            </Button>
            <Button variant="secondary" onClick={() => setShowToast(true)}>
              Trigger Toast
            </Button>
          </Card>
        </section>

        {/* 6. Feedback & Skeletons */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">7. Skeletons & Empty States</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="space-y-3">
              <span className="text-xs text-[#6B7280] font-medium">Loading Skeletons</span>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" count={3} />
            </Card>

            <EmptyState
              icon={UploadCloud}
              title="No Documents Uploaded"
              description="Drop PDF, PNG or JPEG files here to begin processing."
              actionLabel="Upload Files"
              onAction={() => alert('Trigger upload')}
            />
          </div>
        </section>

        {/* Modal Component */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Template Validation Sandbox"
        >
          <p className="text-sm text-[#6B7280] mb-4">
            This modal uses blurred backdrop glass in standard mode, and solid rendering in Lite mode.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => setIsModalOpen(false)}>
              Confirm
            </Button>
          </div>
        </Modal>

        {/* Sheet Component */}
        <Sheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          title="Document Metadata & Rules"
        >
          <div className="space-y-4">
            <p className="text-sm text-[#6B7280]">
              Inspection panel showing field coordinates, confidence tags, and rule validation messages.
            </p>
            <ErrorState message="Supplier GSTIN check failed: Checksum mismatch." onRetry={() => alert('Retrying...')} />
          </div>
        </Sheet>
      </div>
    </div>
  );
}

