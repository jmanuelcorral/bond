# Generado por scripts/packaging.mts desde la release v1.0.1 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.0.1"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.0.1/bond-darwin-arm64"
      sha256 "da606c48ff403ac19d313e15f7dc69d12e107467f4d904ae8d776711150c955f"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.0.1/bond-darwin-x64"
      sha256 "9c7faa3889683786517457241cd7b406b2ce5b5f8eb0a1dae0d993ad1239eeb5"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.0.1/bond-linux-arm64"
      sha256 "a5d58db82556333d4d7e2e50a5c0c237766f56cbdf5c80fc6e9e67ca8b2337de"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.0.1/bond-linux-x64"
      sha256 "d1c905e6758dd79db215871d5497501350860a1a65e2893b005baa3c75c7a239"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
