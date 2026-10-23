# Generado por scripts/packaging.mts desde la release v1.5.1 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.5.1"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.5.1/bond-darwin-arm64"
      sha256 "6bf83cdd640f73406cc2e629ecea7a2bd61084cd2caa48da0c7e971872c3fe6a"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.5.1/bond-darwin-x64"
      sha256 "96ab67b4a42d4d0bbf3c587a3ab558fabeaf760eeddc1255b429ebf602965020"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.5.1/bond-linux-arm64"
      sha256 "7d7b585a95ea486296b6ef379917c995efdb34705c8815eae72c25046a8b3763"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.5.1/bond-linux-x64"
      sha256 "5f8eed4e627bedbe81399d6c5eb75baff172f417838cc869a9178e1f73d5bb7c"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
