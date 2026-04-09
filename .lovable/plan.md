

## Plan: Fjern gjennomstrek fra "Tidligere prosesser"

### Endring i `src/pages/AnsattDetail.tsx`

Fjern alle `line-through`-betingelser på linje 446, 447 og 449. Bortfalt-rader beholder sin grå farge og badge-stil, men uten gjennomstreking.

**Linje 446**: Fjern `&& "line-through text-muted-foreground"` — behold kun base-klasser.

**Linje 447**: Fjern `&& "line-through"`.

**Linje 449**: Fjern `&& "line-through"` fra Badge.

