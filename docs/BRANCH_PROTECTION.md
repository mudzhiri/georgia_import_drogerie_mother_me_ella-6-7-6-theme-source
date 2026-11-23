# Branch-Schutz — gewünschte Konfiguration

Stand der Ermittlung: private Repo, Konto ohne GitHub Pro → API für Branch Protection / Rulesets liefert **403**.  
Schutzregeln können erst nach Upgrade (oder öffentlichem Repo) aktiviert werden. Bis dahin: Disziplin über PRs + CI.

## Ziel für `dev`, `test`, `prod`

Solo-Arbeit: **keine** Pflicht für einen zweiten Reviewer.

| Einstellung | Wert |
| --- | --- |
| Require a pull request before merging | An |
| Required approving reviews | **0** (nicht blockierend) |
| Require status checks to pass | An |
| Required checks | `Theme Check`, `Validate theme JSON` (Job-Namen aus `pr-checks.yml`) |
| Require branches to be up to date | Empfohlen An, wenn praktikabel |
| Allow force pushes | Aus |
| Allow deletions | Aus |
| Restrict who can push | Optional; `shopify[bot]` muss für Theme-Sync weiter pushen dürfen, wo die Shopify-Verbindung greift |

## Shopify-Rücksynchronisierung

`shopify[bot]` pusht Theme-Editor-/CLI-Änderungen (aktuell sichtbar auf `dev`).  
**Nicht** empfehlen: Schutz global abschalten.  
Stattdessen:

- Sync-Branch bleibt `dev` (Arbeits-/Integrations-Theme)
- `test` / `prod` nur per PR aus dem abgenommenen Stand
- Bei Konflikten mit Bot-Commits: Diff prüfen, Settings bewusst mergen

## Default-Branch

Repository-Default wurde auf **`dev`** gesetzt (vorher `prod`), passend zum Integrationsfluss.

## Nach Pro-Upgrade (Checkliste)

1. Settings → Branches → Add rule (oder Rulesets) für `dev`, `test`, `prod`
2. Required status checks aus dem zuletzt grünen PR auswählen (exakte Check-Namen)
3. Force-push und Löschen verbieten
4. Einen Test-PR öffnen und prüfen, dass Merge ohne grüne Checks blockiert ist
5. Shopify-Theme-Verbindung kurz testen (kleine Editor-Änderung → Bot-Commit auf `dev`)
