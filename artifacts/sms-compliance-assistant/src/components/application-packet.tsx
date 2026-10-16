import { useMemo, useState } from 'react';
import {
  AlertTriangle, Check, ClipboardCheck, Copy, Download, ShieldCheck,
} from 'lucide-react';
import type { Business, ReadinessReport } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const entityLabels: Record<string, string> = {
  llc: 'LLC',
  corporation: 'Corporation',
  sole_proprietor: 'Sole proprietor',
  nonprofit: 'Nonprofit',
  public_company: 'Public company',
  other: 'Other',
};

const useCaseLabels: Record<string, string> = {
  account_notifications: 'Account notifications',
  customer_care: 'Customer care',
  marketing: 'Marketing',
  mixed: 'Mixed use case',
};

const optInLabels: Record<string, string> = {
  website_form: 'Website form',
  keyword: 'Text a keyword',
  point_of_sale: 'Point of sale',
  paper_form: 'Paper form',
  verbal: 'Verbal',
  other: 'Other',
};

function valueOrMissing(value: string | null | undefined): string {
  return value?.trim() || 'Not provided';
}

export function ApplicationPacket({
  business,
  report,
}: {
  business: Business;
  report: ReadinessReport | undefined;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const packet = useMemo(() => {
    const publicUrl = business.publicSlug
      ? `${window.location.origin}/compliance/${business.publicSlug}`
      : 'Not published';
    const messages = business.sampleMessages.length
      ? business.sampleMessages.map((message, index) => `${index + 1}. ${message}`).join('\n')
      : 'Not provided';
    const checks = report?.checks.length
      ? report.checks.map((check) => {
          const status = check.state === 'ready'
            ? 'READY'
            : check.state === 'blocking'
              ? 'BLOCKING'
              : 'REVIEW';
          return `- ${status}: ${check.title}\n  ${check.detail}`;
        }).join('\n')
      : 'Readiness checks are currently unavailable.';

    return [
      'SMS CAMPAIGN APPLICATION PREPARATION PACKET',
      `Business: ${valueOrMissing(business.businessName)}`,
      `Prepared: ${new Date().toLocaleDateString()}`,
      '',
      'IMPORTANT',
      'This packet is a preparation aid only. It is not submitted to Twilio or any carrier, and it cannot guarantee approval. Verify every detail against your actual business and customer consent flow before using it.',
      '',
      'BUSINESS PROFILE',
      `Legal business name: ${valueOrMissing(business.legalName)}`,
      `Public brand: ${valueOrMissing(business.brandName)}`,
      `Business type: ${entityLabels[business.entityType] ?? business.entityType}`,
      `Website: ${valueOrMissing(business.websiteUrl)}`,
      `Business email: ${valueOrMissing(business.contactEmail)}`,
      `Business address: ${[business.streetAddress, business.city, business.region, business.postalCode, business.country].filter(Boolean).join(', ') || 'Not provided'}`,
      '',
      'CAMPAIGN',
      `Use case: ${useCaseLabels[business.useCase] ?? business.useCase}`,
      `Description: ${valueOrMissing(business.campaignDescription)}`,
      `Expected frequency: ${valueOrMissing(business.messageFrequency)}`,
      'Sample messages:',
      messages,
      '',
      'OPT-IN AND CONSENT',
      `Opt-in method: ${optInLabels[business.optInMethod] ?? business.optInMethod}`,
      `How customers opt in: ${valueOrMissing(business.optInDescription)}`,
      `Separate, unchecked SMS checkbox: ${business.consentCheckboxPresent ? 'Yes' : 'No'}`,
      `Consent language: ${valueOrMissing(business.consentCopy)}`,
      '',
      'PUBLIC CUSTOMER MATERIALS',
      `Privacy policy and SMS terms page: ${publicUrl}`,
      'Open the page and verify the published wording matches your actual practices before sharing it.',
      '',
      'PRE-SUBMISSION CHECKS',
      `Readiness score: ${report ? `${report.score}/100` : 'Unavailable'}`,
      `Blocking checks: ${report?.blockingCount ?? '—'} · Needs review: ${report?.attentionCount ?? '—'}`,
      checks,
      '',
      'BEFORE YOU SUBMIT IN TWILIO',
      '- Resolve blocking items and review all flagged details above.',
      '- Confirm your business and brand information against official records in Twilio.',
      '- Keep evidence that customers actively opted in, and make sure your samples match the messages you actually send.',
      '- Approval is decided by Twilio, The Campaign Registry, and carriers; no outcome is guaranteed.',
    ].join('\n');
  }, [business, report]);

  const copyPacket = async () => {
    try {
      await navigator.clipboard.writeText(packet);
      setCopied(true);
      toast({ title: 'Packet copied', description: 'Paste it into your notes while completing the Twilio Console.' });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Could not copy packet', description: 'Use the download option instead.', variant: 'destructive' });
    }
  };

  const downloadPacket = () => {
    const file = new Blob([packet], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    const safeName = business.brandName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'business';
    anchor.href = url;
    anchor.download = `${safeName}-sms-application-preparation.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <section className="mt-7 overflow-hidden rounded-2xl border border-card-border bg-card surface-shadow" data-testid="section-application-packet">
    <div className="flex flex-col justify-between gap-5 bg-[hsl(174_29%_17%)] p-5 text-sidebar-foreground sm:flex-row sm:items-center sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(38_71%_67%)] text-[hsl(174_29%_16%)]"><ClipboardCheck size={19} /></span>
        <div><div className="font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(38_71%_67%)]">Twilio handoff</div><h2 className="font-display mt-1 text-xl font-bold">Your application packet</h2><p className="mt-1 max-w-xl text-xs leading-5 text-[hsl(42_15%_76%)]">Gather your business, campaign, and consent details in one place to reference as you complete the Twilio Console.</p></div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" data-testid="button-download-application-packet" onClick={downloadPacket} className="gap-2 rounded-xl border-[hsl(174_17%_42%)] bg-transparent text-sidebar-foreground hover:bg-[hsl(174_22%_24%)] hover:text-sidebar-foreground"><Download size={15} /> Download packet</Button>
        <Button type="button" data-testid="button-copy-application-packet" onClick={copyPacket} className="gap-2 rounded-xl bg-[hsl(38_71%_67%)] text-[hsl(174_29%_16%)] hover:bg-[hsl(38_71%_72%)]">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy packet'}</Button>
      </div>
    </div>
    <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
      <div className="flex items-start gap-3 rounded-xl border border-[hsl(38_45%_77%)] bg-[hsl(40_50%_93%)] p-4">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[hsl(34_57%_43%)]" />
        <p className="text-xs leading-5 text-[hsl(174_13%_35%)]"><strong>Review before using.</strong> The packet includes your saved details and readiness findings. Confirm they describe your real business and opt-in process; this app does not submit the application or promise approval.</p>
      </div>
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><ShieldCheck size={15} className="text-primary" /> Your information stays editable here</div>
    </div>
  </section>;
}
