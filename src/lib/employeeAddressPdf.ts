import type { Database } from "@/integrations/supabase/types";
import { deriveEmployeeAddressFields } from "@/lib/geographicMatch";

type EmployeeAddressRow = Pick<
  Database["public"]["Tables"]["stacq_ansatte"]["Row"],
  "navn" | "adresse" | "postnummer" | "poststed" | "geografi" | "epost" | "tlf"
>;

export interface EmployeeAddressExportEntry {
  name: string;
  streetAddress: string;
  postalLine: string;
  email: string;
  phone: string;
}

function normalizeField(value?: string | null, fallback?: string) {
  const trimmed = String(value || "").trim();
  return trimmed || fallback || "";
}

function formatPostalLine(postalCode?: string | null, city?: string | null) {
  const trimmedPostalCode = String(postalCode || "").trim();
  const trimmedCity = String(city || "").trim();
  if (trimmedPostalCode && trimmedCity) return `${trimmedPostalCode}, ${trimmedCity}`;
  return trimmedPostalCode || trimmedCity || "Postnummer/sted mangler";
}

function formatPhoneNumber(value?: string | null) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "Telefon mangler";

  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (digits.length === 8) return `+47 ${digits}`;

  return trimmed;
}

export function buildEmployeeAddressExportEntry(employee: EmployeeAddressRow): EmployeeAddressExportEntry {
  const addressFields = deriveEmployeeAddressFields(employee);

  return {
    name: normalizeField(employee.navn, "Ukjent ansatt"),
    streetAddress: addressFields.address || "Adresse mangler",
    postalLine: formatPostalLine(addressFields.postalCode, addressFields.city),
    email: normalizeField(employee.epost, "E-post mangler"),
    phone: formatPhoneNumber(employee.tlf),
  };
}

export async function downloadEmployeeAddressPdf(
  employees: EmployeeAddressRow[],
  options?: { fileName?: string },
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ format: "a4", unit: "pt" });

  const marginX = 48;
  const topMargin = 56;
  const bottomMargin = 48;
  const lineHeight = 14;
  const sectionGap = 18;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxTextWidth = pageWidth - marginX * 2;
  const columnGap = 24;
  const leftColumnWidth = 300;
  const rightColumnWidth = maxTextWidth - leftColumnWidth - columnGap;
  const rightColumnX = marginX + leftColumnWidth + columnGap;
  const exportedAt = new Date().toLocaleDateString("nb-NO");
  const fileName = options?.fileName || `adresseliste-ansatte-${new Date().toISOString().slice(0, 10)}.pdf`;

  const entries = employees
    .map((employee) => buildEmployeeAddressExportEntry(employee))
    .sort((a, b) => a.name.localeCompare(b.name, "nb-NO"));

  let y = topMargin;

  const drawHeader = () => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("Adresseliste ansatte", marginX, topMargin);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(90, 90, 90);
    pdf.text(`${entries.length} ansatte · Generert ${exportedAt}`, marginX, topMargin + 18);
    pdf.setTextColor(20, 20, 20);

    y = topMargin + 42;
  };

  const ensureSpace = (requiredHeight: number) => {
    if (y + requiredHeight <= pageHeight - bottomMargin) return;
    pdf.addPage();
    drawHeader();
  };

  const writeWrappedText = (text: string, fontStyle: "normal" | "bold", fontSize: number) => {
    pdf.setFont("helvetica", fontStyle);
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text, maxTextWidth) as string[];
    lines.forEach((line) => {
      pdf.text(line, marginX, y);
      y += lineHeight;
    });
    return lines.length;
  };

  drawHeader();

  entries.forEach((entry) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    const nameLines = pdf.splitTextToSize(entry.name, maxTextWidth) as string[];
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    const streetLines = pdf.splitTextToSize(entry.streetAddress, leftColumnWidth) as string[];
    const postalLines = pdf.splitTextToSize(entry.postalLine, leftColumnWidth) as string[];
    const phoneLines = pdf.splitTextToSize(entry.phone, rightColumnWidth) as string[];
    const emailLines = pdf.splitTextToSize(entry.email, rightColumnWidth) as string[];
    const requiredHeight =
      (nameLines.length + Math.max(streetLines.length, phoneLines.length) + Math.max(postalLines.length, emailLines.length)) * lineHeight +
      sectionGap;

    ensureSpace(requiredHeight);
    writeWrappedText(entry.name, "bold", 12);

    const rowOneY = y;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    streetLines.forEach((line, index) => {
      pdf.text(line, marginX, rowOneY + index * lineHeight);
    });
    phoneLines.forEach((line, index) => {
      pdf.text(line, rightColumnX, rowOneY + index * lineHeight);
    });
    y = rowOneY + Math.max(streetLines.length, phoneLines.length) * lineHeight;

    const rowTwoY = y;
    postalLines.forEach((line, index) => {
      pdf.text(line, marginX, rowTwoY + index * lineHeight);
    });
    emailLines.forEach((line, index) => {
      pdf.text(line, rightColumnX, rowTwoY + index * lineHeight);
    });
    y = rowTwoY + Math.max(postalLines.length, emailLines.length) * lineHeight;

    y += sectionGap;
  });

  pdf.save(fileName);
}
