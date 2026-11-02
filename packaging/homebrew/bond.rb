# Generado por scripts/packaging.mts desde la release v1.11.0 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.11.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.11.0/bond-darwin-arm64"
      sha256 "e105b7df9ee860f7904c112d2bf96b15b690a19448e5ff878594316444d75080"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.11.0/bond-darwin-x64"
      sha256 "3167350395d967692301eb9d59a5d6beebcf05e1fc67a246021f0405f7701527"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.11.0/bond-linux-arm64"
      sha256 "af9806d8840daf90412820fe5e5c8858c049da430314fffd18aa49f4be6e9513"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.11.0/bond-linux-x64"
      sha256 "e7dcc568825221ed0e06ed13cb219840e562402302f9ef891f66bee81b3923cc"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
