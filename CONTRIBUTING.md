# Fluxo de trabalho — Site Audit Tool

Como agora **mais de uma pessoa** mexe no projeto, o trabalho é feito em
**branches** e integrado via **Pull Request (PR)**. Ninguém commita direto na
`main`. Assim evitamos conflitos e cada mudança ganha um **preview** próprio na
Vercel antes de ir pra produção.

## Passo a passo

1. **Atualize a main e crie sua branch**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b tipo/descricao-curta
   ```
   Padrão de nome da branch: `tipo/descricao` — ex.: `feat/exportar-pdf`,
   `fix/gauge-mobile`, `chore/atualiza-deps`.
   Tipos: `feat` (novidade), `fix` (correção), `chore` (infra/manutenção),
   `docs`, `refactor`, `style`.

2. **Trabalhe e commite** (mensagens no imperativo, curtas):
   ```bash
   git add -A
   git commit -m "feat: exporta relatório em PDF"
   ```

3. **Suba a branch**
   ```bash
   git push -u origin tipo/descricao-curta
   ```

4. **Abra o Pull Request** no GitHub (a saída do `git push` já mostra o link
   "Create a pull request", ou acesse:
   `https://github.com/W1lliamSilva/Audit-website/pulls` → **New pull request**).
   - Base: `main` · Compare: sua branch.
   - Preencha o template (o que mudou, como testar).

5. **Preview automático da Vercel**: assim que o PR é aberto (ou a branch é
   enviada), a Vercel publica um **deploy de preview** e comenta a URL no PR.
   Teste por ali antes de mesclar.

6. **Revisão + merge**: peça revisão a outra pessoa. Com o preview OK e a
   revisão aprovada, use **Merge** (preferir *Squash and merge* para manter o
   histórico da `main` limpo). Ao mesclar na `main`, a Vercel faz o deploy de
   **produção** automaticamente.

7. **Limpe a branch** depois do merge (o GitHub oferece "Delete branch"), e
   localmente:
   ```bash
   git checkout main && git pull origin main
   git branch -d tipo/descricao-curta
   ```

## Regras rápidas

- **Nunca** commite direto na `main`.
- Sempre **`git pull origin main`** antes de criar uma branch nova.
- Uma branch/PR = uma mudança coesa (evite PRs gigantes misturando coisas).
- Rode `npm run build` antes de subir, pra não quebrar o preview.

## Proteção da branch (configurar 1x no GitHub — recomendado)

Para **exigir PR** e impedir push direto na `main`:

GitHub → repositório → **Settings** → **Branches** → **Add branch ruleset**
(ou *Add rule* em "Branch protection rules"):
- **Branch name pattern:** `main`
- Marque **Require a pull request before merging**
- (Opcional) **Require approvals: 1**
- (Opcional) **Require status checks to pass** → selecione o check da Vercel

Com isso, todo mundo passa a ser obrigado a usar o fluxo de PR acima.
