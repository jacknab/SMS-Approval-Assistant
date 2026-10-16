import { type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Activity, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck,
  Building2, Check, CheckCircle2, CircleAlert, ClipboardCheck, Copy,
  ExternalLink, FileCheck2, FileText, Globe2, Info, LoaderCircle, LockKeyhole,
  LogOut, Menu, MessageSquareText, Pencil, Plus, RefreshCw, ShieldCheck, Sparkles,
  X, XCircle,
} from 'lucide-react';
import {
  useCreateBusiness, useCreateCampaignDraft, useCreateMockSubmission, useGenerateMaterials, useGetBusiness,
  useGetDashboardSummary, useGetPublicCompliance, useGetReadiness, useListBusinesses,
  useListRegistrations, useUpdateBusiness, getGetBusinessQueryKey,
  getGetDashboardSummaryQueryKey, getGetPublicComplianceQueryKey, getGetReadinessQueryKey,
  getListBusinessesQueryKey, getListRegistrationsQueryKey,
  type Business, type BusinessInput, type CampaignDraftInput,
} from '@workspace/api-client-react';
import { Link, Redirect, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { CampaignAssistant } from '@/components/campaign-assistant';
import { ApplicationPacket } from '@/components/application-packet';
import { WebsiteOptInKit } from '@/components/website-opt-in-kit';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string) { return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path; }
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: {
    colorPrimary: '#285d56', colorForeground: '#203b38', colorMutedForeground: '#687c77',
    colorDanger: '#b34e46', colorBackground: '#fffdf7', colorInput: '#fffdf7',
    colorInputForeground: '#203b38', colorNeutral: '#d9ded5', fontFamily: 'DM Sans',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf7] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#203b38] font-bold tracking-tight',
    headerSubtitle: 'text-[#687c77]',
    socialButtonsBlockButtonText: 'text-[#203b38] font-semibold',
    formFieldLabel: 'text-[#294641] font-semibold',
    footerActionLink: 'text-[#285d56] font-semibold',
    footerActionText: 'text-[#687c77]',
    dividerText: 'text-[#687c77]',
    identityPreviewEditButton: 'text-[#285d56]',
    formFieldSuccessText: 'text-[#34765e]',
    alertText: 'text-[#8c3f39]',
    logoBox: 'mb-4',
    logoImage: 'h-9 w-9 rounded-xl',
    socialButtonsBlockButton: 'border-[#d9ded5] hover:bg-[#f6f4ec]',
    formButtonPrimary: 'bg-[#285d56] hover:bg-[#204d47] text-[#fffdf7] shadow-none',
    formFieldInput: 'bg-[#fffdf7] border-[#d9ded5] text-[#203b38]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#e4e6df]',
    alert: 'bg-[#fff1ed] border-[#f0d1c9]',
    otpCodeFieldInput: 'border-[#d9ded5] text-[#203b38]',
    formFieldRow: 'gap-1.5',
    main: 'gap-5',
  },
};

const schema = z.object({
  businessName: z.string().min(1, 'Add the name customers recognize.').max(200),
  legalName: z.string().min(1, 'Enter the registered legal name.').max(200),
  brandName: z.string().min(1, 'Enter the brand that appears in messages.').max(200),
  websiteUrl: z.string().url('Enter a complete website URL, including https://'),
  entityType: z.enum(['llc', 'corporation', 'sole_proprietor', 'nonprofit', 'public_company', 'other']),
  businessType: z.enum(['retail_ecommerce', 'professional_services', 'home_field_services', 'healthcare_wellness', 'education', 'hospitality_events', 'financial_services', 'nonprofit', 'other']),
  contactEmail: z.string().email('Enter a valid business email.'),
  streetAddress: z.string().min(1, 'Street address is required.'),
  city: z.string().min(1, 'City is required.'),
  region: z.string().min(1, 'State or region is required.'),
  postalCode: z.string().min(1, 'ZIP code is required.'),
  country: z.literal('US'),
  useCase: z.enum(['account_notifications', 'customer_care', 'marketing', 'mixed']),
  campaignDescription: z.string().max(1200).min(1, 'Describe what your messages will do.'),
  messageFrequency: z.string().max(300).min(1, 'Share an honest estimate of message frequency.'),
  sampleMessages: z.array(z.string().max(500)).min(1, 'Add at least one sample message.').max(5),
  optInMethod: z.enum(['website_form', 'keyword', 'point_of_sale', 'paper_form', 'verbal', 'other']),
  optInDescription: z.string().max(1200).min(1, 'Explain where and how customers opt in.'),
  consentCheckboxPresent: z.boolean(),
  consentCopy: z.string().max(1200).nullable().optional(),
});

type FormValues = z.infer<typeof schema>;
const blankValues: FormValues = {
  businessName: '', legalName: '', brandName: '', websiteUrl: 'https://', entityType: 'llc', businessType: 'other',
  contactEmail: '', streetAddress: '', city: '', region: '', postalCode: '', country: 'US',
  useCase: 'customer_care', campaignDescription: '', messageFrequency: '',
  sampleMessages: [''], optInMethod: 'website_form', optInDescription: '',
  consentCheckboxPresent: false, consentCopy: '',
};

function useNotify() {
  return useToast();
}

function Mark({ small = false }: { small?: boolean }) {
  return <span data-testid="brand-mark" className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-[hsl(38_71%_67%)] text-[hsl(174_29%_16%)] ${small ? 'h-8 w-8' : 'h-10 w-10'}`}><MessageSquareText size={small ? 16 : 19} strokeWidth={2.2} /></span>;
}

function Logo({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" data-testid="link-brand-home" className="inline-flex items-center gap-3">
    <Mark />
    <span className={`font-display text-[17px] font-extrabold tracking-[-.04em] ${inverse ? 'text-sidebar-foreground' : 'text-foreground'}`}>clear<span className="text-[hsl(38_61%_51%)]">signal</span></span>
  </Link>;
}

function HomePage() {
  return <main data-testid="page-home" className="min-h-[100dvh] overflow-hidden bg-background text-foreground">
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
      <Logo />
      <nav className="flex items-center gap-3">
        <Link href="/sign-in" className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted sm:inline-flex" data-testid="link-sign-in">Sign in</Link>
        <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:shadow-md" data-testid="link-get-started">Get started <ArrowRight size={15} /></Link>
      </nav>
    </header>
    <section className="soft-grid relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-12 sm:px-8 md:grid-cols-[1.05fr_.95fr] md:pb-28 md:pt-20">
      <div className="page-enter relative z-10 max-w-2xl">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[hsl(174_18%_78%)] bg-[hsl(174_30%_95%)] px-3 py-1.5 text-xs font-semibold tracking-wide text-primary"><ShieldCheck size={14} /> A calmer path to SMS registration</div>
        <h1 className="font-display max-w-xl text-[clamp(2.8rem,6vw,5.45rem)] font-extrabold leading-[.99] tracking-[-.065em] text-[hsl(174_28%_18%)]">Get your customer texts <span className="relative inline-block text-primary">ready to send.</span></h1>
         <p className="mt-7 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg">Draft your campaign details in plain language, compare them against consent and public materials, and work through the next steps before you open Twilio.</p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link href="/sign-up" data-testid="link-start-setup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-[0_10px_20px_hsl(174_35%_27%/.14)] transition hover:-translate-y-0.5">Start your setup <ArrowRight size={16} /></Link>
          <Link href="/sign-in" data-testid="link-existing-account" className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-bold text-foreground transition hover:bg-muted">I already have an account</Link>
        </div>
        <div className="mt-8 flex items-center gap-3 text-xs leading-5 text-muted-foreground"><LockKeyhole size={15} className="text-primary" /> Your campaign details stay in your workspace.</div>
      </div>
      <div className="page-enter relative mx-auto w-full max-w-[540px] md:pl-5" style={{ animationDelay: '.08s' }}>
        <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-[hsl(38_70%_80%/.34)] blur-[1px]" />
        <div className="relative rotate-[1deg] rounded-[26px] border border-[hsl(38_20%_84%)] bg-[hsl(42_38%_99%)] p-5 shadow-[0_28px_80px_hsl(174_25%_20%/.12)] sm:p-7">
          <div className="flex items-center justify-between border-b border-border pb-5">
            <div><div className="text-[10px] font-bold uppercase tracking-[.2em] text-muted-foreground">Campaign workspace</div><div className="mt-1 font-display text-lg font-bold">Launch readiness</div></div>
            <div className="rounded-full bg-[hsl(147_34%_91%)] px-3 py-1.5 text-xs font-bold text-[hsl(157_32%_31%)]">In good shape</div>
          </div>
          <div className="my-6 flex items-center gap-5 rounded-2xl bg-[hsl(174_29%_17%)] p-5 text-sidebar-foreground">
            <div className="relative grid h-[82px] w-[82px] shrink-0 place-items-center rounded-full border-[6px] border-[hsl(174_20%_31%)]">
              <div className="absolute inset-[-6px] rounded-full border-[6px] border-transparent border-t-[hsl(38_71%_67%)] border-r-[hsl(38_71%_67%)] rotate-[24deg]" />
              <span className="font-display text-2xl font-extrabold">82</span>
            </div>
            <div><div className="text-xs font-semibold text-[hsl(42_20%_74%)]">READINESS SCORE</div><div className="mt-2 text-sm font-semibold">A few details to tighten.</div><div className="mt-1 text-xs leading-5 text-[hsl(42_15%_70%)]">Your next steps are clear and manageable.</div></div>
          </div>
          <div className="space-y-2">
            {[
              ['Business identity', 'Ready to go', true],
              ['Opt-in language', 'Review consent text', false],
              ['Public SMS terms', 'Materials generated', true],
            ].map(([title, detail, ready], i) => <div key={String(title)} className="flex items-center justify-between rounded-xl border border-border/80 bg-card px-4 py-3" data-testid={`preview-check-${i}`}>
              <div className="flex items-center gap-3"><span className={`grid h-7 w-7 place-items-center rounded-lg ${ready ? 'bg-[hsl(147_34%_91%)] text-[hsl(157_32%_31%)]' : 'bg-[hsl(38_65%_90%)] text-[hsl(34_57%_43%)]'}`}>{ready ? <Check size={15} /> : <Info size={15} />}</span><span className="text-sm font-semibold">{title}</span></div>
              <span className="text-xs text-muted-foreground">{detail}</span>
            </div>)}
          </div>
          <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><Sparkles size={14} className="text-[hsl(34_57%_43%)]" /> Plain-language guidance, never a promise of approval.</div>
        </div>
        <div className="absolute -bottom-5 -left-3 hidden items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg sm:flex"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[hsl(174_31%_92%)] text-primary"><FileCheck2 size={17} /></span><span><b className="block text-xs">Public materials</b><small className="text-muted-foreground">Privacy + SMS terms</small></span></div>
      </div>
    </section>
    <section className="border-y border-border bg-[hsl(174_24%_17%)] px-5 py-12 text-sidebar-foreground sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[.8fr_1.2fr] md:items-center">
        <div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[hsl(38_71%_67%)]">Built for the real work</p><h2 className="font-display mt-3 text-3xl font-bold tracking-[-.04em]">Know what to fix.<br />Know what happens next.</h2></div>
        <div className="grid gap-6 sm:grid-cols-3">
          {[['01', 'Prepare your profile', 'Capture the business, campaign, and opt-in details reviewers need.'], ['02', 'Check your gaps', 'See what is ready, what needs attention, and what blocks a clean submission.'], ['03', 'Publish your materials', 'Create shareable privacy and SMS terms pages for your customers.']].map(([n, title, body]) => <article key={n} className="border-l border-[hsl(174_14%_38%)] pl-4" data-testid={`feature-${n}`}><span className="font-mono text-xs text-[hsl(38_71%_67%)]">{n}</span><h3 className="mt-3 text-sm font-bold">{title}</h3><p className="mt-2 text-xs leading-5 text-[hsl(42_16%_75%)]">{body}</p></article>)}
        </div>
      </div>
    </section>
    <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 md:grid-cols-2 md:py-20">
      <div className="rounded-2xl border border-border bg-card p-7 surface-shadow">
        <div className="flex items-start gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(147_35%_91%)] text-[hsl(157_32%_31%)]"><ClipboardCheck size={19} /></span><div><h3 className="font-display text-xl font-bold tracking-tight">Practical compliance prep</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">Make your campaign details consistent, explain consent clearly, and have public-facing materials ready before you register.</p></div></div>
      </div>
      <div className="rounded-2xl border border-[hsl(38_45%_77%)] bg-[hsl(40_50%_93%)] p-7">
        <div className="flex items-start gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(38_71%_77%)] text-[hsl(174_29%_16%)]"><Info size={19} /></span><div><h3 className="font-display text-xl font-bold tracking-tight">A helper, not a carrier or regulator</h3><p className="mt-3 text-sm leading-6 text-[hsl(174_13%_35%)]">ClearSignal does not submit registrations to Twilio or any carrier, guarantee approval, or provide legal advice. Submission history in this workspace is a clearly labeled mock record.</p></div></div>
      </div>
    </section>
    <footer className="border-t border-border px-5 py-6 text-center text-xs text-muted-foreground sm:px-8"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row"><Logo /><span>Clear information for responsible customer messaging.</span><span>© {new Date().getFullYear()} ClearSignal</span></div></footer>
  </main>;
}

function LoginPage({ signup = false }: { signup?: boolean }) {
  return <main data-testid={signup ? 'page-sign-up' : 'page-sign-in'} className="soft-grid flex min-h-[100dvh] flex-col items-center justify-center gap-8 bg-background px-4 py-10">
    <div className="text-center"><Logo /><p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">A steady workspace for clear, responsible SMS campaign preparation.</p></div>
    {signup ? <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /> : <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />}
  </main>;
}

function Protected({ children }: { children: ReactNode }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/sign-in" /></Show></>;
}

function AppFrame({ children, active = 'overview' }: { children: ReactNode; active?: string }) {
  const { signOut } = useClerk();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = [
    { href: '/app', label: 'Overview', icon: Activity, id: 'overview' },
    { href: '/businesses/new', label: 'Add a business', icon: Plus, id: 'new' },
  ];
  const sidebar = <div className="flex h-full flex-col">
    <div className="px-5 pb-8 pt-6"><Logo inverse /></div>
    <div className="px-4"><div className="mb-3 px-3 font-mono text-[9px] uppercase tracking-[.2em] text-[hsl(42_13%_65%)]">Workspace</div>
      {nav.map(item => <Link key={item.id} href={item.href} data-testid={`nav-${item.id}`} onClick={() => setMobileOpen(false)} className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active === item.id ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-[hsl(42_18%_76%)] hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}><item.icon size={17} />{item.label}</Link>)}
    </div>
    <div className="mt-auto p-4">
      <div className="mb-4 rounded-xl border border-sidebar-border bg-[hsl(174_25%_20%)] p-4"><div className="flex items-center gap-2 text-xs font-semibold text-sidebar-foreground"><ShieldCheck size={15} className="text-[hsl(38_71%_67%)]" /> Good practice, made clear</div><p className="mt-2 text-[11px] leading-5 text-[hsl(42_14%_73%)]">This workspace helps prepare. It does not provide legal advice or submit to carriers.</p></div>
      <button type="button" data-testid="button-sign-out" onClick={() => signOut({ redirectUrl: basePath || '/' })} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[hsl(42_18%_76%)] transition hover:bg-sidebar-accent hover:text-sidebar-foreground"><LogOut size={16} /> Sign out</button>
    </div>
  </div>;
  return <div className="min-h-[100dvh] bg-background md:grid md:grid-cols-[248px_1fr]">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col bg-sidebar text-sidebar-foreground md:flex">{sidebar}</aside>
    <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
      <Logo /><button type="button" data-testid="button-mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} className="rounded-lg border border-border p-2 text-foreground">{mobileOpen ? <X size={18} /> : <Menu size={18} />}</button>
    </div>
    {mobileOpen && <div className="fixed inset-0 z-40 bg-sidebar pt-14 text-sidebar-foreground md:hidden"><button className="absolute right-4 top-4 rounded-lg p-2" onClick={() => setMobileOpen(false)} aria-label="Close menu" data-testid="button-close-menu"><X size={20} /></button>{sidebar}</div>}
    <div className="min-w-0 md:col-start-2"><div className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-8 sm:py-10 lg:px-12">{children}</div></div>
  </div>;
}

function LoadingPage({ label = 'Loading your workspace' }: { label?: string }) {
  return <div data-testid="loading-state" className="space-y-5 page-enter" aria-label={label}>
    <div className="h-3 w-24 animate-pulse rounded bg-muted" /><div className="h-10 w-64 max-w-full animate-pulse rounded-lg bg-muted" />
    <div className="grid gap-4 sm:grid-cols-3"><div className="h-28 animate-pulse rounded-2xl bg-muted" /><div className="h-28 animate-pulse rounded-2xl bg-muted" /><div className="h-28 animate-pulse rounded-2xl bg-muted" /></div><div className="h-64 animate-pulse rounded-2xl bg-muted" />
  </div>;
}

function ErrorNotice({ retry, message = 'We could not load this information.' }: { retry: () => void; message?: string }) {
  return <div data-testid="error-state" className="rounded-2xl border border-[hsl(4_45%_82%)] bg-[hsl(4_65%_97%)] p-6">
    <div className="flex items-start gap-3"><CircleAlert size={20} className="mt-0.5 text-destructive" /><div className="flex-1"><h3 className="font-semibold text-foreground">A small snag</h3><p className="mt-1 text-sm text-muted-foreground" data-testid="text-error-message">{message}</p><button type="button" data-testid="button-retry" onClick={retry} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary"><RefreshCw size={14} /> Try again</button></div></div>
  </div>;
}

function Eyebrow({ children }: { children: ReactNode }) { return <div className="font-mono text-[10px] font-medium uppercase tracking-[.19em] text-muted-foreground">{children}</div>; }

function Dashboard() {
  const summary = useGetDashboardSummary();
  const businesses = useListBusinesses();
  const [, setLocation] = useLocation();
  if (summary.isLoading || businesses.isLoading) return <AppFrame><LoadingPage /></AppFrame>;
  if (summary.isError) return <AppFrame><ErrorNotice retry={() => summary.refetch()} message="Your overview is temporarily unavailable." /></AppFrame>;
  const data = summary.data;
  const items = businesses.data ?? [];
  return <AppFrame active="overview"><main className="page-enter" data-testid="page-dashboard">
    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><Eyebrow>Your workspace / Overview</Eyebrow><h1 className="font-display mt-3 text-3xl font-extrabold tracking-[-.045em] sm:text-[40px]" data-testid="text-dashboard-heading">Good work starts with clarity.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Keep your SMS registrations moving with a clear view of what is ready and what needs your attention.</p></div>
      <Button data-testid="button-add-business" onClick={() => setLocation('/businesses/new')} className="h-11 gap-2 self-start rounded-xl sm:self-auto"><Plus size={16} /> Add a business</Button>
    </div>
    <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {([
        { label: 'Businesses', value: data?.businessCount ?? 0, Icon: Building2, hint: 'In your workspace' },
        { label: 'Ready to register', value: data?.readyCount ?? 0, Icon: BadgeCheck, hint: 'No blocking gaps' },
        { label: 'Mock submissions', value: data?.submittedCount ?? 0, Icon: FileCheck2, hint: 'Saved for your records' },
        { label: 'Needs attention', value: data?.needsWorkCount ?? 0, Icon: Info, hint: 'A few details to review' },
      ]).map(({ label, value, Icon, hint }) => <Card key={label} data-testid={`metric-card-${label.toLowerCase().replaceAll(' ', '-')}`} className="overflow-hidden rounded-2xl border-card-border bg-card surface-shadow"><CardContent className="p-5"><div className="flex items-start justify-between"><div><div className="text-xs font-semibold text-muted-foreground">{label}</div><div className="mt-3 font-display text-3xl font-extrabold tracking-tight" data-testid={`metric-value-${label.toLowerCase().replaceAll(' ', '-')}`}>{summary.isLoading ? '—' : value}</div></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(174_31%_92%)] text-primary"><Icon size={19} /></span></div><div className="mt-4 text-xs text-muted-foreground">{hint}</div></CardContent></Card>)}
    </div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
      <section className="rounded-2xl border border-card-border bg-card p-5 sm:p-6 surface-shadow" data-testid="section-businesses">
        <div className="flex items-start justify-between gap-3"><div><Eyebrow>Campaign portfolio</Eyebrow><h2 className="font-display mt-2 text-xl font-bold tracking-tight">Your businesses</h2></div><button type="button" onClick={() => setLocation('/businesses/new')} className="rounded-lg px-3 py-2 text-xs font-bold text-primary hover:bg-muted" data-testid="button-new-business-secondary">Add new <Plus size={14} className="ml-1 inline" /></button></div>
        {businesses.isError ? <div className="mt-5"><ErrorNotice retry={() => businesses.refetch()} message="Business profiles could not be loaded." /></div> : items.length ? <div className="mt-5 divide-y divide-border">{items.map((business, i) => <Link key={business.id} href={`/businesses/${business.id}`} data-testid={`business-row-${business.id}`} className="group flex items-center justify-between gap-4 py-4 transition first:pt-1 hover:px-2">
          <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(38_46%_91%)] text-[hsl(34_57%_43%)]"><Building2 size={18} /></span><div className="min-w-0"><div className="truncate text-sm font-bold" data-testid={`business-name-${business.id}`}>{business.businessName}</div><div className="mt-1 truncate text-xs text-muted-foreground">{business.brandName} · {business.useCase.replaceAll('_', ' ')}</div></div></div>
          <div className="flex shrink-0 items-center gap-3"><span className={`hidden rounded-full px-2.5 py-1 text-[10px] font-bold sm:inline-flex ${business.publicSlug ? 'bg-[hsl(147_34%_91%)] text-[hsl(157_32%_31%)]' : 'bg-muted text-muted-foreground'}`}>{business.publicSlug ? 'Materials live' : 'Setup in progress'}</span><ArrowRight size={16} className="text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" /></div>
        </Link>)}</div> : <div data-testid="empty-businesses" className="mt-5 rounded-xl border border-dashed border-border bg-[hsl(40_24%_96%)] px-6 py-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[hsl(174_31%_92%)] text-primary"><Building2 size={22} /></span><h3 className="mt-4 font-display text-lg font-bold">Your first business starts here</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Add your business and campaign basics. We’ll turn them into a practical readiness checklist.</p><Button data-testid="button-create-first-business" onClick={() => setLocation('/businesses/new')} className="mt-5 gap-2 rounded-xl"><Plus size={15} /> Create a profile</Button></div>}
      </section>
      <section className="rounded-2xl border border-card-border bg-card p-5 sm:p-6 surface-shadow" data-testid="section-activity">
        <Eyebrow>Recent changes</Eyebrow><h2 className="font-display mt-2 text-xl font-bold tracking-tight">Activity</h2>
        {data?.recentActivity?.length ? <div className="mt-5 space-y-0">{data.recentActivity.slice(0, 6).map((activity, i) => <div key={activity.id} data-testid={`activity-item-${activity.id}`} className="relative flex gap-3 pb-5 last:pb-0"><div className="relative flex w-7 shrink-0 justify-center"><span className="z-10 grid h-7 w-7 place-items-center rounded-full bg-[hsl(174_31%_92%)] text-primary"><Activity size={13} /></span>{i < data.recentActivity.length - 1 && <span className="absolute top-7 h-full w-px bg-border" />}</div><div className="min-w-0 flex-1"><div className="text-sm font-semibold" data-testid={`activity-title-${activity.id}`}>{activity.action}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{activity.detail || activity.businessName}</p><div className="mt-1 text-[10px] text-muted-foreground">{activity.businessName} · {new Date(activity.createdAt).toLocaleDateString()}</div></div></div>)}</div> : <div data-testid="empty-activity" className="mt-5 rounded-xl bg-muted/70 px-5 py-8 text-center"><Activity size={20} className="mx-auto text-muted-foreground" /><p className="mt-3 text-sm font-semibold">A quiet start</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Your business updates will appear here.</p></div>}
        <div className="mt-6 rounded-xl border border-[hsl(38_45%_77%)] bg-[hsl(40_50%_93%)] p-4"><div className="flex gap-3"><Info size={16} className="mt-0.5 shrink-0 text-[hsl(34_57%_43%)]" /><p className="text-xs leading-5 text-[hsl(174_13%_35%)]"><b>Reminder:</b> this workspace prepares your information; it does not send a live carrier registration.</p></div></div>
      </section>
    </div>
  </main></AppFrame>;
}

const fieldMeta: { key: keyof FormValues; label: string; placeholder?: string; kind?: 'select' | 'textarea' | 'checkbox'; options?: [string, string][]; description?: string }[] = [
  { key: 'businessName', label: 'Business name customers know', placeholder: 'e.g. Northwind Bicycle Co.' },
  { key: 'legalName', label: 'Registered legal name', placeholder: 'As shown on formation or tax documents' },
  { key: 'brandName', label: 'Brand name in your messages', placeholder: 'The name recipients will recognize' },
  { key: 'websiteUrl', label: 'Business website', placeholder: 'https://yourbusiness.com' },
  { key: 'entityType', label: 'Business structure', kind: 'select', options: [['llc', 'LLC'], ['corporation', 'Corporation'], ['sole_proprietor', 'Sole proprietor'], ['nonprofit', 'Nonprofit'], ['public_company', 'Public company'], ['other', 'Other']] },
  { key: 'businessType', label: 'Business type', kind: 'select', options: [['retail_ecommerce', 'Retail & ecommerce'], ['professional_services', 'Professional services'], ['home_field_services', 'Home & field services'], ['healthcare_wellness', 'Healthcare & wellness'], ['education', 'Education'], ['hospitality_events', 'Hospitality & events'], ['financial_services', 'Financial services'], ['nonprofit', 'Nonprofit organization'], ['other', 'Other']] },
  { key: 'contactEmail', label: 'Business contact email', placeholder: 'you@yourbusiness.com' },
  { key: 'streetAddress', label: 'Street address', placeholder: '123 Market Street' },
  { key: 'city', label: 'City', placeholder: 'Portland' },
  { key: 'region', label: 'State', placeholder: 'Oregon' },
  { key: 'postalCode', label: 'ZIP code', placeholder: '97205' },
  { key: 'useCase', label: 'Primary message purpose', kind: 'select', options: [['account_notifications', 'Account notifications'], ['customer_care', 'Customer care'], ['marketing', 'Marketing'], ['mixed', 'A mix of purposes']] },
  { key: 'campaignDescription', label: 'What will these messages do?', kind: 'textarea', placeholder: 'Describe the messages customers will receive, and why.' },
  { key: 'messageFrequency', label: 'Expected message frequency', placeholder: 'Use your actual estimate, e.g. up to 4 messages per month' },
  { key: 'sampleMessages', label: 'Sample messages', kind: 'textarea', placeholder: 'One sample per line. Include your brand name and a realistic example.' },
  { key: 'optInMethod', label: 'How do people give permission?', kind: 'select', options: [['website_form', 'Website form'], ['keyword', 'Text a keyword'], ['point_of_sale', 'At point of sale'], ['paper_form', 'Paper form'], ['verbal', 'Verbal'], ['other', 'Other']] },
  { key: 'optInDescription', label: 'Explain the opt-in experience', kind: 'textarea', placeholder: 'Where does the customer see the offer? What action do they take?' },
  { key: 'consentCopy', label: 'What does your consent language say?', kind: 'textarea', placeholder: 'Paste the consent language customers see before subscribing.' },
];

const businessFieldKeys: (keyof FormValues)[] = [
  'businessName', 'legalName', 'brandName', 'websiteUrl', 'entityType',
  'businessType', 'contactEmail', 'streetAddress', 'city', 'region', 'postalCode',
];
const campaignFieldKeys: (keyof FormValues)[] = [
  'useCase', 'campaignDescription', 'messageFrequency', 'sampleMessages',
];

function BusinessFieldControl({ field, form }: {
  field: typeof fieldMeta[number];
  form: ReturnType<typeof useForm<FormValues>>;
}) {
  if (field.key === 'sampleMessages') {
    const samples = form.watch('sampleMessages');
    return <Textarea
      data-testid="input-sample-messages"
      placeholder={field.placeholder}
      rows={5}
      value={samples.filter(Boolean).join('\n')}
      onChange={event => form.setValue('sampleMessages', event.target.value.split('\n').map(line => line.trim()).filter(Boolean), { shouldDirty: true, shouldValidate: true })}
    />;
  }
  if (field.kind === 'select') {
    return <select
      data-testid={`input-${field.key}`}
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
      {...form.register(field.key as keyof FormValues)}
    >{field.options?.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>;
  }
  if (field.kind === 'textarea') {
    return <Textarea data-testid={`input-${field.key}`} placeholder={field.placeholder} rows={field.key === 'campaignDescription' ? 3 : 4} {...form.register(field.key as keyof FormValues)} />;
  }
  return <Input
    data-testid={`input-${field.key}`}
    placeholder={field.placeholder}
    type={field.key === 'contactEmail' ? 'email' : field.key === 'websiteUrl' ? 'url' : 'text'}
    {...form.register(field.key as keyof FormValues)}
  />;
}

function BusinessFields({ form, includeConsent = true }: { form: ReturnType<typeof useForm<FormValues>>; includeConsent?: boolean }) {
  const fields = fieldMeta.filter(field => includeConsent || field.key !== 'consentCopy');
  const inputFields = fields.filter(field => field.key !== 'consentCopy');
  return <div className="space-y-7">
    <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
      {inputFields.map(field => <FormField key={field.key} control={form.control} name={field.key as keyof FormValues} render={() => <FormItem className={['campaignDescription', 'sampleMessages', 'optInDescription'].includes(field.key) ? 'sm:col-span-2' : ''}><FormLabel className="text-[13px] font-semibold text-foreground">{field.label}</FormLabel><FormControl><BusinessFieldControl field={field} form={form} /></FormControl><FormMessage /></FormItem>} />)}
    </div>
    <FormField control={form.control} name="consentCheckboxPresent" render={({ field }) => <FormItem className="flex items-start gap-3 rounded-xl border border-border bg-muted/60 p-4"><FormControl><Checkbox data-testid="input-consent-checkbox-present" checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" /></FormControl><div><FormLabel className="text-sm font-semibold">My web form has a separate, unchecked SMS consent checkbox.</FormLabel><FormDescription className="mt-1 text-xs leading-5">Only mark this if the checkbox is optional and is not bundled with other terms.</FormDescription><FormMessage /></div></FormItem>} />
    {includeConsent && <FormField control={form.control} name="consentCopy" render={({ field }) => <FormItem><FormLabel className="text-[13px] font-semibold">What does your consent language say?</FormLabel><FormControl><Textarea data-testid="input-consent-copy" rows={4} placeholder="Paste the consent language customers see before subscribing." value={field.value ?? ''} onChange={field.onChange} /></FormControl><FormDescription>Include program name, frequency, message/data rates, STOP/HELP instructions, and links to your terms and privacy policy where relevant.</FormDescription><FormMessage /></FormItem>} />}
  </div>;
}

function BusinessForm({ initial, onSubmit, submitting, submitLabel, cancel }: { initial?: Business; onSubmit: (values: FormValues) => void; submitting: boolean; submitLabel: string; cancel?: () => void }) {
  const initialValues: FormValues = initial ? {
    businessName: initial.businessName, legalName: initial.legalName, brandName: initial.brandName,
    websiteUrl: initial.websiteUrl, entityType: initial.entityType, businessType: initial.businessType, contactEmail: initial.contactEmail,
    streetAddress: initial.streetAddress, city: initial.city, region: initial.region, postalCode: initial.postalCode,
    country: initial.country, useCase: initial.useCase, campaignDescription: initial.campaignDescription,
    messageFrequency: initial.messageFrequency, sampleMessages: initial.sampleMessages,
    optInMethod: initial.optInMethod, optInDescription: initial.optInDescription,
    consentCheckboxPresent: initial.consentCheckboxPresent, consentCopy: initial.consentCopy ?? '',
  } : blankValues;
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: initialValues, mode: 'onTouched' });
  const [step, setStep] = useState(1);
  const campaignDraft = useCreateCampaignDraft();
  const draftCampaign = () => {
    const values = form.getValues();
    const data: CampaignDraftInput = {
      businessName: values.businessName,
      brandName: values.brandName,
      websiteUrl: values.websiteUrl,
      entityType: values.entityType,
      businessType: values.businessType,
      useCase: values.useCase,
    };
    campaignDraft.mutate({ data }, { onSuccess: drafts => {
      form.setValue('campaignDescription', drafts.campaignDescription, { shouldDirty: true, shouldValidate: true });
      form.setValue('messageFrequency', drafts.messageFrequency, { shouldDirty: true, shouldValidate: true });
      form.setValue('sampleMessages', drafts.sampleMessages, { shouldDirty: true, shouldValidate: true });
    } });
  };
  const next = async () => {
    const keys: (keyof FormValues)[][] = [
      businessFieldKeys,
      campaignFieldKeys,
      ['optInMethod', 'optInDescription', 'consentCheckboxPresent', 'consentCopy'],
    ];
    if (await form.trigger(keys[step - 1])) setStep(step + 1);
  };
  return <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-7" data-testid="form-business">
    <div className="flex items-center gap-2" data-testid="onboarding-progress">{['Business', 'Campaign', 'Consent'].map((label, i) => <div key={label} className="flex flex-1 items-center gap-2"><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${step > i + 1 ? 'bg-[hsl(147_34%_88%)] text-[hsl(157_32%_31%)]' : step === i + 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{step > i + 1 ? <Check size={14} /> : i + 1}</span><span className={`hidden text-xs font-semibold sm:inline ${step === i + 1 ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>{i < 2 && <span className="h-px flex-1 bg-border" />}</div>)}</div>
    <div className="rounded-xl bg-muted/70 p-4"><h3 className="text-sm font-bold">{step === 1 ? 'Tell us about the business' : step === 2 ? 'Describe the campaign' : 'Make consent easy to understand'}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{step === 1 ? 'Use the details that match your real business records.' : step === 2 ? 'Be specific about message purpose, volume, and examples.' : 'Clear opt-in and opt-out practices are central to customer trust.'}</p></div>
    {step === 1 && <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
       {fieldMeta.filter(field => businessFieldKeys.includes(field.key)).map(field => <FormField key={field.key} control={form.control} name={field.key as keyof FormValues} render={() => <FormItem><FormLabel className="text-[13px] font-semibold">{field.label}</FormLabel><FormControl><BusinessFieldControl field={field} form={form} /></FormControl><FormMessage /></FormItem>} />)}
    </div>}
     {step === 2 && <div className="space-y-5">
       <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4">
         <div><p className="text-sm font-semibold">Need a starting point?</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Drafts use your business name, business type, and selected message purpose. Review and edit every field before saving.</p></div>
         <Button type="button" data-testid="button-draft-campaign" onClick={draftCampaign} disabled={campaignDraft.isPending} className="shrink-0 gap-2 rounded-xl">
           {campaignDraft.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}
           {campaignDraft.isPending ? 'Preparing drafts…' : 'Draft with AI'}
         </Button>
       </div>
       {campaignDraft.isError && <p role="alert" className="text-xs font-semibold text-destructive" data-testid="campaign-draft-error">The campaign draft could not be prepared. Your entries are unchanged; check your connection or try again.</p>}
       {campaignDraft.isSuccess && <p role="status" className="text-xs font-semibold text-[hsl(157_32%_31%)]" data-testid="campaign-draft-success">Drafts added to the editable fields below. Confirm the frequency and examples match your actual program.</p>}
       <div className="grid gap-5 sm:grid-cols-2">
       {fieldMeta.filter(field => campaignFieldKeys.includes(field.key)).map(field => <FormField key={field.key} control={form.control} name={field.key as keyof FormValues} render={() => <FormItem className={['campaignDescription', 'sampleMessages'].includes(field.key) ? 'sm:col-span-2' : ''}><FormLabel className="text-[13px] font-semibold">{field.label}</FormLabel><FormControl><BusinessFieldControl field={field} form={form} /></FormControl><FormMessage /></FormItem>} />)}
       </div>
    </div>}
    {step === 3 && <div className="space-y-5">
       <FormField control={form.control} name="optInMethod" render={() => <FormItem><FormLabel className="text-[13px] font-semibold">How do people give permission?</FormLabel><FormControl><BusinessFieldControl field={fieldMeta.find(field => field.key === 'optInMethod')!} form={form} /></FormControl><FormMessage /></FormItem>} />
      <FormField control={form.control} name="optInDescription" render={({ field }) => <FormItem><FormLabel className="text-[13px] font-semibold">Explain the opt-in experience</FormLabel><FormControl><Textarea data-testid="input-optInDescription" rows={4} placeholder="Where does a customer see the offer? What action do they take?" {...field} /></FormControl><FormMessage /></FormItem>} />
      <FormField control={form.control} name="consentCheckboxPresent" render={({ field }) => <FormItem className="flex items-start gap-3 rounded-xl border border-border bg-muted/60 p-4"><FormControl><Checkbox data-testid="input-consent-checkbox-present" checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" /></FormControl><div><FormLabel className="text-sm font-semibold">My web form has a separate, unchecked SMS consent checkbox.</FormLabel><FormDescription className="mt-1 text-xs leading-5">Only select if customers can choose SMS separately from other terms.</FormDescription></div></FormItem>} />
      <FormField control={form.control} name="consentCopy" render={({ field }) => <FormItem><FormLabel className="text-[13px] font-semibold">Consent language customers see</FormLabel><FormControl><Textarea data-testid="input-consent-copy" rows={4} placeholder="Paste your current SMS disclosure text." value={field.value ?? ''} onChange={field.onChange} /></FormControl><FormDescription>Include frequency, message/data rates, STOP/HELP instructions, and links when appropriate.</FormDescription><FormMessage /></FormItem>} />
    </div>}
    <div className="flex flex-col-reverse justify-between gap-3 border-t border-border pt-5 sm:flex-row">
      <div>{step === 1 ? cancel && <button type="button" onClick={cancel} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted" data-testid="button-cancel-business">Cancel</button> : <button type="button" onClick={() => setStep(step - 1)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted" data-testid="button-previous-step"><ArrowLeft size={14} /> Back</button>}</div>
      {step < 3 ? <Button type="button" onClick={next} className="gap-2 rounded-xl" data-testid="button-next-step">Continue <ArrowRight size={15} /></Button> : <Button type="submit" disabled={submitting} className="gap-2 rounded-xl" data-testid="button-save-business">{submitting && <LoaderCircle size={15} className="animate-spin" />}{submitLabel}</Button>}
    </div>
  </form></Form>;
}

function NewBusiness() {
  const create = useCreateBusiness();
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useNotify();
  const submit = (values: FormValues) => {
    const data: BusinessInput = { ...values, sampleMessages: values.sampleMessages.filter(Boolean), consentCopy: values.consentCopy || null };
    create.mutate({ data }, {
      onSuccess: business => {
        client.invalidateQueries({ queryKey: getListBusinessesQueryKey() });
        client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: 'Business profile created', description: 'Your readiness checklist is ready to review.' });
        setLocation(`/businesses/${business.id}`);
      },
      onError: () => toast({ title: 'Could not save profile', description: 'Please check your details and try again.', variant: 'destructive' }),
    });
  };
  return <AppFrame active="new"><main className="page-enter mx-auto max-w-4xl" data-testid="page-business-new">
    <Link href="/app" data-testid="link-back-dashboard" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition hover:text-primary"><ArrowLeft size={14} /> Back to overview</Link>
    <div className="mt-5 grid gap-7 lg:grid-cols-[.72fr_1.28fr]">
      <div className="lg:sticky lg:top-8 lg:self-start"><Eyebrow>New business / Setup</Eyebrow><h1 className="font-display mt-3 text-3xl font-extrabold tracking-[-.05em] sm:text-4xl">Let's get your details in order.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">A few straightforward questions help us check the right things and prepare public-facing materials.</p><div className="mt-6 rounded-xl border border-[hsl(38_45%_77%)] bg-[hsl(40_50%_93%)] p-4"><div className="flex gap-3"><Info size={17} className="mt-0.5 shrink-0 text-[hsl(34_57%_43%)]" /><div><div className="text-sm font-bold">Use your real-world details</div><p className="mt-1 text-xs leading-5 text-[hsl(174_13%_35%)]">We’ll help organize what you provide, not determine legal eligibility or guarantee acceptance.</p></div></div></div></div>
      <section className="rounded-2xl border border-card-border bg-card p-5 sm:p-7 surface-shadow"><BusinessForm onSubmit={submit} submitting={create.isPending} submitLabel="Create business profile" cancel={() => setLocation('/app')} /></section>
    </div>
  </main></AppFrame>;
}

function stateInfo(state: string) {
  if (state === 'ready') return { title: 'Ready', className: 'bg-[hsl(147_34%_91%)] text-[hsl(157_32%_31%)]', Icon: CheckCircle2 };
  if (state === 'blocking') return { title: 'Blocking', className: 'bg-[hsl(4_67%_95%)] text-[hsl(4_48%_43%)]', Icon: XCircle };
  return { title: 'Review', className: 'bg-[hsl(38_65%_90%)] text-[hsl(34_57%_43%)]', Icon: Info };
}

function BusinessWorkspace() {
  const params = useParams<{ businessId: string }>();
  const businessId = params.businessId ?? '';
  const businessQuery = useGetBusiness(businessId, { query: { enabled: !!businessId, queryKey: getGetBusinessQueryKey(businessId) } });
  const readiness = useGetReadiness(businessId, { query: { enabled: !!businessId, queryKey: getGetReadinessQueryKey(businessId) } });
  const registrations = useListRegistrations(businessId, { query: { enabled: !!businessId, queryKey: getListRegistrationsQueryKey(businessId) } });
  const generate = useGenerateMaterials();
  const mock = useCreateMockSubmission();
  const update = useUpdateBusiness();
  const client = useQueryClient();
  const { toast } = useNotify();
  const [editOpen, setEditOpen] = useState(false);
  if (businessQuery.isLoading || readiness.isLoading || registrations.isLoading) return <AppFrame><LoadingPage label="Loading business workspace" /></AppFrame>;
  if (businessQuery.isError || !businessQuery.data) return <AppFrame><ErrorNotice retry={() => { businessQuery.refetch(); readiness.refetch(); registrations.refetch(); }} message="This business workspace could not be loaded." /></AppFrame>;
  const business = businessQuery.data;
  const report = readiness.data;
  const materialAvailable = !!(business.privacyPolicyText && business.smsTermsText);
  const generateMaterials = () => generate.mutate({ businessId }, { onSuccess: result => {
    client.invalidateQueries({ queryKey: getGetBusinessQueryKey(businessId) });
    client.invalidateQueries({ queryKey: getGetReadinessQueryKey(businessId) });
    client.invalidateQueries({ queryKey: getGetPublicComplianceQueryKey(result.publicSlug) });
    toast({ title: 'Public materials are ready', description: 'Privacy policy and SMS terms have been generated.' });
  }, onError: () => toast({ title: 'Could not generate materials', description: 'Please try again in a moment.', variant: 'destructive' }) });
  const submitMock = () => mock.mutate({ businessId }, { onSuccess: () => {
    client.invalidateQueries({ queryKey: getListRegistrationsQueryKey(businessId) });
    client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    toast({ title: 'Mock record saved', description: 'No registration was sent to Twilio or any carrier.' });
  }, onError: () => toast({ title: 'Could not save mock record', description: 'Please try again.', variant: 'destructive' }) });
  const save = (values: FormValues) => update.mutate({ businessId, data: { ...values, sampleMessages: values.sampleMessages.filter(Boolean), consentCopy: values.consentCopy || null } }, {
    onSuccess: () => {
      client.invalidateQueries({ queryKey: getGetBusinessQueryKey(businessId) });
      client.invalidateQueries({ queryKey: getGetReadinessQueryKey(businessId) });
      client.invalidateQueries({ queryKey: getListBusinessesQueryKey() });
      client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      setEditOpen(false); toast({ title: 'Profile updated', description: 'Your readiness checks are refreshing.' });
    },
    onError: () => toast({ title: 'Could not update profile', description: 'Please review your details and retry.', variant: 'destructive' }),
  });
  return <AppFrame><main data-testid="page-business-workspace" className="page-enter">
    <Link href="/app" data-testid="link-workspace-back" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary"><ArrowLeft size={14} /> All businesses</Link>
    <div className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><Eyebrow>Business workspace / {business.businessName}</Eyebrow><h1 className="font-display mt-3 text-3xl font-extrabold tracking-[-.05em] sm:text-[40px]" data-testid="text-business-title">{business.businessName}</h1><p className="mt-2 text-sm text-muted-foreground">{business.brandName} <span className="mx-1.5">·</span> {business.useCase.replaceAll('_', ' ')}</p></div>
      <Button variant="outline" data-testid="button-edit-business" onClick={() => setEditOpen(true)} className="gap-2 rounded-xl"><Pencil size={15} /> Edit profile</Button>
    </div>
    <CampaignAssistant business={business} businessId={businessId} />
    <ApplicationPacket business={business} report={report} />
    <WebsiteOptInKit business={business} onEditProfile={() => setEditOpen(true)} />
    <div className="mt-7 grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
      <section className="overflow-hidden rounded-2xl border border-card-border bg-card surface-shadow" data-testid="section-readiness">
        <div className="flex flex-col justify-between gap-5 bg-[hsl(174_29%_17%)] p-5 text-sidebar-foreground sm:flex-row sm:items-center sm:p-6">
          <div><Eyebrow>Readiness check</Eyebrow><h2 className="font-display mt-2 text-2xl font-bold">Campaign health</h2><p className="mt-1 text-xs text-[hsl(42_15%_72%)]">A practical checklist, not an approval decision.</p></div>
          <div className="flex items-center gap-3"><div className="grid h-[68px] w-[68px] place-items-center rounded-full border-[5px] border-[hsl(38_71%_67%)] bg-[hsl(174_22%_23%)]"><span className="font-display text-xl font-extrabold" data-testid="text-readiness-score">{report?.score ?? '—'}</span></div><span className="max-w-28 text-xs leading-5 text-[hsl(42_18%_81%)]">readiness<br />score</span></div>
        </div>
        {readiness.isError ? <div className="p-5"><ErrorNotice retry={() => readiness.refetch()} message="Readiness checks are temporarily unavailable." /></div> : <div className="p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-[hsl(147_34%_91%)] px-3 py-1.5 text-xs font-bold text-[hsl(157_32%_31%)]" data-testid="count-ready">{report?.readyCount ?? 0} ready</span>
            <span className="rounded-full bg-[hsl(38_65%_90%)] px-3 py-1.5 text-xs font-bold text-[hsl(34_57%_43%)]" data-testid="count-attention">{report?.attentionCount ?? 0} to review</span>
            <span className="rounded-full bg-[hsl(4_67%_95%)] px-3 py-1.5 text-xs font-bold text-[hsl(4_48%_43%)]" data-testid="count-blocking">{report?.blockingCount ?? 0} blocking</span>
          </div>
          {report?.checks?.length ? <div className="divide-y divide-border">{report.checks.map(check => { const meta = stateInfo(check.state); return <div key={check.id} data-testid={`readiness-check-${check.id}`} className="flex items-start gap-3 py-4 first:pt-1"><meta.Icon size={17} className={`mt-0.5 shrink-0 ${check.state === 'ready' ? 'text-[hsl(157_32%_38%)]' : check.state === 'blocking' ? 'text-destructive' : 'text-[hsl(34_57%_43%)]'}`} /><div className="min-w-0 flex-1"><div className="text-sm font-bold" data-testid={`readiness-title-${check.id}`}>{check.title}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{check.detail}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${meta.className}`}>{meta.title}</span></div>; })}</div> : <div className="rounded-xl bg-muted/60 p-6 text-center text-sm text-muted-foreground" data-testid="empty-readiness">No readiness checks are available yet.</div>}
          <div className="mt-5 rounded-xl border border-border bg-muted/50 p-4"><div className="flex items-start gap-3"><Info size={16} className="mt-0.5 shrink-0 text-primary" /><p className="text-xs leading-5 text-muted-foreground">A strong checklist can help surface missing details, but it cannot determine eligibility or guarantee a carrier’s decision.</p></div></div>
        </div>}
      </section>
      <section className="space-y-5">
        <div className="rounded-2xl border border-card-border bg-card p-5 surface-shadow" data-testid="section-profile-summary">
          <div className="flex items-center justify-between"><div><Eyebrow>Profile</Eyebrow><h2 className="font-display mt-2 text-lg font-bold">Business details</h2></div><button data-testid="button-edit-profile-inline" onClick={() => setEditOpen(true)} aria-label="Edit profile" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-primary"><Pencil size={15} /></button></div>
          <dl className="mt-4 space-y-3 text-xs"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Legal name</dt><dd className="text-right font-semibold" data-testid="text-legal-name">{business.legalName}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Contact</dt><dd className="text-right font-semibold" data-testid="text-contact-email">{business.contactEmail}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Business type</dt><dd className="text-right font-semibold">{business.entityType.replaceAll('_', ' ')}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted-foreground">Location</dt><dd className="text-right font-semibold">{business.city}, {business.region}</dd></div></dl>
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-5 surface-shadow" data-testid="section-materials">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[hsl(38_46%_91%)] text-[hsl(34_57%_43%)]"><FileText size={18} /></span><div><Eyebrow>Customer-facing</Eyebrow><h2 className="font-display mt-1 text-lg font-bold">Public materials</h2></div></div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Generate a public privacy policy and SMS terms page from this profile.</p>
          {materialAvailable && business.publicSlug && <div data-testid="materials-published" className="mt-4 rounded-xl border border-[hsl(147_30%_78%)] bg-[hsl(147_36%_94%)] p-3"><div className="flex items-center gap-2 text-xs font-bold text-[hsl(157_32%_31%)]"><CheckCircle2 size={14} /> Published and ready to link</div><Link href={`/compliance/${business.publicSlug}`} className="mt-2 flex items-center gap-2 break-all text-xs font-semibold text-primary hover:underline" data-testid="link-public-materials"><Globe2 size={13} className="shrink-0" /> /compliance/{business.publicSlug} <ExternalLink size={12} /></Link></div>}
          <Button data-testid="button-generate-materials" onClick={generateMaterials} disabled={generate.isPending} variant={materialAvailable ? 'outline' : 'default'} className="mt-4 w-full gap-2 rounded-xl">{generate.isPending ? <LoaderCircle size={15} className="animate-spin" /> : materialAvailable ? <RefreshCw size={15} /> : <Sparkles size={15} />}{generate.isPending ? 'Preparing materials…' : materialAvailable ? 'Refresh materials' : 'Generate public materials'}</Button>
          {materialAvailable && <button type="button" data-testid="button-copy-public-link" onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/compliance/${business.publicSlug}`); toast({ title: 'Public link copied' }); }} className="mt-3 flex w-full items-center justify-center gap-2 py-1 text-xs font-semibold text-muted-foreground hover:text-primary"><Copy size={13} /> Copy public page link</button>}
        </div>
      </section>
    </div>
    <section className="mt-6 rounded-2xl border border-card-border bg-card p-5 sm:p-6 surface-shadow" data-testid="section-registration-history">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><Eyebrow>Local records only</Eyebrow><h2 className="font-display mt-2 text-xl font-bold">Registration history</h2><p className="mt-1 text-xs text-muted-foreground">Mock submissions are saved here for planning only. Nothing is sent to Twilio.</p></div><Button data-testid="button-mock-submit" onClick={submitMock} disabled={!report?.canSubmit || mock.isPending} className="gap-2 rounded-xl">{mock.isPending ? <LoaderCircle size={15} className="animate-spin" /> : <FileCheck2 size={15} />}{mock.isPending ? 'Saving mock record…' : 'Save mock submission'}</Button></div>
      {!report?.canSubmit && <div className="mt-4 flex items-start gap-2 rounded-xl bg-[hsl(38_50%_94%)] p-3 text-xs leading-5 text-[hsl(174_13%_35%)]" data-testid="mock-blocked-notice"><Info size={14} className="mt-0.5 shrink-0" />Resolve the blocking readiness checks before saving a mock submission.</div>}
      {registrations.isError ? <div className="mt-5"><ErrorNotice retry={() => registrations.refetch()} message="Registration history could not be loaded." /></div> : registrations.data?.length ? <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead><tr className="border-b border-border text-[10px] uppercase tracking-[.12em] text-muted-foreground"><th className="pb-3 font-semibold">Record</th><th className="pb-3 font-semibold">Status</th><th className="pb-3 font-semibold">Mode</th><th className="pb-3 font-semibold">Updated</th><th className="pb-3 font-semibold">Note</th></tr></thead><tbody>{registrations.data.map(reg => <tr key={reg.id} data-testid={`registration-row-${reg.id}`} className="border-b border-border last:border-0"><td className="py-4 font-mono text-[10px]">{reg.id.slice(0, 10)}</td><td className="py-4"><span data-testid={`registration-status-${reg.id}`} className="rounded-full bg-[hsl(38_65%_90%)] px-2.5 py-1 font-bold text-[hsl(34_57%_43%)]">{reg.status.replaceAll('_', ' ')}</span></td><td className="py-4"><span className="rounded bg-muted px-2 py-1 font-mono text-[10px]">MOCK</span></td><td className="py-4 text-muted-foreground">{new Date(reg.updatedAt).toLocaleString()}</td><td className="max-w-xs py-4 text-muted-foreground">{reg.message}</td></tr>)}</tbody></table></div> : <div data-testid="empty-registration-history" className="mt-5 flex items-center gap-4 rounded-xl border border-dashed border-border bg-muted/40 p-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-card text-muted-foreground"><FileCheck2 size={18} /></span><div><div className="text-sm font-semibold">No records yet</div><p className="mt-1 text-xs text-muted-foreground">Once ready, you can save a mock submission record for your team.</p></div></div>}
    </section>
    <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle className="font-display text-2xl">Edit business profile</DialogTitle><DialogDescription>Keep the profile accurate so your readiness checklist and materials stay useful.</DialogDescription></DialogHeader><BusinessForm initial={business} onSubmit={save} submitting={update.isPending} submitLabel="Save profile changes" cancel={() => setEditOpen(false)} /></DialogContent></Dialog>
  </main></AppFrame>;
}

function PublicCompliancePage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const query = useGetPublicCompliance(slug, { query: { enabled: !!slug, queryKey: getGetPublicComplianceQueryKey(slug) } });
  const [tab, setTab] = useState<'privacy' | 'terms'>('privacy');
  if (query.isLoading) return <main data-testid="page-public-loading" className="min-h-[100dvh] bg-background px-5 py-12"><div className="mx-auto max-w-3xl space-y-5"><div className="h-10 w-44 animate-pulse rounded bg-muted" /><div className="h-12 w-2/3 animate-pulse rounded bg-muted" /><div className="h-80 animate-pulse rounded-2xl bg-muted" /></div></main>;
  if (query.isError || !query.data) return <main data-testid="page-public-error" className="min-h-[100dvh] bg-background px-5 py-10"><div className="mx-auto max-w-3xl"><Logo /><div className="mt-12"><ErrorNotice retry={() => query.refetch()} message="This public compliance page is not available right now." /></div></div></main>;
  const material = query.data;
  const content = tab === 'privacy' ? material.privacyPolicyText : material.smsTermsText;
  return <main data-testid="page-public-compliance" className="min-h-[100dvh] bg-[hsl(42_31%_97%)]">
    <header className="border-b border-border bg-card"><div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8"><Logo /><span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground"><ShieldCheck size={15} className="text-primary" /> Published information</span></div></header>
    <section className="soft-grid border-b border-border px-5 py-12 sm:px-8 sm:py-16"><div className="mx-auto max-w-5xl"><Eyebrow>Customer information</Eyebrow><h1 className="font-display mt-4 max-w-3xl text-4xl font-extrabold tracking-[-.05em] sm:text-5xl" data-testid="text-public-business">{material.brandName || material.businessName}</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">Privacy information and SMS program terms from {material.businessName}.</p><div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground"><a data-testid="link-contact-email" href={`mailto:${material.contactEmail}`} className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">{material.contactEmail} <ArrowUpRight size={13} /></a><span>Last updated {new Date(material.updatedAt).toLocaleDateString()}</span></div></div></section>
    <section className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <div className="flex gap-2 border-b border-border" role="tablist" aria-label="Compliance materials">
        <button type="button" role="tab" aria-selected={tab === 'privacy'} onClick={() => setTab('privacy')} data-testid="tab-privacy-policy" className={`relative px-4 py-3 text-sm font-bold transition ${tab === 'privacy' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>Privacy policy{tab === 'privacy' && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}</button>
        <button type="button" role="tab" aria-selected={tab === 'terms'} onClick={() => setTab('terms')} data-testid="tab-sms-terms" className={`relative px-4 py-3 text-sm font-bold transition ${tab === 'terms' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>SMS terms{tab === 'terms' && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}</button>
      </div>
      <article className="mt-6 min-h-[320px] rounded-2xl border border-card-border bg-card p-6 sm:p-9 surface-shadow" data-testid={`public-document-${tab}`}><div className="mb-6 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(174_31%_92%)] text-primary">{tab === 'privacy' ? <LockKeyhole size={18} /> : <MessageSquareText size={18} />}</span><div><Eyebrow>{tab === 'privacy' ? 'Privacy information' : 'Messaging program'}</Eyebrow><h2 className="font-display mt-1 text-xl font-bold">{tab === 'privacy' ? 'Privacy policy' : 'SMS program terms'}</h2></div></div><div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground prose-headings:font-display prose-headings:tracking-tight prose-p:leading-7 prose-a:text-primary" data-testid="text-public-document-content">{content || 'No content has been published for this section yet.'}</div></article>
      <div className="mt-6 flex gap-3 rounded-xl border border-[hsl(38_45%_77%)] bg-[hsl(40_50%_93%)] p-4"><Info size={17} className="mt-0.5 shrink-0 text-[hsl(34_57%_43%)]" /><p className="text-xs leading-5 text-[hsl(174_13%_35%)]">This page shares materials prepared by the business. It is not legal advice and does not indicate carrier approval.</p></div>
    </section>
    <footer className="border-t border-border px-5 py-7 text-center text-xs text-muted-foreground"><Logo /><p className="mt-3">Clear information for responsible customer messaging.</p></footer>
  </main>;
}

function HomeRedirect() { return <><Show when="signed-in"><Redirect to="/app" /></Show><Show when="signed-out"><HomePage /></Show></>; }

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Routes() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={HomeRedirect} />
    <Route path="/sign-in/*?" component={() => <LoginPage />} />
    <Route path="/sign-up/*?" component={() => <LoginPage signup />} />
    <Route path="/app">{() => <Protected><Dashboard /></Protected>}</Route>
    <Route path="/businesses/new">{() => <Protected><NewBusiness /></Protected>}</Route>
    <Route path="/businesses/:businessId">{() => <Protected><BusinessWorkspace /></Protected>}</Route>
    <Route path="/compliance/:slug" component={PublicCompliancePage} />
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary>;
}

function ClerkQueryClientCacheInvalidator() {
  const queryClient = useQueryClient();
  const { addListener } = useClerk();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) queryClient.clear();
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);
  return null;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance}
    signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to continue your compliance setup.' } },
      signUp: { start: { title: 'Set up your workspace', subtitle: 'Prepare your SMS campaign with clarity.' } },
    }}
    routerPush={to => setLocation(stripBase(to))}
    routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <TooltipProvider><Routes /><Toaster /></TooltipProvider>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkRoutes /></WouterRouter>;
}

export default App;
