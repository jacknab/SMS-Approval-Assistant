import { useMemo, useState } from 'react';
import {
  AlertTriangle, Check, Code2, Copy, MessageSquareText, ShieldCheck,
} from 'lucide-react';
import type { Business } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const optInMethodLabels: Record<string, string> = {
  website_form: 'Website form',
  keyword: 'Text a keyword',
  point_of_sale: 'Point of sale',
  paper_form: 'Paper form',
  verbal: 'Verbal',
  other: 'Other',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]!);
}

function makeDisclosure(business: Business): string {
  if (business.consentCopy?.trim()) return business.consentCopy.trim();
  const brand = business.brandName.trim() || '[your brand name]';
  const purpose = business.campaignDescription.trim() || '[describe the messages customers will receive]';
  const frequency = business.messageFrequency.trim() || '[state how often messages are sent]';
  return `By checking this box, I agree to receive recurring SMS messages from ${brand} about ${purpose}. Message frequency: ${frequency}. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of purchase.`;
}

function makeOptInHtml(business: Business, disclosure: string): string {
  const materialsArePublished = Boolean(
    business.publicSlug && business.privacyPolicyText && business.smsTermsText,
  );
  const materialsUrl = materialsArePublished
    ? `${window.location.origin}${basePath}/compliance/${encodeURIComponent(business.publicSlug!)}`
    : 'REPLACE_WITH_YOUR_PUBLIC_PRIVACY_AND_SMS_TERMS_URL';
  const linkComment = materialsArePublished
    ? ''
    : '<!-- Replace this placeholder with a public HTTPS page containing your privacy policy and SMS terms. -->\n';

  return [
    '<!-- Add this inside your existing sign-up form, before its submit button. -->',
    '<fieldset class="sms-consent">',
    '  <legend>Optional text message updates</legend>',
    '  <label for="sms-consent">',
    '    <input id="sms-consent" name="sms_consent" type="checkbox" value="yes">',
    `    <span>${escapeHtml(disclosure)}</span>`,
    '  </label>',
    `  ${linkComment}<p>Read our <a href="${escapeHtml(materialsUrl)}">Privacy Policy and SMS Terms</a>.</p>`,
    '</fieldset>',
    '',
    '<!-- Keep this checkbox optional and unchecked by default. This HTML does not submit or store consent. -->',
  ].join('\n');
}

export function WebsiteOptInKit({
  business,
  onEditProfile,
}: {
  business: Business;
  onEditProfile: () => void;
}) {
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [copiedAllMessages, setCopiedAllMessages] = useState(false);
  const { toast } = useToast();
  const disclosure = useMemo(() => makeDisclosure(business), [business]);
  const html = useMemo(() => makeOptInHtml(business, disclosure), [business, disclosure]);
  const usesDraftDisclosure = !business.consentCopy?.trim();
  const hasPublicMaterials = Boolean(
    business.publicSlug && business.privacyPolicyText && business.smsTermsText,
  );
  const messages = business.sampleMessages.filter(message => message.trim());

  const copy = async (text: string, subject: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${subject} copied` });
      return true;
    } catch {
      toast({ title: `Could not copy ${subject.toLowerCase()}`, description: 'Select the text and copy it manually.', variant: 'destructive' });
      return false;
    }
  };

  const copyWithConfirmation = (text: string, subject: string, setCopied: (copied: boolean) => void) => {
    void copy(text, subject).then(success => {
      if (!success) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return <section id="section-website-opt-in-kit" className="mt-7 overflow-hidden rounded-2xl border border-card-border bg-card surface-shadow" data-testid="section-website-opt-in-kit">
    <div className="flex flex-col justify-between gap-4 border-b border-border bg-[hsl(174_31%_94%)] p-5 sm:flex-row sm:items-center sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Code2 size={19} /></span>
        <div><div className="font-mono text-[10px] uppercase tracking-[.18em] text-primary">Website setup kit</div><h2 className="font-display mt-1 text-xl font-bold">Opt-in code and message examples</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Copy a starter checkbox snippet and the sample messages saved for this campaign.</p></div>
      </div>
      <Button type="button" data-testid="button-copy-website-opt-in-html" onClick={() => copyWithConfirmation(html, 'Website opt-in HTML', setCopiedHtml)} className="shrink-0 gap-2 rounded-xl">{copiedHtml ? <Check size={15} /> : <Copy size={15} />}{copiedHtml ? 'HTML copied' : 'Copy HTML'}</Button>
    </div>

    <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[1.1fr_.9fr]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="text-sm font-bold">Optional SMS consent checkbox</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">The statement uses your saved consent text when available; otherwise it creates an editable starting draft from this profile.</p></div>
          <button type="button" onClick={onEditProfile} data-testid="button-edit-consent-for-snippet" className="text-xs font-bold text-primary hover:underline">Edit saved wording</button>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-[hsl(42_31%_97%)] p-4" data-testid="website-opt-in-preview">
          <div className="flex items-start gap-3">
            <input aria-label="Preview of an unchecked optional SMS consent checkbox" type="checkbox" disabled className="mt-1 h-4 w-4 shrink-0 accent-primary" />
            <div className="text-xs leading-5 text-foreground">{disclosure}<p className="mt-2"><span className="font-semibold text-primary underline">Privacy Policy and SMS Terms</span></p></div>
          </div>
        </div>
        <pre className="mt-4 max-h-[320px] overflow-auto rounded-xl bg-[hsl(174_29%_17%)] p-4 text-[11px] leading-5 text-[hsl(42_28%_93%)]" data-testid="website-opt-in-html"><code>{html}</code></pre>
        {usesDraftDisclosure && <p className="mt-3 flex items-start gap-2 rounded-lg border border-[hsl(38_45%_77%)] bg-[hsl(40_50%_93%)] p-3 text-xs leading-5 text-[hsl(174_13%_35%)]" data-testid="website-opt-in-draft-warning"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-[hsl(34_57%_43%)]" />This is a draft, not saved consent language. Review it against your actual sign-up flow before publishing.</p>}
        {business.optInMethod !== 'website_form' && <p className="mt-3 flex items-start gap-2 rounded-lg border border-[hsl(38_45%_77%)] bg-[hsl(40_50%_93%)] p-3 text-xs leading-5 text-[hsl(174_13%_35%)]" data-testid="website-opt-in-method-warning"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-[hsl(34_57%_43%)]" />Your saved profile says customers opt in by {optInMethodLabels[business.optInMethod] ?? business.optInMethod}. This snippet adds a website opt-in path; use it only if that matches your real customer flow.</p>}
      </div>

      <div className="space-y-5">
        <section className="rounded-xl border border-border bg-background p-4" data-testid="website-opt-in-implementation-notes">
          <h3 className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16} className="text-primary" />Before adding it to your site</h3>
          <ul className="mt-3 space-y-2.5 text-xs leading-5 text-muted-foreground">
            <li>Keep the checkbox optional, separate from other terms, and unchecked by default.</li>
            <li>Replace the policy link placeholder with a public HTTPS page before publishing.</li>
            <li>If you copied this while using a preview, replace its temporary domain with the app's live published domain.</li>
            <li>Connect your form handler to record the phone number, timestamp, source, and exact consent wording shown.</li>
            <li>This markup does not submit the form, store consent, or send texts. Wire those steps into your own website and messaging system.</li>
          </ul>
          {!hasPublicMaterials && <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-[hsl(34_57%_43%)]" data-testid="website-opt-in-materials-warning">Your public privacy and SMS terms are not published yet. Generate them in the Public materials panel before replacing the link placeholder.</p>}
        </section>

        <section className="rounded-xl border border-border bg-background p-4" data-testid="website-opt-in-sample-messages">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="flex items-center gap-2 text-sm font-bold"><MessageSquareText size={16} className="text-primary" />Sample messages</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Use examples that match your real program and submitted campaign.</p></div>
            {messages.length > 0 && <Button type="button" variant="outline" size="sm" data-testid="button-copy-all-sample-messages" onClick={() => copyWithConfirmation(messages.join('\n'), 'Sample messages', setCopiedAllMessages)} className="gap-1.5 rounded-lg text-xs">{copiedAllMessages ? <Check size={13} /> : <Copy size={13} />}{copiedAllMessages ? 'Copied' : 'Copy all'}</Button>}
          </div>
          {messages.length ? <ol className="mt-4 space-y-3">{messages.map((message, index) => <li key={`${index}-${message}`} className="rounded-lg border border-border bg-muted/50 p-3" data-testid={`website-sample-message-${index}`}>
            <div className="flex items-start justify-between gap-3"><p className="min-w-0 whitespace-pre-wrap text-xs leading-5 text-foreground">{message}</p><button type="button" aria-label={`Copy sample message ${index + 1}`} data-testid={`button-copy-sample-message-${index}`} onClick={() => { void copy(message, `Sample message ${index + 1}`); }} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-primary"><Copy size={14} /></button></div>
          </li>)}</ol> : <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-xs leading-5 text-muted-foreground" data-testid="website-no-sample-messages">No sample messages are saved yet. Prepare wording with the campaign assistant above or add examples to the business profile.<button type="button" onClick={onEditProfile} className="ml-1 font-bold text-primary hover:underline">Edit profile</button></div>}
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Before use, check that each sample identifies {business.brandName || 'your brand'} and matches the message purpose, frequency, and consent customers actually see.</p>
        </section>
      </div>
    </div>
  </section>;
}
