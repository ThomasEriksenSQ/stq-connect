

# Plan: Korriger bakgrunnsfarger til Linears faktiske verdier

## Problemet

Vår sidebar (`#ecedf0`) er for mørk — den stikker seg ut som en tung grå flate. Linear bruker en mye mer subtil off-white på sidebaren. Hovedflaten (`#f7f8f8`) er også for grå — Linears innholdsområde er tilnærmet hvit.

## Linears faktiske lag (fra skjermbildene)

```text
Sidebar:        #f4f5f6  (knapt merkbar off-white, IKKE tydelig grå)
Hovedinnhold:   #ffffff  (hvit)
Detaljpanel:    #ffffff  (hvit)
```

Skillet mellom sidebar og innhold skapes primært av **border**, ikke bakgrunnsfarge-kontrast. Sidebaren er bare *litt* mørkere enn hvit.

## Endringer i alle tre filer

### Oppdater `C`-objektet

```text
sidebarBg:  #ecedf0 → #f4f5f6  (subtil off-white, som Linear)
bg:         #f7f8f8 → #ffffff  (hvit hovedflate, som Linear)
```

### Filer

1. `src/pages/DesignLabContacts.tsx` — C.sidebarBg og C.bg
2. `src/pages/DesignLabForesporsler.tsx` — C.sidebarBg og C.bg
3. `src/pages/DesignLabStacqPrisen.tsx` — C.sidebarBg og C.bg

Ingen andre endringer. Resultatet: sidebar som knapt skiller seg fra hvit (som Linear), med border som primær separator.

