# Generado por scripts/packaging.mts desde la release v1.12.0 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.12.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.12.0/bond-darwin-arm64"
      sha256 "d9e001cf8a0f10647148db3fb468648e0f288c3b47b0ac0bddcb4a74e467b6a1"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.12.0/bond-darwin-x64"
      sha256 "67b8b50344c0374e47330ab4bb0217e13418d90a1307367baa99e6c465fa60c7"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.12.0/bond-linux-arm64"
      sha256 "63db8ebadc26c0f4ec4071a008d46e84a492938c28e38925cbdf2b4553a04f0d"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.12.0/bond-linux-x64"
      sha256 "c20450103b2b59266db20ea1159c2aa64047fc7094d8da6e578947a5839cab95"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
