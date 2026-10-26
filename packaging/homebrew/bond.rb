# Generado por scripts/packaging.mts desde la release v1.6.0 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.6.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.6.0/bond-darwin-arm64"
      sha256 "fe0bbe56c671617bed9b3cf9cf44877b084e7f683af741fd842d040ccad9b7b6"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.6.0/bond-darwin-x64"
      sha256 "a1cfdf98cb937a380532c79d228bb7764c886685f6425b2c0631bae3c85161a5"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.6.0/bond-linux-arm64"
      sha256 "089be9bba64fdf761c36e7c3197a1404dc3d892b3ebb668bd160b56d3d82d59e"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.6.0/bond-linux-x64"
      sha256 "3b9b22d30cca5c6b032ffb8dba19f715e04a3c683193abee426fa076443d101d"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
