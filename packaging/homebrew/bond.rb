# Generado por scripts/packaging.mts desde la release v1.16.8 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.16.8"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.16.8/bond-darwin-arm64"
      sha256 "518125be8b5d892276ef19c9fecaea6c867f785c9ca344bb7c3e3d12e035ff30"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.16.8/bond-darwin-x64"
      sha256 "a18c454491ad346401f14140cfa5f90d9474eff35e9678f71c9d8714b6de811f"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.16.8/bond-linux-arm64"
      sha256 "2041dae38e7c5fc1d65ab5ad0790b51224ff593696b6e0e91446b587c7c1be9c"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.16.8/bond-linux-x64"
      sha256 "12d8b897623103f197508398b6c0f3c0a23ecb15af568f934871a2b8df501632"
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
