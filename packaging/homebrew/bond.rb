# Generado por scripts/packaging.mts desde la release v1.16.4 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.16.4"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.16.4/bond-darwin-arm64"
      sha256 "d1543bc2cf61795e0bc4ffb91f9d2adae4eaf44f970368f35a08c2ba8247c1bb"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.16.4/bond-darwin-x64"
      sha256 "7fe9ff9e40f9d337ebad4a12c28a05c0eef02e626de85595fa58ef1165a3c380"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.16.4/bond-linux-arm64"
      sha256 "40e0c5ef6583f3f0cc3218f4864a88b3a5fa65332c648bc1b7ece6d6f337a729"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.16.4/bond-linux-x64"
      sha256 "5ef69627d43b07c506bcc3e90f3cf8c7d0c68619154e0477e1bd5de91f3760d6"
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
