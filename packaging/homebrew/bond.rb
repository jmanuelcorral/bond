# Generado por scripts/packaging.mts desde la release v1.16.9 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.16.9"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.16.9/bond-darwin-arm64"
      sha256 "25c6147343271dba63db46fefc2795df4fba08a290913d06a2103f90285ec48e"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.16.9/bond-darwin-x64"
      sha256 "82b1b056ff4f4e0b6e882e887f9dbd334fa4f888ad88c88c042dfdadf998ea83"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.16.9/bond-linux-arm64"
      sha256 "e0a060d429c33c997d528483870745fa57414bb5adc212f21a6ae64d7f6cac5f"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.16.9/bond-linux-x64"
      sha256 "92e7ff6bc534a46650d53620749eb286d43ef8c3ed9c48e80a12e64b2332a48c"
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
