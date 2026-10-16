import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateBusinessBody,
  CreateBusinessResponse,
  CreateMockSubmissionParams,
  CreateMockSubmissionResponse,
  GenerateMaterialsParams,
  GenerateMaterialsResponse,
  GetBusinessParams,
  GetBusinessResponse,
  GetDashboardSummaryResponse,
  GetPublicComplianceParams,
  GetPublicComplianceResponse,
  GetReadinessParams,
  GetReadinessResponse,
  ListBusinessesResponse,
  ListRegistrationsParams,
  ListRegistrationsResponse,
  UpdateBusinessBody,
  UpdateBusinessParams,
  UpdateBusinessResponse,
} from "@workspace/api-zod";
import {
  activityTable,
  businessesTable,
  db,
  registrationsTable,
} from "@workspace/db";
import { buildReadinessReport, buildPrivacyPolicy, buildSmsTerms } from "../lib/compliance";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

function ownerId(res: Response): string {
  return res.locals.userId as string;
}

function asBusinessResponse(
  business: typeof businessesTable.$inferSelect,
) {
  return {
    ...business,
    createdAt: business.createdAt.toISOString(),
    updatedAt: business.updatedAt.toISOString(),
  };
}

function asRegistrationResponse(
  registration: typeof registrationsTable.$inferSelect,
) {
  return {
    ...registration,
    createdAt: registration.createdAt.toISOString(),
    updatedAt: registration.updatedAt.toISOString(),
  };
}

function getOrigin(req: Request): string {
  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto === "https" ? "https" : req.protocol;
  const host = req.get("host");
  if (!host) throw new Error("Could not determine the public app host.");
  return `${protocol}://${host}`;
}

async function getOwnedBusiness(id: string, userId: string) {
  const [business] = await db
    .select()
    .from(businessesTable)
    .where(and(eq(businessesTable.id, id), eq(businessesTable.ownerId, userId)))
    .limit(1);
  return business;
}

async function recordActivity(
  userId: string,
  businessId: string,
  action: string,
  detail: string,
): Promise<void> {
  await db.insert(activityTable).values({
    ownerId: userId,
    businessId,
    action,
    detail,
  });
}

// Publicly accessible by an unguessable slug. Only policy content is returned.
router.get("/public/compliance/:slug", async (req, res): Promise<void> => {
  const params = GetPublicComplianceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.publicSlug, params.data.slug))
    .limit(1);

  if (
    !business?.privacyPolicyText ||
    !business.smsTermsText ||
    !business.publicSlug
  ) {
    res.status(404).json({ error: "Published compliance page not found." });
    return;
  }

  const publicResponse = {
    businessName: business.legalName,
    brandName: business.brandName,
    contactEmail: business.contactEmail,
    privacyPolicyText: business.privacyPolicyText,
    smsTermsText: business.smsTermsText,
    updatedAt: business.updatedAt.toISOString(),
  };
  res.json(GetPublicComplianceResponse.parse(publicResponse));
});

router.use(requireAuth);

router.get("/businesses", async (_req, res): Promise<void> => {
  const userId = ownerId(res);
  const businesses = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.ownerId, userId))
    .orderBy(desc(businessesTable.updatedAt));
  res.json(ListBusinessesResponse.parse(businesses.map(asBusinessResponse)));
});

router.post("/businesses", async (req, res): Promise<void> => {
  const parsed = CreateBusinessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = ownerId(res);
  const [business] = await db
    .insert(businessesTable)
    .values({ ...parsed.data, ownerId: userId })
    .returning();
  await recordActivity(userId, business.id, "business_created", "Business profile created");
  res
    .status(201)
    .json(CreateBusinessResponse.parse(asBusinessResponse(business)));
});

router.get("/businesses/:businessId", async (req, res): Promise<void> => {
  const params = GetBusinessParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const business = await getOwnedBusiness(params.data.businessId, ownerId(res));
  if (!business) {
    res.status(404).json({ error: "Business not found." });
    return;
  }
  res.json(GetBusinessResponse.parse(asBusinessResponse(business)));
});

router.patch("/businesses/:businessId", async (req, res): Promise<void> => {
  const params = UpdateBusinessParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBusinessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = ownerId(res);
  const existing = await getOwnedBusiness(params.data.businessId, userId);
  if (!existing) {
    res.status(404).json({ error: "Business not found." });
    return;
  }

  const [business] = await db
    .update(businessesTable)
    .set({
      ...parsed.data,
      // Any profile change may make the published disclosures inaccurate.
      // Invalidate the public policy until the owner generates it again.
      ...(existing.publicSlug
        ? {
            publicSlug: null,
            privacyPolicyText: null,
            smsTermsText: null,
          }
        : {}),
    })
    .where(
      and(
        eq(businessesTable.id, params.data.businessId),
        eq(businessesTable.ownerId, userId),
      ),
    )
    .returning();

  await recordActivity(userId, business.id, "business_updated", "Business details updated");
  res.json(UpdateBusinessResponse.parse(asBusinessResponse(business)));
});

router.get("/businesses/:businessId/readiness", async (req, res): Promise<void> => {
  const params = GetReadinessParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const business = await getOwnedBusiness(params.data.businessId, ownerId(res));
  if (!business) {
    res.status(404).json({ error: "Business not found." });
    return;
  }
  res.json(GetReadinessResponse.parse(buildReadinessReport(business)));
});

router.post("/businesses/:businessId/materials", async (req, res): Promise<void> => {
  const params = GenerateMaterialsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = ownerId(res);
  const business = await getOwnedBusiness(params.data.businessId, userId);
  if (!business) {
    res.status(404).json({ error: "Business not found." });
    return;
  }

  const publicSlug = business.publicSlug ?? randomUUID();
  const publicUrl = `${getOrigin(req)}/compliance/${publicSlug}`;
  const privacyPolicyText = buildPrivacyPolicy(business);
  const smsTermsText = buildSmsTerms(
    business,
    `${publicUrl}#privacy`,
  );
  const consentCopy =
    business.consentCopy?.trim() ||
    `By checking this box, I agree to receive recurring text messages from ${business.brandName}. Message frequency varies. Message and data rates may apply. Reply STOP to cancel or HELP for help. Consent is not a condition of purchase. Privacy Policy: ${publicUrl}#privacy. SMS Terms: ${publicUrl}#sms-terms.`;
  const [updated] = await db
    .update(businessesTable)
    .set({
      publicSlug,
      privacyPolicyText,
      smsTermsText,
      consentCopy,
    })
    .where(
      and(
        eq(businessesTable.id, business.id),
        eq(businessesTable.ownerId, userId),
      ),
    )
    .returning();
  await recordActivity(
    userId,
    business.id,
    "materials_generated",
    "Privacy policy and SMS terms published",
  );

  const response = {
    businessId: updated.id,
    publicSlug,
    publicUrl,
    privacyPolicyText,
    smsTermsText,
    consentCopy,
  };
  res.json(GenerateMaterialsResponse.parse(response));
});

router.get(
  "/businesses/:businessId/registrations",
  async (req, res): Promise<void> => {
    const params = ListRegistrationsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const userId = ownerId(res);
    const business = await getOwnedBusiness(params.data.businessId, userId);
    if (!business) {
      res.status(404).json({ error: "Business not found." });
      return;
    }
    const registrations = await db
      .select()
      .from(registrationsTable)
      .where(
        and(
          eq(registrationsTable.businessId, business.id),
          eq(registrationsTable.ownerId, userId),
        ),
      )
      .orderBy(desc(registrationsTable.createdAt));
    res.json(
      ListRegistrationsResponse.parse(
        registrations.map(asRegistrationResponse),
      ),
    );
  },
);

router.post(
  "/businesses/:businessId/mock-submissions",
  async (req, res): Promise<void> => {
    const params = CreateMockSubmissionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const userId = ownerId(res);
    const business = await getOwnedBusiness(params.data.businessId, userId);
    if (!business) {
      res.status(404).json({ error: "Business not found." });
      return;
    }
    const readiness = buildReadinessReport(business);
    if (!readiness.canSubmit) {
      res.status(400).json({
        error: "Complete the blocking readiness checks before running a mock submission.",
      });
      return;
    }

    const message =
      "Mock submission saved. Twilio was not contacted, and this does not indicate approval.";
    const [registration] = await db
      .insert(registrationsTable)
      .values({
        ownerId: userId,
        businessId: business.id,
        status: "submitted",
        mode: "mock",
        isMock: true,
        message,
      })
      .returning();
    await recordActivity(
      userId,
      business.id,
      "mock_submission",
      "Mock registration saved; Twilio was not contacted",
    );
    res
      .status(201)
      .json(
        CreateMockSubmissionResponse.parse(
          asRegistrationResponse(registration),
        ),
      );
  },
);

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const userId = ownerId(res);
  const businesses = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.ownerId, userId))
    .orderBy(desc(businessesTable.updatedAt));
  const registrations = await db
    .select()
    .from(registrationsTable)
    .where(eq(registrationsTable.ownerId, userId));
  const activities = await db
    .select({
      id: activityTable.id,
      businessId: activityTable.businessId,
      businessName: businessesTable.businessName,
      action: activityTable.action,
      detail: activityTable.detail,
      createdAt: activityTable.createdAt,
    })
    .from(activityTable)
    .innerJoin(
      businessesTable,
      eq(activityTable.businessId, businessesTable.id),
    )
    .where(eq(activityTable.ownerId, userId))
    .orderBy(desc(activityTable.createdAt))
    .limit(8);

  const readinessReports = businesses.map(buildReadinessReport);
  const response = {
    businessCount: businesses.length,
    readyCount: readinessReports.filter((report) => report.canSubmit).length,
    submittedCount: registrations.filter(
      (registration) => registration.status === "submitted",
    ).length,
    needsWorkCount: readinessReports.filter(
      (report) => report.blockingCount > 0,
    ).length,
    recentActivity: activities.map((activity) => ({
      ...activity,
      createdAt: activity.createdAt.toISOString(),
    })),
  };
  res.json(GetDashboardSummaryResponse.parse(response));
});

export default router;
