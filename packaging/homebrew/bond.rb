# Generado por scripts/packaging.mts desde la release v1.16.3 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.16.3"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.16.3/bond-darwin-arm64"
      sha256 "ef4324e9ee983a6cbae8fa4ce4986241a0ae9509dcfd7b3818ddb91e128c24ee"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.16.3/bond-darwin-x64"
      sha256 "1efb94364551c8251dfc3158627a2fac93a908ce2e861f3c7a519b22d7c50115"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.16.3/bond-linux-arm64"
      sha256 "3863d37e40e9467033b5e4177f6a58d5ca5e3e30f89ee7d81b58e08f28fd40ae"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.16.3/bond-linux-x64"
      sha256 "c65bad2138987c1e8fe0d99d91506e6d75f63c07e63be2e1c4833a5bd4168fb7"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  def caveats
    <<~EOS
      "bond app" necesita bond-app, que el binario independiente no incluye:
        npm install -g @jmanuelcorral/bond-app
    EOS
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
