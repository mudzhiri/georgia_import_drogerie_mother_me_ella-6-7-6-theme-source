# Entwicklungs- und Prüfungsablauf (MOTHER & ME Theme)

Repo: `mudzhiri/georgia_import_drogerie_mother_me_ella-6-7-6-theme-source`  
Theme-Root = Repository-Root (Shopify Online Store 2.0 / Ella).

Vereinbarter Pfad:

`feature/…` oder `fix/…` → **dev** → **test** → **live**

GitHub-Default-Branch: **`live`**.

## Begriffe (nicht vermischen)

| Schritt | Bedeutung |
| --- | --- |
| Git-Push | Code landet auf einem Remote-Branch |
| Merge | Branch wird in `dev` / `test` / `live` übernommen (über PR) |
| Deployment | Theme erscheint im Shopify-Admin (hier: bestehende Shopify↔GitHub-Verbindung bzw. `shopify theme push`) |
| Geprüfte Shopansicht | Du hast die Preview-/Live-URL im Browser tatsächlich angeschaut |

Ein grüner CI-Lauf ersetzt keine Shopansicht bei UI-Änderungen.

## Dauerhafte Branches

- **dev** — Integrationsstand; fertige, geprüfte Arbeit (PR-Merge)
- **test** — fester Abnahmestand
- **live** — freigegebener Liveshop-Stand (GitHub default)
- **prod** — Legacy-Alias; bei Releases mit `live` mitziehen, nicht als Default nutzen

Shopify kann über die Theme-GitHub-Anbindung Commits (`shopify[bot]`) auf den verbundenen Branch schreiben. Vor Merges diese Sync-Commits prüfen; Einstellungen (`config/settings_data.json` u. Ä.) nicht pauschal überschreiben.

## Commit-Messages

Jeder Commit beschreibt **detailliert**:

1. **Problem / Aufgabe** — warum
2. **Seite / Section / Snippet** — z. B. `/cart`, `main-cart`, `halo-side-cart`, Homepage `mm-hero`
3. **Veränderung** — was genau geändert wurde (Verhalten, Copy, Layout)

Kurzformen wie `fix cart` oder `update styles` sind nicht erlaubt. Prefix weiterhin `feat:` / `fix:` / `refactor:`.

## Beispiel: „Marken- und Altersfilter hinzufügen“

1. `git fetch origin && git checkout -b feature/product-filters origin/dev`
2. Nur Filter-relevante Dateien ändern; Commits wie oben (Seite/Section + konkrete Änderung)
3. Lokal Diff prüfen; bei UI Desktop + Mobile-Emulation der Collection-Seite
4. `git push -u origin HEAD`
5. Pull Request **nach `dev`** (Vorlage ausfüllen — nur echte Tests ankreuzen)
6. CI abwarten: **Theme Check** + **Validate theme JSON**
7. Nach Review/Selbstabnahme: Merge nach `dev` (Squash ok)
8. Abnahme: PR oder Merge **`dev` → `test`** für den konkreten Stand; Preview des Test-Themes prüfen
9. Freigabe: denselben abgenommenen Stand **`test` → `live`** (und `prod` spiegeln, falls noch genutzt); kein paralleles Nachziehen neuer `dev`-Arbeit ohne erneute Prüfung

Während `test` abgenommen wird, darf `dev` weiterlaufen — nur der abgenommene Stand geht nach `live`.

## Beispiel: dringender Hotfix

1. `git fetch origin && git checkout -b hotfix/cart-button origin/live`
2. Nur den Livefehler beheben; committen und PR **nach `live`** (oder nach vereinbartem Hotfix-Pfad)
3. CI + gezielte Shopansicht
4. Nach Live-Fix: denselben Commit/Stand nach **`dev`** zurückführen (PR), damit `dev` nicht zurückfällt
5. Läuft gerade eine Abnahme auf `test`, Hotfix dort bewusst nachziehen oder Abnahme neu ansetzen

## CI (GitHub Actions)

Workflow: `.github/workflows/pr-checks.yml`  
Läuft bei PRs auf `dev`, `test`, `live`, `prod`:

1. **Theme Check** (`shopify/theme-check-action@v2`, Shopify CLI Theme `3.92.1`, `--fail-level error`, Config `.theme-check.yml`)
2. **Validate theme JSON** (Locales/Templates/Config — Shopify-Kommentarheader in Locales werden toleriert)

Keine Admin-Secrets. Kein automatisches Publish in diesem Workflow.

Lokaler Agent: volle Theme-Check-Läufe nur gezielt (siehe Workspace-Regel no-hang); CI bleibt die systematische Prüfung.

## Branch-Schutz (manuell, GitHub Pro nötig)

Private Repos brauchen für Rulesets/Branch Protection **GitHub Pro**. Konkrete Vorschläge: `docs/BRANCH_PROTECTION.md`.

## Pakete / Build

Dieses Theme hat **kein** `package.json` / Lockfile. Es gibt keinen separaten JS-/CSS-Build. Prüfungen = Theme Check + JSON-Validierung. Keine zweite Deployment-Pipeline neben der bestehenden Shopify-Anbindung.
