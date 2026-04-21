import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import {
  ArrowLeft,
  Check,
  Download,
  History,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CvEditorPanel } from "@/components/cv/CvEditorPanel";
import { openCvPrintDialog, type CVDocument } from "@/components/cv/CvRenderer";
import { cvDocumentToSnapshot, hasCvDocumentContent, snapshotToCvDocument } from "@/lib/cvDocument";
import { extractCvPdfSegments } from "@/lib/cvPdfExtract";
import { issueAndCopyCvShareLink } from "@/lib/cvAccess";
import { getCvCopy, getCvLanguageLabel, type CvLanguageCode } from "@/lib/cvLanguage";
import {
  ANONYMIZED_EN_CV_VARIANT,
  ANONYMIZED_NB_CV_VARIANT,
  ORIGINAL_EN_CV_VARIANT,
  ORIGINAL_NB_CV_VARIANT,
  applyCvVariantInvariants,
  createAnonymizedCvDocument,
  getCvVariantSource,
  getCvVariantStorageKey,
  isRootCvVariant,
  type CvVariantIdentity,
} from "@/lib/cvVariants";
import { toast } from "sonner";

const DEFAULT_CONTACT = {
  name: "Jon Richard Nygaard",
  phone: "932 87 267",
  email: "jr@stacq.no",
};

const ANONYMIZED_CV_PLACEHOLDER_URL = "/cv-photos/anonymous-placeholder.svg";

const EMPTY_CV: CVDocument = {
  hero: {
    name: "",
    title: "",
    contact: {
      ...DEFAULT_CONTACT,
      title: getCvCopy("nb").contactPerson,
    },
  },
  sidebarSections: [
    { heading: "PERSONALIA", items: [] },
    { heading: "NØKKELPUNKTER", items: [] },
    { heading: "UTDANNELSE", items: [] },
  ],
  introParagraphs: [],
  competenceGroups: [{ label: "Programmeringsspråk", content: "" }],
  projectsTitle: "",
  projects: [],
  additionalSections: [],
  education: [],
  workExperience: [],
};

type CvVersionMeta = {
  created_at: string | null;
  source: string | null;
};

type CvVersionRow = Database["public"]["Tables"]["cv_versions"]["Row"];
type CvVariantRow = Database["public"]["Tables"]["cv_document_variants"]["Row"];
type VariantBusyMode = "creating" | "syncing" | "regenerating";

type LoadedCvVariant = {
  id: string;
  languageCode: CvLanguageCode;
  isAnonymized: boolean;
  cvData: CVDocument;
  updatedAt: string | null;
  sourceOriginalUpdatedAt: string | null;
};

type VariantBusyState = {
  key: string;
  mode: VariantBusyMode;
};

function isDefaultContactTitle(value?: string | null) {
  const normalized = value?.trim().toLocaleLowerCase() || "";
  if (!normalized) return false;

  return (
    normalized === getCvCopy("nb").contactPerson.toLocaleLowerCase() ||
    normalized === getCvCopy("en").contactPerson.toLocaleLowerCase()
  );
}

function getDefaultContact(languageCode: CvLanguageCode = "nb", currentContact?: CVDocument["hero"]["contact"]) {
  return {
    title:
      currentContact?.title?.trim() && !isDefaultContactTitle(currentContact.title)
        ? currentContact.title
        : getCvCopy(languageCode).contactPerson,
    name: currentContact?.name || DEFAULT_CONTACT.name,
    phone: currentContact?.phone || DEFAULT_CONTACT.phone,
    email: currentContact?.email || DEFAULT_CONTACT.email,
  };
}

function getErrorMessage(error: unknown, fallback = "Ukjent feil") {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string" &&
    (error as { message: string }).message.trim()
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return "Ikke registrert ennå";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ikke registrert ennå";

  return format(date, "d. MMM yyyy HH:mm", { locale: nb });
}

function getLatestVersionDates(versions: CvVersionMeta[]) {
  const lastAdmin = versions.find((version) => version.source === "admin")?.created_at ?? null;
  const lastAnsatt = versions.find((version) => version.source === "ansatt")?.created_at ?? null;

  return { lastAdmin, lastAnsatt };
}

async function syncCompetenceFromCv(ansattId: number) {
  const { data, error } = await supabase.functions.invoke("sync-cv-kompetanse", {
    body: { ansatt_id: ansattId },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

function toLoadedVariant(row: CvVariantRow, fallbackContact: CVDocument["hero"]["contact"]): LoadedCvVariant {
  const languageCode = row.language_code as CvVariantIdentity["languageCode"];
  const variant = {
    languageCode,
    isAnonymized: row.is_anonymized,
  } satisfies CvVariantIdentity;
  const cvData = snapshotToCvDocument(
    row.snapshot as Record<string, unknown>,
    getDefaultContact(languageCode, fallbackContact),
  );

  return {
    id: row.id,
    languageCode,
    isAnonymized: row.is_anonymized,
    cvData: applyCvVariantInvariants(cvData, variant),
    updatedAt: row.updated_at || null,
    sourceOriginalUpdatedAt: row.source_original_updated_at || null,
  };
}

function indexVariants(rows: CvVariantRow[], fallbackContact: CVDocument["hero"]["contact"]) {
  return rows.reduce<Record<string, LoadedCvVariant>>((accumulator, row) => {
    const key = getCvVariantStorageKey({
      languageCode: row.language_code as CvVariantIdentity["languageCode"],
      isAnonymized: row.is_anonymized,
    });
    accumulator[key] = toLoadedVariant(row, fallbackContact);
    return accumulator;
  }, {});
}

function isOlderDate(left?: string | null, right?: string | null) {
  if (!left || !right) return false;
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) return false;
  return leftTime < rightTime;
}

function getVariantDisplayLabel(variant: CvVariantIdentity) {
  if (variant.languageCode === "nb") {
    return variant.isAnonymized ? getCvCopy("nb").anonymizedLabel : getCvCopy("nb").originalLabel;
  }

  const stateLabel = variant.isAnonymized ? getCvCopy("en").anonymizedLabel : getCvCopy("en").originalLabel;
  return `${getCvLanguageLabel("en")} ${stateLabel.toLocaleLowerCase("en-US")}`;
}

function getVariantCreateMessage(variant: CvVariantIdentity) {
  if (variant.languageCode === "nb" && variant.isAnonymized) return "Anonymisert CV opprettet fra originalen.";
  if (variant.languageCode === "en" && variant.isAnonymized) return "Engelsk anonymisert CV opprettet fra norsk kilde.";
  return "Engelsk CV opprettet fra originalen.";
}

function getVariantSyncMessage(variant: CvVariantIdentity) {
  if (variant.languageCode === "nb" && variant.isAnonymized) return "Anonymisert CV ble oppdatert fra siste original.";
  if (variant.languageCode === "en" && variant.isAnonymized) {
    return "Engelsk anonymisert CV ble oppdatert fra siste norske kilde.";
  }
  return "Engelsk CV ble oppdatert fra siste original.";
}

function getVariantRegenerateButtonLabel(variant: CvVariantIdentity) {
  if (variant.languageCode === "nb" && variant.isAnonymized) return "Regenerer anonymisert";
  if (variant.languageCode === "en" && variant.isAnonymized) return "Oversett anonymisert på nytt";
  return "Oversett på nytt";
}

function getVariantHeading(variant: CvVariantIdentity) {
  if (variant.languageCode === "en") {
    return variant.isAnonymized ? "English anonymized CV" : "English CV";
  }

  return variant.isAnonymized ? "Anonymisert CV" : "CV";
}

export default function CvAdmin() {
  const { ansattId } = useParams<{ ansattId: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [originalCvData, setOriginalCvData] = useState<CVDocument | null>(null);
  const [cvId, setCvId] = useState<string | null>(null);
  const [ansattName, setAnsattName] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [originalUpdatedAt, setOriginalUpdatedAt] = useState<string | null>(null);
  const [lastAdminUpdatedAt, setLastAdminUpdatedAt] = useState<string | null>(null);
  const [lastAnsattUpdatedAt, setLastAnsattUpdatedAt] = useState<string | null>(null);
  const [activeVariant, setActiveVariant] = useState<CvVariantIdentity>(ORIGINAL_NB_CV_VARIANT);
  const [variantDocuments, setVariantDocuments] = useState<Record<string, LoadedCvVariant>>({});
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<CvVersionRow[]>([]);
  const [cvUploadParsing, setCvUploadParsing] = useState(false);
  const [variantBusy, setVariantBusy] = useState<VariantBusyState | null>(null);
  const cvUploadRef = useRef<HTMLInputElement>(null);
  const [fullscreen, setFullscreen] = useState(true);

  const baseContact = useMemo(
    () => getDefaultContact("nb", originalCvData?.hero.contact),
    [originalCvData?.hero.contact],
  );
  const activeVariantKey = getCvVariantStorageKey(activeVariant);
  const activeIsRootVariant = isRootCvVariant(activeVariant);
  const activeLoadedVariant = activeIsRootVariant ? null : variantDocuments[activeVariantKey];
  const activeCvData = activeIsRootVariant ? originalCvData : activeLoadedVariant?.cvData ?? null;
  const activePreviewImageUrl = activeVariant.isAnonymized ? ANONYMIZED_CV_PLACEHOLDER_URL : imageUrl;

  const getStoredVariant = useCallback(
    (variant: CvVariantIdentity) => variantDocuments[getCvVariantStorageKey(variant)],
    [variantDocuments],
  );

  const getVariantUpdatedAt = useCallback(
    (variant: CvVariantIdentity) => {
      if (isRootCvVariant(variant)) return originalUpdatedAt;
      return getStoredVariant(variant)?.updatedAt ?? null;
    },
    [getStoredVariant, originalUpdatedAt],
  );

  const isVariantStale = useCallback(
    (variant: CvVariantIdentity, visited = new Set<string>()) => {
      if (isRootCvVariant(variant)) return false;

      const variantKey = getCvVariantStorageKey(variant);
      if (visited.has(variantKey)) return false;

      const existing = getStoredVariant(variant);
      if (!existing) return true;

      const sourceVariant = getCvVariantSource(variant);
      if (!sourceVariant) return false;

      const nextVisited = new Set(visited);
      nextVisited.add(variantKey);

      if (!isRootCvVariant(sourceVariant) && isVariantStale(sourceVariant, nextVisited)) {
        return true;
      }

      const sourceUpdatedAt = getVariantUpdatedAt(sourceVariant);
      return isOlderDate(existing.sourceOriginalUpdatedAt, sourceUpdatedAt);
    },
    [getStoredVariant, getVariantUpdatedAt],
  );

  const staleDerivedVariants = useMemo(
    () =>
      [ANONYMIZED_NB_CV_VARIANT, ORIGINAL_EN_CV_VARIANT, ANONYMIZED_EN_CV_VARIANT].filter((variant) =>
        Boolean(getStoredVariant(variant)) && isVariantStale(variant),
      ),
    [getStoredVariant, isVariantStale],
  );

  const updateVariantInState = useCallback((row: CvVariantRow) => {
    const key = getCvVariantStorageKey({
      languageCode: row.language_code as CvVariantIdentity["languageCode"],
      isAnonymized: row.is_anonymized,
    });
    const loadedVariant = toLoadedVariant(row, baseContact);

    setVariantDocuments((current) => ({
      ...current,
      [key]: loadedVariant,
    }));

    return loadedVariant;
  }, [baseContact]);

  const handleShareLink = useCallback(async () => {
    const id = Number(ansattId);
    if (Number.isNaN(id)) return;

    try {
      const { pin, valid_days } = await issueAndCopyCvShareLink(supabase, id);
      toast.success(`Link og PIN kopiert for ${valid_days} dager. PIN: ${pin} — del med ${ansattName || "konsulenten"}`, {
        duration: 10000,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ukjent feil";
      toast.error("Kunne ikke generere link: " + message);
    }
  }, [ansattId, ansattName]);

  const loadVersionDates = useCallback(async (currentCvId: string) => {
    const { data, error } = await supabase
      .from("cv_versions")
      .select("created_at, source")
      .eq("cv_id", currentCvId)
      .is("variant_id", null)
      .order("created_at", { ascending: false });

    if (error) return;

    const { lastAdmin, lastAnsatt } = getLatestVersionDates((data || []) as CvVersionMeta[]);
    setLastAdminUpdatedAt(lastAdmin);
    setLastAnsattUpdatedAt(lastAnsatt);
  }, []);

  useEffect(() => {
    if (!ansattId || !user) return;

    const parsedAnsattId = Number(ansattId);
    if (Number.isNaN(parsedAnsattId)) return;

    let cancelled = false;

    const loadCvAdminData = async () => {
      const { data: ansatt } = await supabase
        .from("stacq_ansatte")
        .select("navn, bilde_url")
        .eq("id", parsedAnsattId)
        .single();

      if (cancelled) return;

      if (ansatt) {
        setAnsattName(ansatt.navn || "");
        setImageUrl(ansatt.bilde_url || undefined);
      }

      let { data: cvRow } = await supabase.from("cv_documents").select("*").eq("ansatt_id", parsedAnsattId).single();

      if (!cvRow) {
        const newDocument = {
          ansatt_id: parsedAnsattId,
          ...cvDocumentToSnapshot({
            ...EMPTY_CV,
            hero: {
              ...EMPTY_CV.hero,
              name: ansatt?.navn || "",
            },
          }),
        };

        const { data: insertedRow } = await supabase.from("cv_documents").insert(newDocument).select().single();

        cvRow = insertedRow;
      }

      if (cancelled || !cvRow) return;

      const originalDocument = snapshotToCvDocument(cvRow, getDefaultContact("nb"));
      setCvId(cvRow.id);
      setOriginalCvData(originalDocument);
      setOriginalUpdatedAt(cvRow.updated_at || null);

      const { data: variantRows } = await supabase.from("cv_document_variants").select("*").eq("cv_id", cvRow.id);
      if (!cancelled) {
        setVariantDocuments(indexVariants((variantRows || []) as CvVariantRow[], originalDocument.hero.contact));
      }

      void loadVersionDates(cvRow.id);
    };

    loadCvAdminData();

    return () => {
      cancelled = true;
    };
  }, [ansattId, user, loadVersionDates]);

  useEffect(() => {
    if (!ansattName) return;
    const prefix = getVariantHeading(activeVariant);
    const title = `${prefix} - ${ansattName} - STACQ`;
    document.title = title;
    return () => {
      document.title = "STACQ Hot & Fast";
    };
  }, [activeVariant, ansattName]);

  const runCompetenceSync = useCallback(async () => {
    const numericAnsattId = Number(ansattId);
    if (Number.isNaN(numericAnsattId)) return;

    try {
      await syncCompetenceFromCv(numericAnsattId);
    } catch (error) {
      console.error("Failed to sync competence from CV:", error);
      toast.error("CV ble lagret, men kompetanse kunne ikke synkroniseres til CRM.");
    }
  }, [ansattId]);

  const generateTranslatedVariantDocument = useCallback(async (sourceDoc: CVDocument, variant: CvVariantIdentity) => {
    const { data, error } = await supabase.functions.invoke("translate-cv-variant", {
      body: {
        doc: sourceDoc,
        is_anonymized: variant.isAnonymized,
        target_language_code: variant.languageCode,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    const translatedDoc = data?.document as CVDocument | undefined;
    if (!translatedDoc || typeof translatedDoc !== "object") {
      throw new Error("Oversettelsen returnerte ugyldig CV-data");
    }

    return applyCvVariantInvariants(translatedDoc, variant);
  }, []);

  const saveVariantDocument = useCallback(
    async (variant: CvVariantIdentity, doc: CVDocument, sourceOriginalUpdatedAt?: string | null) => {
      if (!cvId) throw new Error("CV mangler");

      const savedAt = new Date().toISOString();
      const normalizedDoc = applyCvVariantInvariants(doc, variant);
      const snapshot = { ...cvDocumentToSnapshot(normalizedDoc), updated_at: savedAt };
      const jsonSnapshot = snapshot as Json;
      const existingVariant = getStoredVariant(variant);
      const resolvedSourceUpdatedAt =
        sourceOriginalUpdatedAt ?? existingVariant?.sourceOriginalUpdatedAt ?? originalUpdatedAt ?? null;

      const { data: variantRow, error } = await supabase
        .from("cv_document_variants")
        .upsert(
          {
            cv_id: cvId,
            language_code: variant.languageCode,
            is_anonymized: variant.isAnonymized,
            snapshot: jsonSnapshot,
            source_original_updated_at: resolvedSourceUpdatedAt,
            updated_at: savedAt,
          },
          { onConflict: "cv_id,language_code,is_anonymized" },
        )
        .select("*")
        .single();

      if (error || !variantRow) {
        throw error || new Error("Kunne ikke lagre variant");
      }

      const { error: versionError } = await supabase.from("cv_versions").insert({
        cv_id: cvId,
        variant_id: variantRow.id,
        snapshot: jsonSnapshot,
        saved_by: user?.email || "crm",
        source: "admin",
        created_at: savedAt,
      });

      if (versionError) {
        throw versionError;
      }

      const loadedVariant = updateVariantInState({
        ...variantRow,
        snapshot: jsonSnapshot,
        updated_at: savedAt,
        source_original_updated_at: resolvedSourceUpdatedAt,
      } as CvVariantRow);

      return loadedVariant;
    },
    [cvId, getStoredVariant, originalUpdatedAt, updateVariantInState, user?.email],
  );

  const materializeVariant = useCallback(
    async function materializeVariantInner(
      variant: CvVariantIdentity,
      options?: { force?: boolean },
    ): Promise<{
      doc: CVDocument;
      updatedAt: string | null;
      status: "existing" | "created" | "updated";
      loadedVariant?: LoadedCvVariant;
    }> {
      if (isRootCvVariant(variant)) {
        if (!originalCvData) throw new Error("Original CV mangler");
        return {
          doc: originalCvData,
          updatedAt: originalUpdatedAt,
          status: "existing",
        };
      }

      const existingVariant = getStoredVariant(variant);
      const sourceVariant = getCvVariantSource(variant);
      if (!sourceVariant) throw new Error("Varianten mangler kilde");

      const sourceResult = await materializeVariantInner(sourceVariant, { force: false });
      const sourceIsStale = !isRootCvVariant(sourceVariant) && isVariantStale(sourceVariant);
      const sourceUpdatedAt = sourceResult.updatedAt ?? getVariantUpdatedAt(sourceVariant);
      const needsSync =
        Boolean(options?.force) ||
        !existingVariant ||
        sourceIsStale ||
        isOlderDate(existingVariant.sourceOriginalUpdatedAt, sourceUpdatedAt);

      if (!needsSync && existingVariant) {
        return {
          doc: existingVariant.cvData,
          updatedAt: existingVariant.updatedAt,
          status: "existing",
          loadedVariant: existingVariant,
        };
      }

      const nextDoc =
        variant.languageCode === "nb"
          ? createAnonymizedCvDocument(sourceResult.doc, variant.languageCode)
          : await generateTranslatedVariantDocument(sourceResult.doc, variant);

      const loadedVariant = await saveVariantDocument(variant, nextDoc, sourceUpdatedAt);

      return {
        doc: loadedVariant.cvData,
        updatedAt: loadedVariant.updatedAt,
        status: existingVariant ? "updated" : "created",
        loadedVariant,
      };
    },
    [
      generateTranslatedVariantDocument,
      getStoredVariant,
      getVariantUpdatedAt,
      isVariantStale,
      originalCvData,
      originalUpdatedAt,
      saveVariantDocument,
    ],
  );

  const activateVariant = useCallback(
    async (variant: CvVariantIdentity, options?: { force?: boolean }) => {
      if (isRootCvVariant(variant)) {
        setActiveVariant(variant);
        return;
      }

      const busyKey = getCvVariantStorageKey(variant);
      const existingVariant = getStoredVariant(variant);
      setVariantBusy({
        key: busyKey,
        mode: options?.force ? "regenerating" : existingVariant ? "syncing" : "creating",
      });

      try {
        const result = await materializeVariant(variant, options);
        setActiveVariant(variant);

        if (result.status === "created") {
          toast.success(getVariantCreateMessage(variant));
        } else if (result.status === "updated" && options?.force) {
          toast.success(getVariantSyncMessage(variant));
        } else if (result.status === "updated" && !options?.force) {
          toast.info(getVariantSyncMessage(variant));
        }
      } catch (error) {
        const message = getErrorMessage(error);
        throw new Error(message);
      } finally {
        setVariantBusy((current) => (current?.key === busyKey ? null : current));
      }
    },
    [getStoredVariant, materializeVariant],
  );

  const handleSave = useCallback(
    async (doc: CVDocument) => {
      if (!cvId) return;

      if (!activeIsRootVariant) {
        const sourceVariant = getCvVariantSource(activeVariant);
        const sourceUpdatedAt = sourceVariant ? getVariantUpdatedAt(sourceVariant) : originalUpdatedAt;
        await saveVariantDocument(activeVariant, doc, sourceUpdatedAt);
        return;
      }

      const savedAt = new Date().toISOString();
      const snapshot = { ...cvDocumentToSnapshot(doc), updated_at: savedAt };
      const jsonSnapshot = snapshot as Json;

      const { error } = await supabase
        .from("cv_documents")
        .update(jsonSnapshot)
        .eq("id", cvId);

      if (error) {
        throw error;
      }

      const { error: versionError } = await supabase.from("cv_versions").insert({
        cv_id: cvId,
        variant_id: null,
        snapshot: jsonSnapshot,
        saved_by: user?.email || "crm",
        source: "admin",
        created_at: savedAt,
      });

      if (versionError) {
        throw versionError;
      }

      setOriginalCvData(doc);
      setOriginalUpdatedAt(savedAt);
      setLastAdminUpdatedAt(savedAt);
      await runCompetenceSync();
    },
    [
      activeIsRootVariant,
      activeVariant,
      cvId,
      getVariantUpdatedAt,
      originalUpdatedAt,
      runCompetenceSync,
      saveVariantDocument,
      user?.email,
    ],
  );

  const loadVersions = useCallback(async () => {
    if (!cvId) return;
    let query = supabase.from("cv_versions").select("*").eq("cv_id", cvId).order("created_at", { ascending: false });

    if (!activeIsRootVariant) {
      if (!activeLoadedVariant?.id) {
        toast.error("Denne varianten er ikke opprettet ennå.");
        return;
      }
      query = query.eq("variant_id", activeLoadedVariant.id);
    } else {
      query = query.is("variant_id", null);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Kunne ikke laste versjonshistorikk");
      return;
    }

    setVersions(data || []);
    setVersionsOpen(true);
  }, [activeIsRootVariant, activeLoadedVariant?.id, cvId]);

  const restoreVersion = useCallback((snapshot: Record<string, unknown> | null | undefined) => {
    const restoredBaseDoc = snapshotToCvDocument(snapshot, getDefaultContact(activeVariant.languageCode, baseContact));
    const restoredDoc = applyCvVariantInvariants(restoredBaseDoc, activeVariant);

    if (!activeIsRootVariant) {
      if (!activeLoadedVariant) return;

      setVariantDocuments((current) => ({
        ...current,
        [activeVariantKey]: {
          ...activeLoadedVariant,
          cvData: restoredDoc,
          updatedAt: typeof snapshot?.updated_at === "string" ? snapshot.updated_at : activeLoadedVariant.updatedAt,
        },
      }));
    } else {
      setOriginalCvData(restoredDoc);
    }

    setVersionsOpen(false);
    toast.info("Versjon gjenopprettet — husk å kontrollere og la autosave lagre endringen.");
  }, [activeIsRootVariant, activeLoadedVariant, activeVariant, activeVariantKey, baseContact]);

  const handleDownloadPdf = useCallback(
    async (doc: CVDocument) => {
      if (cvId) {
        await supabase.from("cv_versions").insert({
          cv_id: cvId,
          variant_id: activeIsRootVariant ? null : activeLoadedVariant?.id ?? null,
          snapshot: cvDocumentToSnapshot(doc) as Json,
          saved_by: user?.email || "crm",
          source: "admin",
        });
      }

      const titlePrefix = getVariantHeading(activeVariant);
      await openCvPrintDialog(
        doc.hero.name ? `${titlePrefix} - ${doc.hero.name} - STACQ` : `${titlePrefix} - STACQ`,
        activeVariant.languageCode,
      );
    },
    [activeIsRootVariant, activeLoadedVariant?.id, activeVariant, cvId, user?.email],
  );

  const handleCvUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!activeIsRootVariant) {
        toast.info("Bytt til original CV for å importere og analysere PDF.");
        e.target.value = "";
        return;
      }

      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";

      setCvUploadParsing(true);
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        let segments: Awaited<ReturnType<typeof extractCvPdfSegments>>["segments"] = [];
        let isLowTextConfidence = true;

        try {
          const extracted = await extractCvPdfSegments(file);
          segments = extracted.segments;
          isLowTextConfidence = extracted.isLowTextConfidence;
        } catch (extractError) {
          console.warn("Could not extract deterministic PDF text, falling back to OCR import:", extractError);
        }

        const { data, error } = await supabase.functions.invoke("parse-cv-editor", {
          body: { base64, filename: file.name, segments, isLowTextConfidence },
        });

        if (error || !data) {
          toast.error(data?.error || "Kunne ikke analysere CV — fyll inn manuelt");
          return;
        }

        const currentCv = originalCvData || EMPTY_CV;
        const preservedContact = currentCv.hero.contact || getDefaultContact("nb");
        const preservedPortraitUrl = currentCv.hero.portrait_url;
        const preservedPortraitPosition = currentCv.hero.portrait_position || "50% 50%";

        const newCvData: CVDocument = {
          hero: {
            name: data.navn || "",
            title: data.tittel || "",
            contact: preservedContact,
            portrait_url: preservedPortraitUrl,
            portrait_position: preservedPortraitPosition,
          },
          introParagraphs: Array.isArray(data.introParagraphs) ? data.introParagraphs : [],
          competenceGroups: Array.isArray(data.competenceGroups) ? data.competenceGroups : [],
          projectsTitle: currentCv.projectsTitle || "",
          projects: Array.isArray(data.projects) ? data.projects : [],
          education: Array.isArray(data.education) ? data.education : [],
          workExperience: Array.isArray(data.workExperience) ? data.workExperience : [],
          sidebarSections: Array.isArray(data.sidebarSections) ? data.sidebarSections : [],
          additionalSections: Array.isArray(data.additionalSections) ? data.additionalSections : [],
        };

        if (!hasCvDocumentContent(newCvData)) {
          toast.error("Kunne ikke hente ut nok tekst fra CV-en — fyll inn manuelt");
          return;
        }

        setOriginalCvData(newCvData);

        if (cvId) {
          if (hasCvDocumentContent(currentCv)) {
            const backupSavedAt = new Date().toISOString();
            const backupSnapshot = { ...cvDocumentToSnapshot(currentCv), updated_at: backupSavedAt } as Json;
            const { error: backupError } = await supabase.from("cv_versions").insert({
              cv_id: cvId,
              variant_id: null,
              snapshot: backupSnapshot,
              saved_by: user?.email || "crm",
              source: "admin",
              created_at: backupSavedAt,
            });

            if (backupError) {
              toast.error("Kunne ikke lagre sikkerhetskopi av nåværende CV");
              return;
            }
          }

          const savedAt = new Date().toISOString();
          const snapshot = { ...cvDocumentToSnapshot(newCvData), updated_at: savedAt };
          const jsonSnapshot = snapshot as Json;
          const { error: saveError } = await supabase
            .from("cv_documents")
            .update(jsonSnapshot)
            .eq("id", cvId);

          if (saveError) {
            toast.error("Kunne ikke lagre CV-data til databasen");
            return;
          }

          const { error: versionError } = await supabase.from("cv_versions").insert({
            cv_id: cvId,
            variant_id: null,
            snapshot: jsonSnapshot,
            saved_by: user?.email || "crm",
            source: "admin",
            created_at: savedAt,
          });

          if (versionError) {
            toast.error("Kunne ikke lagre versjonshistorikk");
            return;
          }

          setOriginalUpdatedAt(savedAt);
          setLastAdminUpdatedAt(savedAt);
          await runCompetenceSync();
        }

        if (data.requiresReview || data.warnings?.length) {
          toast.success("CV importert — kontroller tekst og ekstra seksjoner før du går videre");

          if (Array.isArray(data.warnings) && data.warnings.length > 0) {
            toast.info(data.warnings.slice(0, 2).join(" "));
          }
        } else {
          toast.success("CV importert — teksten er lagt inn i editoren");
        }
      } catch {
        toast.error("Kunne ikke analysere CV — fyll inn manuelt");
      } finally {
        setCvUploadParsing(false);
      }
    },
    [activeIsRootVariant, cvId, originalCvData, runCompetenceSync, user?.email],
  );

  const handleSelectVariant = useCallback(
    async (variant: CvVariantIdentity) => {
      try {
        await activateVariant(variant);
      } catch (error) {
        const message = getErrorMessage(error);
        toast.error(`Kunne ikke åpne ${getVariantDisplayLabel(variant).toLocaleLowerCase("nb-NO")}: ${message}`);
      }
    },
    [activateVariant],
  );

  const handleRegenerateActiveVariant = useCallback(async () => {
    if (activeIsRootVariant) return;

    try {
      await activateVariant(activeVariant, { force: true });
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(`Kunne ikke oppdatere ${getVariantDisplayLabel(activeVariant).toLocaleLowerCase("nb-NO")}: ${message}`);
    }
  }, [activeIsRootVariant, activateVariant, activeVariant]);

  const statusLines = useMemo(() => {
    if (!activeIsRootVariant) {
      const sourceVariant = getCvVariantSource(activeVariant);
      const sourceLabel = sourceVariant ? getVariantDisplayLabel(sourceVariant) : "kilden";
      const activeVariantIsStale = isVariantStale(activeVariant);

      return [
        `Sist oppdatert (${getVariantDisplayLabel(activeVariant)}): ${formatUpdatedAt(activeLoadedVariant?.updatedAt)}`,
        `Basert på ${sourceLabel}: ${formatUpdatedAt(activeLoadedVariant?.sourceOriginalUpdatedAt)}`,
        activeVariantIsStale ? `${sourceLabel} er oppdatert senere — regenerer ved behov.` : null,
      ].filter(Boolean) as string[];
    }

    return [
      `Sist oppdatert (admin): ${formatUpdatedAt(lastAdminUpdatedAt)}`,
      `Sist oppdatert (ansatt): ${formatUpdatedAt(lastAnsattUpdatedAt)}`,
      ...staleDerivedVariants.map((variant) => `${getVariantDisplayLabel(variant)} er eldre enn kilden.`),
    ].filter(Boolean) as string[];
  }, [
    activeIsRootVariant,
    activeLoadedVariant?.sourceOriginalUpdatedAt,
    activeLoadedVariant?.updatedAt,
    activeVariant,
    isVariantStale,
    lastAdminUpdatedAt,
    lastAnsattUpdatedAt,
    staleDerivedVariants,
  ]);

  const activeVariantBusyMode = variantBusy?.key === activeVariantKey ? variantBusy.mode : null;

  const isVariantBusy = useCallback(
    (variant: CvVariantIdentity, mode?: VariantBusyMode) => {
      const busyKey = getCvVariantStorageKey(variant);
      if (variantBusy?.key !== busyKey) return false;
      return mode ? variantBusy.mode === mode : true;
    },
    [variantBusy],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Laster...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!activeCvData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Laster CV...</p>
      </div>
    );
  }

  return (
    <>
      <div className={fullscreen ? "fixed inset-0 z-50 bg-background flex flex-col" : "h-screen flex flex-col"}>
        <CvEditorPanel
          cvData={activeCvData}
          onSave={handleSave}
          savedBy={user.email || "crm"}
          imageUrl={activePreviewImageUrl}
          anonymizedMode={activeVariant.isAnonymized}
          languageCode={activeVariant.languageCode}
          onDownloadPdf={handleDownloadPdf}
          renderToolbar={({ saveStatus, onDownload }) => (
            <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 text-[0.8125rem] flex-wrap">
                  <button
                    onClick={() => navigate("/konsulenter/ansatte")}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Tilbake
                  </button>
                  <span className="text-foreground font-medium">
                    {ansattName ? `${ansattName} — ${getVariantHeading(activeVariant)}` : getVariantHeading(activeVariant)}
                  </span>
                  <div className="inline-flex items-center rounded-lg border border-border bg-card p-1">
                    <Button
                      size="sm"
                      variant={activeVariant.languageCode === "nb" ? "secondary" : "ghost"}
                      className="h-7 px-2.5 text-[0.75rem]"
                      onClick={() => void handleSelectVariant({ languageCode: "nb", isAnonymized: activeVariant.isAnonymized })}
                      disabled={Boolean(variantBusy)}
                    >
                      Norsk
                    </Button>
                    <Button
                      size="sm"
                      variant={activeVariant.languageCode === "en" ? "secondary" : "ghost"}
                      className="h-7 px-2.5 text-[0.75rem]"
                      onClick={() => void handleSelectVariant({ languageCode: "en", isAnonymized: activeVariant.isAnonymized })}
                      disabled={Boolean(variantBusy)}
                    >
                      {isVariantBusy({ languageCode: "en", isAnonymized: activeVariant.isAnonymized }) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "English"
                      )}
                    </Button>
                  </div>
                  <div className="inline-flex items-center rounded-lg border border-border bg-card p-1">
                    <Button
                      size="sm"
                      variant={!activeVariant.isAnonymized ? "secondary" : "ghost"}
                      className="h-7 px-2.5 text-[0.75rem]"
                      onClick={() =>
                        void handleSelectVariant({ languageCode: activeVariant.languageCode, isAnonymized: false })
                      }
                      disabled={Boolean(variantBusy)}
                    >
                      Original
                    </Button>
                    <Button
                      size="sm"
                      variant={activeVariant.isAnonymized ? "secondary" : "ghost"}
                      className="h-7 px-2.5 text-[0.75rem]"
                      onClick={() =>
                        void handleSelectVariant({ languageCode: activeVariant.languageCode, isAnonymized: true })
                      }
                      disabled={Boolean(variantBusy)}
                    >
                      {isVariantBusy({ languageCode: activeVariant.languageCode, isAnonymized: true }) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Anonymisert"
                      )}
                    </Button>
                  </div>
                  {saveStatus === "saving" && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Lagrer...
                    </span>
                  )}
                  {saveStatus === "saved" && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Check className="h-3.5 w-3.5" />
                      Lagret
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.6875rem] text-muted-foreground">
                  {statusLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="border border-border h-9 w-9"
                        onClick={() => setFullscreen((prev) => !prev)}
                      >
                        {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{fullscreen ? "Avslutt fullskjerm" : "Fullskjerm"}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button size="sm" variant="ghost" onClick={loadVersions}>
                  <History className="h-3.5 w-3.5 mr-1" />
                  Versjonshistorikk
                </Button>
                {!activeIsRootVariant && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="border border-border"
                    onClick={() => void handleRegenerateActiveVariant()}
                    disabled={activeVariantBusyMode === "regenerating"}
                  >
                    {activeVariantBusyMode === "regenerating" ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    )}
                    {getVariantRegenerateButtonLabel(activeVariant)}
                  </Button>
                )}
                <button
                  onClick={handleShareLink}
                  className="inline-flex items-center gap-1.5 h-9 px-3 text-[0.8125rem] font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Del link med ansatt
                </button>
                {cvUploadParsing ? (
                  <span className="flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analyserer CV med AI...
                  </span>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="border border-border"
                        disabled={!activeIsRootVariant}
                        onClick={() => cvUploadRef.current?.click()}
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                        Importer CV
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {!activeIsRootVariant
                        ? "Importer CV på norsk original først, så regenereres anonymisert og engelsk fra den."
                        : "Last opp eksisterende CV — teksten importeres inn i editoren"}
                    </TooltipContent>
                  </Tooltip>
                )}
                <input ref={cvUploadRef} type="file" accept=".pdf" className="hidden" onChange={handleCvUpload} />
                <Button size="sm" onClick={onDownload}>
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Last ned PDF
                </Button>
              </div>
            </div>
          )}
        />
      </div>

      <Sheet open={versionsOpen} onOpenChange={setVersionsOpen}>
        <SheetContent side="right" className="w-full sm:w-[400px] max-w-[400px]">
          <h3 className="text-lg font-bold mb-4">Versjonshistorikk</h3>
          <div className="space-y-3 overflow-y-auto">
            {versions.length === 0 && <p className="text-sm text-muted-foreground">Ingen versjoner lagret ennå.</p>}
            {versions.map((version) => (
              <div key={version.id} className="border border-border rounded-lg p-3 bg-card">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {format(new Date(version.created_at), "dd.MM.yyyy HH:mm", { locale: nb })}
                    </p>
                    <p className="text-xs text-muted-foreground">Lagret av: {version.saved_by || "ukjent"}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => restoreVersion(version.snapshot)}>
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Gjenopprett
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
