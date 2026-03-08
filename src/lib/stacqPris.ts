export function calcStacqPris(row: {
  utpris: number;
  til_konsulent: number | null;
  til_konsulent_override: number | null;
  er_ansatt: boolean;
  ekstra_kostnad: number | null;
}): number {
  const base =
    row.til_konsulent_override != null
      ? row.utpris - row.til_konsulent_override
      : row.er_ansatt
        ? row.utpris * 0.3
        : row.utpris - (row.til_konsulent ?? 0);
  return base - (row.ekstra_kostnad ?? 0);
}
