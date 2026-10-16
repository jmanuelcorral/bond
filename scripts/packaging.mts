// Genera los paquetes de distribución de una release ya publicada en GitHub, a partir de su
// SHA256SUMS:
//   packaging/homebrew/bond.rb   fórmula para el tap jmanuelcorral/homebrew-tap
//   packaging/aur/PKGBUILD       paquete bond-bin para AUR (y .SRCINFO si hay makepkg)
//
// Uso: bun scripts/packaging.mts [versión]   (defecto: la de package.json)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const REPO = "jmanuelcorral/bond";
const version = process.argv[2] ?? JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const tag = `v${version}`;
const DESC = "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr";

const res = await fetch(`https://github.com/${REPO}/releases/download/${tag}/SHA256SUMS`);
if (!res.ok) throw new Error(`no encuentro SHA256SUMS de ${tag} (¿está publicada la release?)`);
const sums = Object.fromEntries(
	(await res.text())
		.trim()
		.split("\n")
		.map((l) => l.trim().split(/\s+/))
		.map(([hash, file]) => [file, hash]),
);
const sha = (asset: string) => sums[asset] ?? (() => { throw new Error(`falta ${asset} en SHA256SUMS`); })();
const url = (asset: string) => `https://github.com/${REPO}/releases/download/${tag}/${asset}`;

// --- Homebrew --------------------------------------------------------------------------
const formula = `# Generado por scripts/packaging.mts desde la release ${tag} de ${REPO}.
class Bond < Formula
  desc "${DESC}"
  homepage "https://github.com/${REPO}"
  version "${version}"

  on_macos do
    on_arm do
      url "${url("bond-darwin-arm64")}"
      sha256 "${sha("bond-darwin-arm64")}"
    end
    on_intel do
      url "${url("bond-darwin-x64")}"
      sha256 "${sha("bond-darwin-x64")}"
    end
  end

  on_linux do
    on_arm do
      url "${url("bond-linux-arm64")}"
      sha256 "${sha("bond-linux-arm64")}"
    end
    on_intel do
      url "${url("bond-linux-x64")}"
      sha256 "${sha("bond-linux-x64")}"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
`;
mkdirSync(join(ROOT, "packaging", "homebrew"), { recursive: true });
writeFileSync(join(ROOT, "packaging", "homebrew", "bond.rb"), formula);

// --- AUR (bond-bin) --------------------------------------------------------------------
const pkgbuild = `# Generado por scripts/packaging.mts desde la release ${tag} de ${REPO}.
pkgname=bond-bin
pkgver=${version}
pkgrel=1
pkgdesc="${DESC}"
arch=('x86_64' 'aarch64')
url="https://github.com/${REPO}"
license=('LicenseRef-unknown')
provides=('bond')
conflicts=('bond')
# Los binarios de Bun llevan su contenido al final del ejecutable: strip los rompe.
options=('!strip' '!debug')
source_x86_64=("bond-\${pkgver}-x86_64::${url("bond-linux-x64").replace(version, "${pkgver}")}")
source_aarch64=("bond-\${pkgver}-aarch64::${url("bond-linux-arm64").replace(version, "${pkgver}")}")
sha256sums_x86_64=('${sha("bond-linux-x64")}')
sha256sums_aarch64=('${sha("bond-linux-arm64")}')

package() {
  install -Dm755 "\${srcdir}/bond-\${pkgver}-\${CARCH}" "\${pkgdir}/usr/bin/bond"
}
`;
mkdirSync(join(ROOT, "packaging", "aur"), { recursive: true });
writeFileSync(join(ROOT, "packaging", "aur", "PKGBUILD"), pkgbuild);

const srcinfo = Bun.spawnSync(["makepkg", "--printsrcinfo"], { cwd: join(ROOT, "packaging", "aur") });
if (srcinfo.exitCode === 0) writeFileSync(join(ROOT, "packaging", "aur", ".SRCINFO"), srcinfo.stdout);

console.log(`packaging/homebrew/bond.rb y packaging/aur/PKGBUILD${srcinfo.exitCode === 0 ? " + .SRCINFO" : ""} para ${tag}`);
