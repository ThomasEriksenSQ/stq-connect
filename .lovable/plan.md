

## Endring: Vis kunde under kandidatnavn

Flytte kundenavnet fra samme linje som kandidaten til en egen linje under, slik at layouten blir:

```
● Anders Nilsen                    Om X dager
  Autostore                        d. MMM yyyy
```

### Teknisk
I `FornyelsesVarsel.tsx` linje 65-68: Splitt kandidat og kunde i to separate `<p>`-elementer i info-diven, der kunde vises under som `text-[0.8125rem] text-muted-foreground`.

