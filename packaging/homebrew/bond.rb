# Generado por scripts/packaging.mts desde la release v1.8.0 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.8.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.8.0/bond-darwin-arm64"
      sha256 "85e7d3ba1f9d5ac86222324bb4a9ddc6a104bcf5577af59847f8b883ffcb728e"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.8.0/bond-darwin-x64"
      sha256 "6ecf68a40c1efe80ba4ae8f9f30eb4cdb0d7af85304ab382b4cc0426c0b08f5c"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.8.0/bond-linux-arm64"
      sha256 "e12bd3fde723185c7539eddf1ec77d5a33cbd9fcbd3699dcdf8383f6b47a53a9"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.8.0/bond-linux-x64"
      sha256 "3a86f1222dfec975f0efbcf4c1b516d03ce3b0c23cddc95c225bd0cbe72e5610"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
