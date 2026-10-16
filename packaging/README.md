# Distribución

Cada release sale de un tag `vX.Y.Z` (con la misma versión en `package.json`): el workflow
`.github/workflows/release.yml` compila los binarios, genera `SHA256SUMS`, empaqueta npm y crea
la release de GitHub. Los instaladores `install.sh` e `install.ps1` descargan de ahí.

Después de cada release, los paquetes se regeneran con las sumas publicadas:

```bash
bun scripts/packaging.mts            # versión de package.json
```

## Homebrew (tap `jmanuelcorral/homebrew-tap`)

```bash
cp packaging/homebrew/bond.rb ../homebrew-tap/Formula/bond.rb
cd ../homebrew-tap && git commit -am "bond X.Y.Z" && git push
```

Instalar: `brew install jmanuelcorral/tap/bond`.

## AUR (`bond-bin`)

Necesita una cuenta en https://aur.archlinux.org con tu clave SSH. La primera vez:

```bash
git clone ssh://aur@aur.archlinux.org/bond-bin.git /tmp/bond-bin
cp packaging/aur/PKGBUILD packaging/aur/.SRCINFO /tmp/bond-bin/
cd /tmp/bond-bin && git add PKGBUILD .SRCINFO && git commit -m "bond-bin X.Y.Z" && git push
```

Comprobar antes en local: `cd packaging/aur && makepkg -si`. Ojo: `options=('!strip')` es
obligatorio, porque `strip` rompe los binarios de Bun.

## npm (`@jmanuelcorral/bond`)

El paquete es el JavaScript para Node ≥ 22 (sin binario), que la release adjunta como
`jmanuelcorral-bond-X.Y.Z.tgz`. Publicar (pide tu sesión de npm y, si la tienes, el código 2FA):

```bash
npm login
curl -fsSLO https://github.com/jmanuelcorral/bond/releases/download/vX.Y.Z/jmanuelcorral-bond-X.Y.Z.tgz
npm publish --access public ./jmanuelcorral-bond-X.Y.Z.tgz
```

Instalar: `npm i -g @jmanuelcorral/bond`.
