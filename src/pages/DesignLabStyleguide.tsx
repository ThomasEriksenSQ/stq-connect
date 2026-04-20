import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { usePersistentState } from "@/hooks/usePersistentState";
import { DesignLabSidebar } from "@/components/designlab/DesignLabSidebar";
import { getDesignLabTextSizeStyle, type TextSize } from "@/components/designlab/TextSizeControl";
import { C } from "@/components/designlab/theme";
import { DesignLabSearchInput, DesignLabStaticTag } from "@/components/designlab/controls";
import {
  DesignLabCategoryBadge,
  DesignLabChipGroup,
  DesignLabFieldLabel,
  DesignLabFilterRow,
  DesignLabGhostAction,
  DesignLabInlineTextAction,
  DesignLabMediaFrame,
  DesignLabModalActions,
  DesignLabModalChipGroup,
  DesignLabModalContent,
  DesignLabModalField,
  DesignLabModalFieldGrid,
  DesignLabModalForm,
  DesignLabModalInput,
  DesignLabModalLabel,
  DesignLabModalPreviewSurface,
  DesignLabPrimaryAction,
  DesignLabReadonlyChip,
  DesignLabSecondaryAction,
  DesignLabSectionHeader,
  DesignLabSignalBadge,
  DesignLabStatusBadge,
  DesignLabTextField,
  DesignLabToggleChip,
} from "@/components/designlab/system";

const SIGNAL_BADGE_LABELS = [
  "Behov nå",
  "Får fremtidig behov",
  "Får kanskje behov",
  "Ukjent om behov",
  "Ikke aktuelt",
] as const;

function ExampleCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-[10px] border p-5"
      style={{ borderColor: C.borderLight, background: C.panel, boxShadow: "0 8px 24px rgba(0,0,0,0.04)" }}
    >
      <h2 style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14 }}>{title}</h2>
      {children}
    </section>
  );
}

export default function DesignLabStyleguide() {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [textSize] = usePersistentState<TextSize>("dl-text-size", "M");
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState("Kunde");
  const [activeOwner, setActiveOwner] = useState("Thomas Eriksen");
  const [modalName, setModalName] = useState("");
  const [modalLastName, setModalLastName] = useState("");
  const [modalEmail, setModalEmail] = useState("");
  const [modalPhone, setModalPhone] = useState("");
  const [modalLocation, setModalLocation] = useState("Oslo");
  const [modalCv, setModalCv] = useState(true);
  const [modalCallList, setModalCallList] = useState(false);

  return (
    <div
      className="flex h-screen overflow-hidden select-none"
      style={{ fontFamily: "'Inter', -apple-system, system-ui, sans-serif", background: C.bg }}
    >
      <DesignLabSidebar navigate={navigate} signOut={signOut} user={user} activePath="/design-lab/stilark" />

      <main className="flex-1 min-w-0 overflow-y-auto" style={{ ...getDesignLabTextSizeStyle(textSize), background: C.appBg }}>
        <header
          className="flex items-center justify-between px-6"
          style={{ height: 40, borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex items-baseline gap-2.5">
            <h1 style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Stilark</h1>
            <span style={{ fontSize: 13, color: C.textGhost, fontWeight: 500 }}>· V2 system</span>
          </div>
          <div className="flex items-center gap-2">
            <DesignLabSearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Søk komponenter…"
              style={{ width: 220 }}
            />
          </div>
        </header>

        <div className="mx-auto max-w-[1180px] space-y-6 px-6 py-6">
          <ExampleCard title="Knapper">
            <div className="flex flex-wrap items-center gap-3">
              <DesignLabPrimaryAction>
                <Plus className="h-3.5 w-3.5" />
                Ny kontakt
              </DesignLabPrimaryAction>
              <DesignLabSecondaryAction>Lagre senere</DesignLabSecondaryAction>
              <DesignLabGhostAction>Avbryt</DesignLabGhostAction>
              <DesignLabInlineTextAction>Legg til sted</DesignLabInlineTextAction>
            </div>
          </ExampleCard>

          <ExampleCard title="Chips og badges">
            <div className="space-y-4">
              <DesignLabChipGroup>
                {["Potensiell kunde", "Kunde", "Partner", "Ikke relevant selskap"].map((option) => (
                  <DesignLabToggleChip
                    key={option}
                    type="button"
                    active={activeType === option}
                    onClick={() => setActiveType(option)}
                  >
                    {option}
                  </DesignLabToggleChip>
                ))}
              </DesignLabChipGroup>
              <DesignLabChipGroup>
                {["Jon Richard Nygaard", "Thomas Eriksen"].map((owner) => (
                  <DesignLabToggleChip
                    key={owner}
                    type="button"
                    active={activeOwner === owner}
                    onClick={() => setActiveOwner(owner)}
                  >
                    {owner}
                  </DesignLabToggleChip>
                ))}
              </DesignLabChipGroup>
              <DesignLabChipGroup>
                <DesignLabReadonlyChip active={true}>CV-Epost</DesignLabReadonlyChip>
                <DesignLabReadonlyChip active={false}>Innkjøper</DesignLabReadonlyChip>
                <DesignLabStaticTag>Kunde</DesignLabStaticTag>
                <DesignLabStatusBadge tone="signal">Thomas Eriksen</DesignLabStatusBadge>
              </DesignLabChipGroup>
              <div className="space-y-2">
                <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>Kategori-badges</p>
                <DesignLabChipGroup>
                  {SIGNAL_BADGE_LABELS.map((label) => (
                    <DesignLabCategoryBadge key={`category-${label}`} label={label} />
                  ))}
                </DesignLabChipGroup>
              </div>
              <div className="space-y-2">
                <p style={{ fontSize: 12, fontWeight: 500, color: C.textMuted }}>Signal-badges</p>
                <DesignLabChipGroup>
                  {SIGNAL_BADGE_LABELS.map((label) => (
                    <DesignLabSignalBadge key={`signal-${label}`} signal={label} />
                  ))}
                </DesignLabChipGroup>
              </div>
            </div>
          </ExampleCard>

          <ExampleCard title="Felter">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="space-y-1">
                  <DesignLabFieldLabel>Søkefelt</DesignLabFieldLabel>
                  <DesignLabSearchInput
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Søk kontakter…"
                  />
                </div>
                <div className="space-y-1">
                  <DesignLabFieldLabel>Tekstfelt</DesignLabFieldLabel>
                  <DesignLabTextField placeholder="By eller sted" value={modalLocation} onChange={(event) => setModalLocation(event.target.value)} />
                </div>
              </div>
              <div className="space-y-3">
                <DesignLabFilterRow
                  label="TYPE"
                  options={["Alle", "Kunde", "Partner", "Innkjøper"]}
                  value={activeType}
                  onChange={(value) => setActiveType(value)}
                />
              </div>
            </div>
          </ExampleCard>

          <ExampleCard title="Modalmønster">
            <DesignLabModalPreviewSurface title="Ny kontakt">
              <DesignLabModalForm onSubmit={(event) => event.preventDefault()}>
                <DesignLabModalFieldGrid>
                  <DesignLabModalField>
                    <DesignLabModalLabel>Fornavn</DesignLabModalLabel>
                    <DesignLabModalInput value={modalName} onChange={(event) => setModalName(event.target.value)} />
                  </DesignLabModalField>
                  <DesignLabModalField>
                    <DesignLabModalLabel>Etternavn</DesignLabModalLabel>
                    <DesignLabModalInput value={modalLastName} onChange={(event) => setModalLastName(event.target.value)} />
                  </DesignLabModalField>
                </DesignLabModalFieldGrid>
                <DesignLabModalFieldGrid>
                  <DesignLabModalField>
                    <DesignLabModalLabel>E-post</DesignLabModalLabel>
                    <DesignLabModalInput value={modalEmail} onChange={(event) => setModalEmail(event.target.value)} />
                  </DesignLabModalField>
                  <DesignLabModalField>
                    <DesignLabModalLabel>Telefon</DesignLabModalLabel>
                    <DesignLabModalInput value={modalPhone} onChange={(event) => setModalPhone(event.target.value)} />
                  </DesignLabModalField>
                </DesignLabModalFieldGrid>
                <DesignLabModalField>
                  <DesignLabModalLabel>Geografisk sted</DesignLabModalLabel>
                  <DesignLabModalChipGroup>
                    {["Oslo", "Bergen", "Trondheim"].map((location) => (
                      <DesignLabToggleChip
                        key={location}
                        type="button"
                        active={modalLocation === location}
                        onClick={() => setModalLocation(location)}
                      >
                        {location}
                      </DesignLabToggleChip>
                    ))}
                  </DesignLabModalChipGroup>
                </DesignLabModalField>
                <DesignLabModalField>
                  <DesignLabModalLabel>Egenskaper</DesignLabModalLabel>
                  <DesignLabModalChipGroup>
                    <DesignLabToggleChip type="button" active={modalCv} onClick={() => setModalCv((value) => !value)}>
                      CV-Epost
                    </DesignLabToggleChip>
                    <DesignLabToggleChip type="button" active={modalCallList} onClick={() => setModalCallList((value) => !value)}>
                      Innkjøper
                    </DesignLabToggleChip>
                  </DesignLabModalChipGroup>
                </DesignLabModalField>
                <DesignLabModalActions>
                  <DesignLabPrimaryAction type="submit">Opprett</DesignLabPrimaryAction>
                  <DesignLabGhostAction type="button">Avbryt</DesignLabGhostAction>
                </DesignLabModalActions>
              </DesignLabModalForm>
            </DesignLabModalPreviewSurface>
          </ExampleCard>

          <ExampleCard title="Seksjonsheader">
            <div className="space-y-6">
              <DesignLabSectionHeader title="Mer fra porteføljen" meta="6 saker" />
              <DesignLabSectionHeader
                title="Korte notiser"
                meta="5 saker"
                right={<DesignLabInlineTextAction>Se alt</DesignLabInlineTextAction>}
              />
            </div>
          </ExampleCard>

          <ExampleCard title="Mediaramme">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: C.textMuted, marginBottom: 8 }}>16:9</p>
                <DesignLabMediaFrame ratio="16:9" fallback="Bilde mangler" />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: C.textMuted, marginBottom: 8 }}>4:3</p>
                <DesignLabMediaFrame ratio="4:3" fallback="Bilde mangler" />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 500, color: C.textMuted, marginBottom: 8 }}>1:1</p>
                <DesignLabMediaFrame ratio="1:1" fallback="Bilde mangler" />
              </div>
            </div>
          </ExampleCard>
        </div>
      </main>
    </div>
  );
}
