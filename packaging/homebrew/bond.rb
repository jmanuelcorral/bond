# Generado por scripts/packaging.mts desde la release v1.9.1 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.9.1"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.9.1/bond-darwin-arm64"
      sha256 "eb477143a6190ab73b1246f83dce6ae4f0bfd87090d3b64adb4230c7b64c8f45"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.9.1/bond-darwin-x64"
      sha256 "cc38471058d7a4ecd1ba29c28e6251ac013ac2737de1233142223cc575003709"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.9.1/bond-linux-arm64"
      sha256 "019a98e12773fc4e2e3e1576890e74bcd1e84711666dfd824f9f94ffe86ad222"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.9.1/bond-linux-x64"
      sha256 "d431aac288609fa3c4d70897f5cbb033eca31fb3630c32e1daf154cce8a9d705"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
