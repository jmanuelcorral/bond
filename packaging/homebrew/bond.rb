# Generado por scripts/packaging.mts desde la release v1.2.1 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.2.1"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.2.1/bond-darwin-arm64"
      sha256 "8bb32f0aea1cf1d386a0168e93be245609706e0af11d309b2d750a5d78c621e7"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.2.1/bond-darwin-x64"
      sha256 "742755dc9d603784dff64394328aa4cb346bb75981a59d2f18ded5b460634404"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.2.1/bond-linux-arm64"
      sha256 "9e4b889691ecda4b277f379373980abb7f90a69d3797b356f9ea0042524da128"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.2.1/bond-linux-x64"
      sha256 "db803ef074e5c9fe4c9e2553684e48c5a0c4fe09fb544a4d64b8c3d70cfd3d7d"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
