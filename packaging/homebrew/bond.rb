# Generado por scripts/packaging.mts desde la release v1.17.1 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.17.1"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.17.1/bond-darwin-arm64"
      sha256 "6a3da4460f7224f5092feb394b66b9ed5666ed6d648c01f1a7c1c764d611dfa9"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.17.1/bond-darwin-x64"
      sha256 "bbda7b7c410add3b9aae8555a52bfa4a5b13fba6de6b8f219f534a91619103b5"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.17.1/bond-linux-arm64"
      sha256 "2d067bfc8474a0d2e880359719319c93d3fbcdced79b35f3319b460f505d5e1d"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.17.1/bond-linux-x64"
      sha256 "9a0b9c7f855a6fa70d23fafd32b536ee475c5eaea828321b435c4e7d07f91979"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  def caveats
    <<~EOS
      "bond app" necesita bond-app, que el binario independiente no incluye:
        npm install -g @jmanuelcorral/bond-app
    EOS
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
