# Generado por scripts/packaging.mts desde la release v1.6.2 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.6.2"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.6.2/bond-darwin-arm64"
      sha256 "e45f6dd0bbcb694a27bb665be7dcbd76cf32c0aee8d68ca6593f89be2c480474"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.6.2/bond-darwin-x64"
      sha256 "7bc89321e67e849e8e789615d82417d30293438c03569969009bbf923096e6bb"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.6.2/bond-linux-arm64"
      sha256 "ff175fd535f42488c6c80fd9036a912666bb7dcabf853209489a7d65fc089945"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.6.2/bond-linux-x64"
      sha256 "1d7d5ec4d618e97c947fb87a6b8f8c786dcb22322af0c255ae027bfe71006c27"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
