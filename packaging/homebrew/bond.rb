# Generado por scripts/packaging.mts desde la release v1.1.0 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.1.0/bond-darwin-arm64"
      sha256 "d0500ae4059b36d37af948fc3dc2a1abdb6a99eecda0e3abc80ac137208aae97"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.1.0/bond-darwin-x64"
      sha256 "5dba8fbf1eec7dc27968fa66b1bbea757633800f0e5180152b30b051ed0ffc16"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.1.0/bond-linux-arm64"
      sha256 "5bd553e6a6fe857ac9ca6937fe3773aaa3b162da9d05938e7050995b308b7e81"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.1.0/bond-linux-x64"
      sha256 "6e818b62b0dae6392c9c576bc843a806e4eea4df56b3002f8f31fedf36b10984"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
