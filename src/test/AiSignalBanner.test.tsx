import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AiSignalBanner } from "@/components/AiSignalBanner";
import { analyzeSignal } from "@/lib/aiSignal";

vi.mock("@/lib/aiSignal", async () => {
  const actual = await vi.importActual<typeof import("@/lib/aiSignal")>("@/lib/aiSignal");
  return {
    ...actual,
    analyzeSignal: vi.fn(),
  };
});

const analyzeSignalMock = vi.mocked(analyzeSignal);

describe("AiSignalBanner", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    analyzeSignalMock.mockReset();
  });

  it("keeps hook order stable while async analysis result arrives", async () => {
    analyzeSignalMock.mockResolvedValue({
      anbefalt_signal: "Behov nå",
      begrunnelse: "Nylig aktivitet viser konkret behov.",
      konfidens: "høy",
      teknologier_funnet: ["React"],
      tidsramme: "Nå",
    });

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AiSignalBanner
          contactId="contact-1"
          contactName="Jean-Noel Georges"
          contactEmail={null}
          currentSignal="Ukjent om behov"
          currentTechnologies={[]}
          activities={[
            {
              type: "meeting",
              subject: "Demo og oppfølging",
              created_at: "2026-04-18T10:30:00.000Z",
            },
          ]}
          lastTaskDueDate={null}
          onUpdateSignal={() => {}}
          onAddTechnologies={() => {}}
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("AI foreslår:")).toBeInTheDocument();
    });
  });
});
