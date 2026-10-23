# Generado por scripts/packaging.mts desde la release v1.5.0 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.5.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.5.0/bond-darwin-arm64"
      sha256 "302ecc28d5a89804b9447851cfaffb4a93486c919585fc65903a5e72f32da283"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.5.0/bond-darwin-x64"
      sha256 "9405576075590da283a5608ab6b1e785255567cff7f5e241fbe03256efd3db2c"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.5.0/bond-linux-arm64"
      sha256 "7e448f0878df339e3764e2378f4c4c93a5e512bb4ecc97ff003b8f5d00620335"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.5.0/bond-linux-x64"
      sha256 "914f75a2d0271579bc32ec938520012082a94ae31b32db2b656e9c4b779042f5"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
