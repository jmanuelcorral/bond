# Generado por scripts/packaging.mts desde la release v1.6.1 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.6.1"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.6.1/bond-darwin-arm64"
      sha256 "d3a10ef896e313dcf3394d94c3576e7104f3008ddbb3ee290d836df6cebf121a"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.6.1/bond-darwin-x64"
      sha256 "3a7b7b90c0c615a64c0a5bd0293f8f764aaefe1c74f560c0f7b6091960dc31c9"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.6.1/bond-linux-arm64"
      sha256 "a54fea7681f2597618f6859ee61b008cbfafa91f30b551c520e8cbc3ad00e1d1"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.6.1/bond-linux-x64"
      sha256 "472991931e52ba50ab036bf6eeebe67002ad34aa569d5110894eaf60a26b4cd0"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
