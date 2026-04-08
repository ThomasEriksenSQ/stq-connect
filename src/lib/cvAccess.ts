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

function getClipboardErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Utklippstavlen er ikke tilgjengelig i denne nettleseren.";
}

function copyTextWithExecCommand(text: string) {
  if (typeof document === "undefined" || !document.body) {
    throw new Error("Utklippstavlen er ikke tilgjengelig i denne nettleseren.");
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const previousRanges =
    selection && selection.rangeCount > 0
      ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
      : [];
  const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  const execCommand = (document as Document & {
    execCommand?: (commandId: string, showUI?: boolean, value?: string) => boolean;
  }).execCommand;

  const copied = execCommand?.call(document, "copy") ?? false;

  document.body.removeChild(textarea);

  selection?.removeAllRanges();
  for (const range of previousRanges) {
    selection?.addRange(range);
  }

  previousActiveElement?.focus();

  if (!copied) {
    throw new Error("Kunne ikke kopiere teksten automatisk.");
  }
}

async function copyTextWithClipboardItem(text: string) {
  if (
    typeof navigator === "undefined" ||
    !navigator.clipboard?.write ||
    typeof ClipboardItem === "undefined" ||
    typeof Blob === "undefined"
  ) {
    throw new Error("ClipboardItem er ikke tilgjengelig.");
  }

  const item = new ClipboardItem({
    "text/plain": new Blob([text], { type: "text/plain" }),
  });

  await navigator.clipboard.write([item]);
}

export async function copyTextToClipboard(text: string) {
  try {
    copyTextWithExecCommand(text);
    return;
  } catch {
    // Fall through to the async clipboard APIs below.
  }

  try {
    await copyTextWithClipboardItem(text);
    return;
  } catch {
    // Fall through to writeText as the broadest async clipboard API.
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      throw new Error(getClipboardErrorMessage(error));
    }
  }

  throw new Error("Utklippstavlen er ikke tilgjengelig i denne nettleseren.");
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
