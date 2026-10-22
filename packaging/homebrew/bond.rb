# Generado por scripts/packaging.mts desde la release v1.3.0 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.3.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.3.0/bond-darwin-arm64"
      sha256 "8163267fc7d325138f81bcc6f7d2a69efcf302a8cefbc63b59b74bae40f60f42"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.3.0/bond-darwin-x64"
      sha256 "1cac2bf1443bfd2ce80486efaf167388ac04407e6b6d7e61dc2b1cca96837ffe"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.3.0/bond-linux-arm64"
      sha256 "8451c2497a3d588a09a67a4c2e240f409807c0695c26525ffb7b2ec8c96a5703"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.3.0/bond-linux-x64"
      sha256 "cf1278f01e40e9b105f6099d286683c1c7389ad1338454077633acf11472b741"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
