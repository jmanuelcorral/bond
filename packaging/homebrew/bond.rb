# Generado por scripts/packaging.mts desde la release v1.10.0 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.10.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.10.0/bond-darwin-arm64"
      sha256 "2cd16937c1ed0553ea5d2228df337df9297fa85f45b241ac8e9d356ab10958ad"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.10.0/bond-darwin-x64"
      sha256 "9a3b6ee8022b080107f012eb797b563a3c39f9220d18051647764cf491cce315"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.10.0/bond-linux-arm64"
      sha256 "9aac976147705b391e81ef9593ff2e788b4fd0bded3cd4a69a826e5a753d0aa3"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.10.0/bond-linux-x64"
      sha256 "720a7268567d07de444f263104da69ae97e850b85f2789b278841544a05cb036"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
