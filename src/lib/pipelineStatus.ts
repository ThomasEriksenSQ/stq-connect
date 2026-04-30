export const PIPELINE_STATUS_VALUES = ["sendt_cv", "intervju", "vunnet", "avslag", "bortfalt"] as const;

export type PipelineStatus = (typeof PIPELINE_STATUS_VALUES)[number];

export type PipelineStatusMeta = {
  value: PipelineStatus;
  label: string;
  rank: number;
  isOpen: boolean;
  colors: {
    background: string;
    color: string;
    border: string;
    fontWeight: number;
  };
};

export const PIPELINE_STATUS_META: Record<PipelineStatus, PipelineStatusMeta> = {
  sendt_cv: {
    value: "sendt_cv",
    label: "Sendt CV",
    rank: 1,
    isOpen: true,
    colors: { background: "#FBF3E6", color: "#7D4E00", border: "1px solid #E8D0A0", fontWeight: 600 },
  },
  intervju: {
    value: "intervju",
    label: "Intervju",
    rank: 2,
    isOpen: true,
    colors: { background: "#EAF0F9", color: "#1A4FA0", border: "1px solid #B3C8E8", fontWeight: 600 },
  },
  vunnet: {
    value: "vunnet",
    label: "Vunnet",
    rank: 3,
    isOpen: false,
    colors: { background: "#EBF3EE", color: "#2D6A4F", border: "1px solid #C0DEC8", fontWeight: 600 },
  },
  avslag: {
    value: "avslag",
    label: "Avslag",
    rank: 0,
    isOpen: false,
    colors: { background: "#FAEBEC", color: "#8B1D20", border: "1px solid #E8B8BA", fontWeight: 600 },
  },
  bortfalt: {
    value: "bortfalt",
    label: "Bortfalt",
    rank: 0,
    isOpen: false,
    colors: { background: "#F0F2F6", color: "#3A3F4A", border: "1px solid #C8CDD6", fontWeight: 500 },
  },
};

export function isPipelineStatus(value: string | null | undefined): value is PipelineStatus {
  return PIPELINE_STATUS_VALUES.includes(value as PipelineStatus);
}

export function normalizePipelineStatus(value: string | null | undefined): PipelineStatus {
  return isPipelineStatus(value) ? value : "sendt_cv";
}

export function getPipelineStatusMeta(value: string | null | undefined): PipelineStatusMeta {
  return PIPELINE_STATUS_META[normalizePipelineStatus(value)];
}

export function isOpenPipelineStatus(value: string | null | undefined): boolean {
  return getPipelineStatusMeta(value).isOpen;
}
