# Generado por scripts/packaging.mts desde la release v1.13.1 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.13.1"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.13.1/bond-darwin-arm64"
      sha256 "37371b36ed7cef4ee15697b0dccd2e39411ecb3697da46844243f9068ecaf673"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.13.1/bond-darwin-x64"
      sha256 "e201ba3394f384e07257d94d4c0d5f92a7fa4cafe3a4b7b0d05ce342141cc275"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.13.1/bond-linux-arm64"
      sha256 "b74443c6bc28ad1aada94778624e5e582b840b64994b0369da02072b0789e193"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.13.1/bond-linux-x64"
      sha256 "ffcd129bf45b7791e2d094d504ceb8d9a796b67fbbdddafeeabfdc56bcd55063"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
