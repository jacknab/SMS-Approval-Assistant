import type { Business } from "@workspace/db";
import type { ReadinessReport } from "@workspace/api-zod";

const hasText = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

export function buildReadinessReport(
  business: Business,
): ReadinessReport {
  const sampleMessages = business.sampleMessages ?? [];
  const hasBrandInSample = sampleMessages.some((message) => {
    const normalized = message.toLowerCase();
    return (
      normalized.includes(business.brandName.toLowerCase()) ||
      normalized.includes(business.businessName.toLowerCase())
    );
  });
  const disclosures = business.consentCopy?.toUpperCase() ?? "";
  const hasStop = disclosures.includes("STOP");
  const hasHelp = disclosures.includes("HELP");
  const hasPublicMaterials =
    Boolean(business.publicSlug) &&
    hasText(business.privacyPolicyText) &&
    hasText(business.smsTermsText);

  const checks: ReadinessReport["checks"] = [
    {
      id: "website",
      title: "Business website",
      detail:
        "Your public business website is included. Confirm it loads without a sign-in and clearly identifies the business.",
      state: hasText(business.websiteUrl) ? "ready" : "blocking",
    },
    {
      id: "identity",
      title: "Business and brand identity",
      detail:
        business.legalName.trim().toLowerCase() ===
        business.brandName.trim().toLowerCase()
          ? "The legal business name and public brand name match."
          : "Your legal name differs from the public brand. Make their relationship clear on your website and registration.",
      state:
        business.legalName.trim().toLowerCase() ===
        business.brandName.trim().toLowerCase()
          ? "ready"
          : "needs_attention",
    },
    {
      id: "address",
      title: "Business address",
      detail:
        [business.streetAddress, business.city, business.region, business.postalCode]
          .every(hasText)
          ? "A complete physical business address is on file."
          : "Add a complete physical business address.",
      state:
        [business.streetAddress, business.city, business.region, business.postalCode]
          .every(hasText)
          ? "ready"
          : "blocking",
    },
    {
      id: "campaign-description",
      title: "Campaign description",
      detail:
        business.campaignDescription.trim().length >= 80
          ? "The description explains who receives messages and why."
          : "Add at least 80 characters describing who receives messages, what they contain, and why.",
      state:
        business.campaignDescription.trim().length >= 80
          ? "ready"
          : business.campaignDescription.trim().length > 0
            ? "needs_attention"
            : "blocking",
    },
    {
      id: "sample-message",
      title: "Sample message identifies your business",
      detail: hasBrandInSample
        ? "At least one sample message includes your public business or brand name."
        : "Add a real example that names your business or brand. Do not use invented consent or placeholder messages.",
      state: hasBrandInSample ? "ready" : "blocking",
    },
    {
      id: "opt-in-flow",
      title: "Opt-in method and evidence",
      detail:
        business.optInDescription.trim().length >= 60
          ? "The opt-in description explains how a person actively agrees to receive texts."
          : "Describe where consent is collected and what a person does to opt in (at least 60 characters).",
      state:
        business.optInDescription.trim().length >= 60
          ? "ready"
          : business.optInDescription.trim().length > 0
            ? "needs_attention"
            : "blocking",
    },
    {
      id: "checkbox",
      title: "Consent is affirmative",
      detail:
        business.optInMethod !== "website_form"
          ? "For this opt-in method, keep a verifiable record showing the person actively agreed."
          : business.consentCheckboxPresent
            ? "The website flow uses a separate, unchecked SMS consent checkbox."
            : "Add a separate, unchecked SMS consent checkbox. Do not bundle SMS consent with general terms.",
      state:
        business.optInMethod !== "website_form"
          ? "needs_attention"
          : business.consentCheckboxPresent
            ? "ready"
            : "blocking",
    },
    {
      id: "stop-help",
      title: "STOP and HELP disclosures",
      detail:
        hasStop && hasHelp
          ? "The opt-in disclosure includes STOP and HELP instructions."
          : "Generate or update the opt-in disclosure so it includes both STOP and HELP instructions.",
      state: hasStop && hasHelp ? "ready" : "blocking",
    },
    {
      id: "public-policies",
      title: "Public privacy policy and SMS terms",
      detail: hasPublicMaterials
        ? "Both policy pages are available at a public URL. Open the link and confirm it works before sharing it."
        : "Generate and publish the privacy policy and SMS terms before submitting.",
      state: hasPublicMaterials ? "ready" : "blocking",
    },
  ];

  const readyCount = checks.filter((check) => check.state === "ready").length;
  const attentionCount = checks.filter(
    (check) => check.state === "needs_attention",
  ).length;
  const blockingCount = checks.filter(
    (check) => check.state === "blocking",
  ).length;

  return {
    businessId: business.id,
    score: Math.round((readyCount / checks.length) * 100),
    readyCount,
    attentionCount,
    blockingCount,
    canSubmit: blockingCount === 0,
    checks,
  };
}

export function buildPrivacyPolicy(business: Business): string {
  return `${business.brandName} Privacy Policy

${business.legalName} ("${business.brandName}," "we," or "us") operates the business website at ${business.websiteUrl}. This policy explains how we handle information collected when you use our website or choose to receive text messages from us.

Information we collect
We may collect contact details you provide, including your phone number and email address, information about your requests or transactions, and records of your messaging preferences and consent. We use this information to provide the services you request, respond to questions, send messages you have agreed to receive, and maintain required business records.

Text messages
If you opt in to SMS messages, we use your phone number and consent record to send the message types described when you signed up. Message frequency varies by program. Message and data rates may apply. Reply STOP to opt out or HELP for assistance.

Sharing and service providers
We do not sell your personal information or share it with third parties for their own marketing. We may share information with vendors who help us operate our services and messaging programs, and with carriers or other parties as needed to deliver messages, meet legal requirements, or protect our rights. These providers may use information only to perform services for us.

Retention and security
We keep information for as long as needed for the purposes above and to meet legal and operational requirements. We use reasonable safeguards, but no method of storage or transmission is completely secure.

Your choices and contact
You can opt out of text messages at any time by replying STOP. For help, reply HELP or contact us at ${business.contactEmail}. Contact us at the same address with questions about this policy or your information.

This generated policy is a starting point for review, not legal advice. Confirm that it accurately describes your actual practices before publishing it.`;
}

export function buildSmsTerms(
  business: Business,
  privacyUrl: string,
): string {
  return `${business.brandName} SMS Terms

Program description
${business.legalName} sends ${business.useCase.replaceAll("_", " ")} text messages under the ${business.brandName} program. Messages are sent only to people who have opted in. The program may include: ${business.campaignDescription || "messages related to the services you requested"}.

Consent and frequency
By providing your number and completing the described opt-in action, you agree to receive recurring automated text messages from ${business.brandName}. Message frequency varies${business.messageFrequency ? `; ${business.messageFrequency}` : ""}. Consent is not a condition of purchase.

Message and data rates
Message and data rates may apply. Check with your wireless provider for details.

Opt out and help
Reply STOP to any message to cancel. You may receive one confirmation message after opting out. Reply HELP for help, or contact ${business.contactEmail}.

Carriers
Wireless carriers are not liable for delayed or undelivered messages.

Privacy
See our Privacy Policy: ${privacyUrl}. We do not sell your personal information or share your mobile number with third parties for their own marketing.

Only publish these terms after confirming they match your actual messaging and consent practices. This generated template is not legal advice.`;
}
