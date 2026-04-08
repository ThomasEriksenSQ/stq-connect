export const CV_SHARE_VALID_DAYS = 90;

type FunctionClient = {
  functions: {
    invoke: (
      functionName: string,
      options?: { body?: unknown },
    ) => Promise<{
      data: unknown;
      error:
        | {
            context?: {
              json?: () => Promise<unknown>;
              text?: () => Promise<string>;
            };
            message?: string;
          }
        | null;
    }>;
  };
};

export type CvAccessSession = {
  ansatt_id: number;
  ansatt_name: string;
  cv_id: string;
  session_key: string;
  token: string;
};

export type CvAccessIssueResponse = {
  expires_at: string;
  pin: string;
  token: string;
  valid_days: number;
};

export type CvAccessDocumentResponse = {
  document: Record<string, unknown>;
  employee_image_url: string | null;
  session: CvAccessSession;
};

export type CvAccessSaveResponse = {
  updated_at: string;
};

export type CvAccessVersion = {
  created_at: string | null;
  id: string;
  saved_by: string | null;
  snapshot: Record<string, unknown>;
  source: string | null;
};

export type CvAccessVersionsResponse = {
  versions: CvAccessVersion[];
};

export function buildCvShareUrl(token: string, origin = window.location.origin) {
  return new URL(`/cv/${token}`, origin).toString();
}

export function buildCvShareClipboardText(url: string, pin: string) {
  return `${url}\nPIN: ${pin} (${CV_SHARE_VALID_DAYS} dagers varighet)`;
}

export async function copyTextToClipboard(text: string) {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Utklippstavlen er ikke tilgjengelig i denne nettleseren.");
  }

  await navigator.clipboard.writeText(text);
}

async function readFunctionErrorMessage(error?: { context?: { json?: () => Promise<unknown>; text?: () => Promise<string> }; message?: string } | null) {
  const context = error?.context;

  if (context?.json) {
    try {
      const payload = await context.json();
      if (
        payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string" &&
        payload.error.trim()
      ) {
        return payload.error;
      }
    } catch {
      // Ignore JSON parsing failures and fall back to the generic error message.
    }
  }

  if (context?.text) {
    try {
      const text = await context.text();
      if (typeof text === "string" && text.trim()) return text;
    } catch {
      // Ignore response text failures and fall back to the generic error message.
    }
  }

  return error?.message || "Ukjent feil";
}

export async function invokeCvAccess<T>(client: FunctionClient, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.functions.invoke("cv-access", { body });

  if (error) {
    throw new Error(await readFunctionErrorMessage(error));
  }

  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }

  return data as T;
}

export async function issueAndCopyCvShareLink(client: FunctionClient, ansattId: number) {
  const result = await invokeCvAccess<CvAccessIssueResponse>(client, {
    action: "issue",
    ansatt_id: ansattId,
  });

  const url = buildCvShareUrl(result.token);
  const clipboardText = buildCvShareClipboardText(url, result.pin);

  await copyTextToClipboard(clipboardText);

  return {
    ...result,
    clipboardText,
    url,
  };
}
