# Generado por scripts/packaging.mts desde la release v1.14.0 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.14.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.14.0/bond-darwin-arm64"
      sha256 "3731513c3e3f4edf06a4933037e30ba8c7f435bf2803ce746588b89cd8276fbb"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.14.0/bond-darwin-x64"
      sha256 "968ef7b1ab9046a304ee184ea66a835387c0d10f0c864306f76ee4d233c690df"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.14.0/bond-linux-arm64"
      sha256 "6d16f028f1e9cf6a32a653ac5dd09c629a36318d077ddb764b572f91bdbbdadc"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.14.0/bond-linux-x64"
      sha256 "373c64b4a8f1a0725fe5ec9afd296ef3531e79fca09324e2fb6daaa62e364439"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
