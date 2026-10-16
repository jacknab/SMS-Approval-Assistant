import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle, AlertTriangle, Check, CircleHelp, FilePenLine, LoaderCircle,
  MessageSquareText, ScanSearch, Send, ShieldCheck, Sparkles,
} from 'lucide-react';
import {
  getGetBusinessQueryKey, getGetDashboardSummaryQueryKey, getGetReadinessQueryKey,
  getListBusinessesQueryKey, usePrepareCampaignAssistant, useUpdateBusiness,
  type Business, type BusinessUpdate, type CampaignAssistantDrafts,
  type CampaignAssistantInput, type CampaignAssistantOutput,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

type AssistantMode = CampaignAssistantInput['mode'];
type ChatMessage = { role: 'user' | 'assistant'; content: string };

const modes: { id: AssistantMode; label: string; description: string; Icon: typeof FilePenLine }[] = [
  { id: 'prepare', label: 'Prepare wording', description: 'Shape your saved details into editable registration drafts.', Icon: FilePenLine },
  { id: 'review', label: 'Review for gaps', description: 'Look for inconsistencies across your saved campaign and public materials.', Icon: ScanSearch },
  { id: 'answer', label: 'Ask a question', description: 'Get a plain-language explanation of the registration process.', Icon: CircleHelp },
];

type DraftKey = 'campaignDescription' | 'messageFrequency' | 'sampleMessages' | 'optInDescription' | 'consentCopy';
const draftFields: { key: DraftKey; label: string; help: string; rows: number }[] = [
  { key: 'campaignDescription', label: 'Campaign description', help: 'What the messages are for and who receives them.', rows: 4 },
  { key: 'messageFrequency', label: 'Message frequency', help: 'Confirm this matches your actual messaging schedule.', rows: 2 },
  { key: 'sampleMessages', label: 'Sample messages', help: 'One example per line. Check every detail before using.', rows: 5 },
  { key: 'optInDescription', label: 'Opt-in description', help: 'Where customers see the offer and how they choose to subscribe.', rows: 4 },
  { key: 'consentCopy', label: 'Consent copy', help: 'The disclosure shown before a customer opts in.', rows: 4 },
];

const suggestedQuestions = [
  'What should a clear opt-in description include?',
  'What do STOP and HELP instructions mean?',
];

function IssueList({ issues }: { issues: CampaignAssistantOutput['issues'] }) {
  if (!issues.length) {
    return <div className="rounded-xl border border-[hsl(147_30%_78%)] bg-[hsl(147_36%_94%)] px-4 py-3 text-sm leading-6 text-[hsl(157_32%_31%)]" data-testid="assistant-no-issues">
      No specific gaps surfaced from the information available. This is a preparation check, not an approval decision.
    </div>;
  }
  const blocking = issues.filter(issue => issue.severity === 'blocking');
  const review = issues.filter(issue => issue.severity === 'review');
  return <div className="space-y-4" data-testid="assistant-issues">
    {[
      { key: 'blocking', label: 'Needs attention first', items: blocking, icon: AlertCircle, style: 'border-[hsl(4_45%_82%)] bg-[hsl(4_65%_97%)] text-[hsl(4_48%_43%)]' },
      { key: 'review', label: 'Worth a closer look', items: review, icon: AlertTriangle, style: 'border-[hsl(38_45%_77%)] bg-[hsl(40_50%_93%)] text-[hsl(34_57%_43%)]' },
    ].filter(group => group.items.length > 0).map(group => <section key={group.key} data-testid={`assistant-issues-${group.key}`}>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.11em] text-muted-foreground"><group.icon size={14} />{group.label} <span className="font-mono">{group.items.length}</span></h3>
      <div className="space-y-2">{group.items.map((issue, index) => <article key={`${issue.title}-${index}`} className={`rounded-xl border p-4 ${group.style}`} data-testid={`assistant-issue-${group.key}-${index}`}>
        <h4 className="text-sm font-bold text-foreground">{issue.title}</h4>
        <p className="mt-1.5 text-xs leading-5 text-foreground/80">{issue.detail}</p>
        <p className="mt-2 border-t border-current/10 pt-2 text-xs leading-5 text-foreground/80"><span className="font-bold">Next step:</span> Review the related saved field or published wording, then update it with details that match your real customer flow.</p>
      </article>)}</div>
    </section>)}
  </div>;
}

function DraftEditor({ drafts, onChange }: { drafts: CampaignAssistantDrafts; onChange: (drafts: CampaignAssistantDrafts) => void }) {
  return <div className="grid gap-4 lg:grid-cols-2" data-testid="assistant-draft-editor">
    {draftFields.map(({ key, label, help, rows }) => {
      const value = key === 'sampleMessages'
        ? (drafts.sampleMessages as string[]).join('\n')
        : drafts[key] as string;
      return <label key={key} className="block space-y-2" data-testid={`assistant-draft-field-${key}`}>
        <span className="block text-sm font-bold">{label}</span>
        <Textarea
          data-testid={`input-assistant-draft-${key}`}
          rows={rows}
          maxLength={key === 'sampleMessages' ? 2500 : key === 'messageFrequency' ? 300 : 1200}
          value={value}
          onChange={event => onChange({
            ...drafts,
            [key]: key === 'sampleMessages'
              ? event.target.value.split('\n').map(line => line.trim()).filter(Boolean)
              : event.target.value,
          })}
          className="resize-y bg-background text-sm leading-6"
        />
        <span className="block text-xs leading-5 text-muted-foreground">{help}</span>
      </label>;
    })}
  </div>;
}

export function CampaignAssistant({ business, businessId }: { business: Business; businessId: string }) {
  const [mode, setMode] = useState<AssistantMode>('prepare');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [result, setResult] = useState<CampaignAssistantOutput | null>(null);
  const [drafts, setDrafts] = useState<CampaignAssistantDrafts | null>(null);
  const [lastRequest, setLastRequest] = useState<CampaignAssistantInput | null>(null);
  const [draftsApplied, setDraftsApplied] = useState(false);
  const assistant = usePrepareCampaignAssistant();
  const update = useUpdateBusiness();
  const client = useQueryClient();
  const { toast } = useToast();

  const run = (request: CampaignAssistantInput) => {
    setLastRequest(request);
    setResult(null);
    assistant.mutate({ businessId, data: request }, {
      onSuccess: output => {
        setResult(output);
        if (output.drafts) {
          setDrafts(output.drafts);
          setDraftsApplied(false);
        } else if (request.mode === 'prepare') {
          setDrafts(null);
        }
        if (request.mode === 'answer' && request.question) {
          setMessages(current => [...current, { role: 'user', content: request.question! }, { role: 'assistant', content: output.answer }]);
          setQuestion('');
        }
      },
    });
  };

  const ask = () => {
    const trimmed = question.trim();
    if (!trimmed || assistant.isPending) return;
    const history = messages.slice(-6).map(message => ({
      ...message,
      content: message.content.slice(0, 2000),
    }));
    run({ mode: 'answer', question: trimmed, ...(history.length ? { history } : {}) });
  };

  const applyDrafts = () => {
    if (!drafts || update.isPending) return;
    const data: BusinessUpdate = {
      campaignDescription: drafts.campaignDescription,
      messageFrequency: drafts.messageFrequency,
      sampleMessages: drafts.sampleMessages,
      optInDescription: drafts.optInDescription,
      consentCopy: drafts.consentCopy,
    };
    update.mutate({ businessId, data }, {
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: getGetBusinessQueryKey(businessId) });
        void client.invalidateQueries({ queryKey: getGetReadinessQueryKey(businessId) });
        void client.invalidateQueries({ queryKey: getListBusinessesQueryKey() });
        void client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setDraftsApplied(true);
        toast({ title: 'Draft wording applied', description: 'The four campaign fields were saved to this business profile.' });
      },
      onError: error => toast({
        title: 'Could not apply these drafts',
        description: error instanceof Error
          ? `Your profile was not changed. ${error.message}`
          : 'Your profile was not changed. Please try again.',
        variant: 'destructive',
      }),
    });
  };

  const changeMode = (nextMode: AssistantMode) => {
    setMode(nextMode);
    setResult(null);
    assistant.reset();
  };

  return <section className="mt-7 overflow-hidden rounded-2xl border border-card-border bg-card surface-shadow" data-testid="section-campaign-assistant">
    <div className="grid gap-6 border-b border-border bg-[hsl(174_29%_17%)] p-5 text-sidebar-foreground sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="max-w-2xl">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-[hsl(38_71%_67%)]"><Sparkles size={14} /> ClearSignal assistant</div>
        <h2 className="font-display mt-3 text-2xl font-bold tracking-tight sm:text-[28px]">Make the paperwork easier to untangle.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[hsl(42_16%_78%)]">Work from the details already in {business.businessName}’s profile. Suggestions stay editable until you choose to save them.</p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-[hsl(174_17%_37%)] bg-[hsl(174_24%_21%)] px-3 py-2.5 text-xs leading-5 text-[hsl(42_18%_83%)] lg:max-w-[255px]" data-testid="assistant-session-note">
        <MessageSquareText size={16} className="shrink-0 text-[hsl(38_71%_67%)]" />
         <span>Chat history is temporary in this view; it is not saved to your business profile.</span>
      </div>
    </div>

    <div className="p-4 sm:p-6">
      <div className="grid gap-2 md:grid-cols-3" role="tablist" aria-label="Assistant actions" data-testid="assistant-mode-selector">
        {modes.map(({ id, label, description, Icon }) => <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => changeMode(id)} data-testid={`button-assistant-mode-${id}`} className={`flex min-h-[86px] items-start gap-3 rounded-xl border p-3 text-left transition duration-200 hover:-translate-y-0.5 ${mode === id ? 'border-primary/40 bg-[hsl(174_31%_92%)] text-foreground shadow-sm' : 'border-border bg-background hover:border-primary/30 hover:bg-muted/60'}`}>
          <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${mode === id ? 'bg-primary text-primary-foreground' : 'bg-muted text-primary'}`}><Icon size={16} /></span>
          <span><span className="block text-sm font-bold">{label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span>
        </button>)}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(290px,.7fr)]">
        <div className="min-w-0">
          {mode === 'prepare' && <div className="rounded-2xl border border-border bg-background p-4 sm:p-5" data-testid="assistant-prepare-panel">
            <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(38_46%_91%)] text-[hsl(34_57%_43%)]"><FilePenLine size={17} /></span><div><h3 className="text-sm font-bold">Prepare a first draft</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Uses your saved campaign, sample messages, opt-in details, and consent wording. You can revise every suggestion before applying.</p></div></div>
            <Button type="button" data-testid="button-assistant-prepare" onClick={() => run({ mode: 'prepare' })} disabled={assistant.isPending} className="mt-4 gap-2 rounded-xl">{assistant.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}{assistant.isPending ? 'Preparing wording…' : 'Prepare draft wording'}</Button>
          </div>}
          {mode === 'review' && <div className="rounded-2xl border border-border bg-background p-4 sm:p-5" data-testid="assistant-review-panel">
            <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(174_31%_92%)] text-primary"><ScanSearch size={17} /></span><div><h3 className="text-sm font-bold">Review saved information for mismatches</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Compare the campaign, examples, opt-in and consent details with generated public privacy and SMS terms, when available.</p></div></div>
            <Button type="button" data-testid="button-assistant-review" onClick={() => run({ mode: 'review' })} disabled={assistant.isPending} className="mt-4 gap-2 rounded-xl">{assistant.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <ScanSearch size={15} />}{assistant.isPending ? 'Reviewing saved details…' : 'Review saved details'}</Button>
          </div>}
          {mode === 'answer' && <div className="rounded-2xl border border-border bg-background p-4 sm:p-5" data-testid="assistant-answer-panel">
            <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[hsl(174_31%_92%)] text-primary"><CircleHelp size={17} /></span><div><h3 className="text-sm font-bold">Ask about the registration process</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Ask a specific question. Answers are general guidance, not legal advice or a carrier decision.</p></div></div>
            {messages.length > 0 && <div className="mt-5 max-h-[360px] space-y-3 overflow-y-auto pr-1" data-testid="assistant-chat-history">
              {messages.map((message, index) => <div key={`${index}-${message.role}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`} data-testid={`assistant-chat-message-${index}`}>
                <div className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-foreground'}`}>{message.content}</div>
              </div>)}
              {assistant.isPending && <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="assistant-chat-loading"><LoaderCircle size={14} className="animate-spin" /> Putting together a clear answer…</div>}
            </div>}
            {messages.length === 0 && <div className="mt-4 flex flex-wrap gap-2">{suggestedQuestions.map((suggestion, index) => <button key={suggestion} type="button" data-testid={`button-assistant-suggestion-${index}`} onClick={() => setQuestion(suggestion)} className="rounded-full border border-border bg-card px-3 py-2 text-left text-xs font-semibold text-muted-foreground transition hover:border-primary/35 hover:text-primary">{suggestion}</button>)}</div>}
            <div className="mt-4 space-y-2">
              <Textarea data-testid="input-assistant-question" rows={3} maxLength={2000} value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(); } }} placeholder="What would you like to understand?" className="resize-y bg-card text-sm leading-6" />
              <div className="flex items-center justify-between gap-3"><span className="text-[11px] text-muted-foreground">Enter to ask · Shift + Enter for a new line</span><Button type="button" data-testid="button-assistant-ask" disabled={!question.trim() || assistant.isPending} onClick={ask} className="gap-2 rounded-xl">{assistant.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={14} />}Ask</Button></div>
            </div>
          </div>}
          {assistant.isError && <div className="mt-4 flex items-start gap-3 rounded-xl border border-[hsl(4_45%_82%)] bg-[hsl(4_65%_97%)] p-4" role="alert" data-testid="assistant-error">
            <AlertCircle size={17} className="mt-0.5 shrink-0 text-destructive" /><div className="min-w-0 flex-1"><p className="text-sm font-bold">The assistant could not respond.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Your saved profile has not changed. Try again when you’re ready.</p><button type="button" data-testid="button-assistant-retry" disabled={!lastRequest || assistant.isPending} onClick={() => lastRequest && run(lastRequest)} className="mt-2 text-xs font-bold text-primary hover:underline">Try again</button></div>
          </div>}
          {assistant.isPending && mode !== 'answer' && <div className="mt-4 animate-pulse rounded-xl border border-border bg-muted/50 p-5" data-testid="assistant-loading">
            <div className="h-3 w-28 rounded bg-muted-foreground/15" /><div className="mt-3 h-3 w-3/4 rounded bg-muted-foreground/15" /><div className="mt-2 h-3 w-1/2 rounded bg-muted-foreground/15" />
          </div>}
          {result && mode !== 'answer' && <section className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5" data-testid="assistant-result">
            <div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[hsl(174_31%_92%)] text-primary"><Check size={16} /></span><div><h3 className="text-sm font-bold">{mode === 'prepare' ? 'Draft suggestions are ready to review' : 'Review complete'}</h3><p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground" data-testid="assistant-answer">{result.answer}</p></div></div>
          </section>}
          {result && result.issues.length > 0 && mode === 'answer' && <div className="mt-4"><IssueList issues={result.issues} /></div>}
          {result && mode !== 'answer' && result.issues.length > 0 && <div className="mt-4"><IssueList issues={result.issues} /></div>}
          {result && mode === 'review' && result.issues.length === 0 && <div className="mt-4"><IssueList issues={result.issues} /></div>}
          {result && drafts && mode !== 'answer' && <section className="mt-4 rounded-2xl border border-[hsl(38_35%_79%)] bg-[hsl(42_38%_97%)] p-4 sm:p-5" data-testid="assistant-drafts">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="font-mono text-[10px] uppercase tracking-[.15em] text-[hsl(34_57%_43%)]">Editable suggestions</div><h3 className="mt-1 text-base font-bold">Nothing changes until you apply it.</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Read each field closely and make it match your actual program.</p></div><span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-[10px] font-bold text-muted-foreground"><FilePenLine size={12} /> Not saved yet</span></div>
            <DraftEditor drafts={drafts} onChange={next => { setDrafts(next); setDraftsApplied(false); }} />
            {draftsApplied && <p className="mt-4 rounded-lg bg-[hsl(147_36%_94%)] px-3 py-2 text-xs font-semibold text-[hsl(157_32%_31%)]" data-testid="assistant-drafts-applied">These five fields were saved to your business profile. You can still edit and apply another revision.</p>}
            {update.isError && <p className="mt-3 text-xs font-semibold text-destructive" data-testid="assistant-apply-error">The save did not complete. Your profile is unchanged; you can try applying again.</p>}
            <div className="mt-4 flex flex-col-reverse justify-between gap-3 border-t border-border pt-4 sm:flex-row sm:items-center"><p className="max-w-md text-[11px] leading-5 text-muted-foreground">Applying replaces campaign description, message frequency, sample messages, opt-in description, and consent copy.</p><Button type="button" data-testid="button-assistant-apply-drafts" onClick={applyDrafts} disabled={update.isPending || draftsApplied} className="gap-2 rounded-xl">{update.isPending ? <LoaderCircle size={15} className="animate-spin" /> : draftsApplied ? <Check size={15} /> : <FilePenLine size={15} />}{update.isPending ? 'Applying drafts…' : draftsApplied ? 'Applied to profile' : 'Apply drafts to profile'}</Button></div>
          </section>}
        </div>

        <aside className="space-y-4" aria-label="Assistant scope and limits">
          <div className="rounded-2xl border border-border bg-[hsl(174_31%_94%)] p-4 sm:p-5" data-testid="assistant-scope">
            <div className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={16} className="text-primary" /> What this assistant can see</div>
             <p className="mt-2 text-xs leading-5 text-muted-foreground">When you ask for help, saved profile details and any published policy text supplied to the assistant are sent to OpenAI using this workspace’s configured API key. This can include campaign fields, samples, opt-in, and consent details. The associated OpenAI account may be charged for requests.</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">The assistant only receives information and published text supplied by this app; it cannot inspect hidden or live website pages.</p>
            <div className="mt-4 border-t border-primary/10 pt-3 text-xs leading-5 text-foreground/80"><span className="font-bold">It cannot</span> see Twilio pages, submit anything to Twilio, or guarantee approval.</div>
             <div className="mt-3 rounded-lg bg-background/70 p-3 text-xs leading-5 text-muted-foreground"><span className="font-bold text-foreground">Separate Twilio step:</span> Confirm the current business and tax-ID requirements for your brand type in Twilio. ClearSignal never asks you to store an EIN or submit the brand.</div>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4 sm:p-5" data-testid="assistant-profile-context">
            <div className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Using this profile</div>
            <div className="mt-3 space-y-3 text-xs">
              <div><span className="text-muted-foreground">Business</span><p className="mt-0.5 font-semibold" data-testid="assistant-context-business">{business.businessName} · {business.brandName}</p></div>
              <div><span className="text-muted-foreground">Message purpose</span><p className="mt-0.5 font-semibold capitalize" data-testid="assistant-context-use-case">{business.useCase.replaceAll('_', ' ')}</p></div>
              <div><span className="text-muted-foreground">Public materials</span><p className="mt-0.5 font-semibold" data-testid="assistant-context-materials">{business.privacyPolicyText && business.smsTermsText ? 'Generated text is available to review' : 'No generated policy text is saved yet'}</p></div>
            </div>
          </div>
          <p className="px-1 text-[11px] leading-5 text-muted-foreground" data-testid="assistant-approval-disclaimer">ClearSignal helps organize your information. A carrier or provider makes its own decision, and the details you submit should match your real practices.</p>
        </aside>
      </div>
    </div>
  </section>;
}
