# Generado por scripts/packaging.mts desde la release v1.13.0 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.13.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.13.0/bond-darwin-arm64"
      sha256 "a09dc90f4f7cc87a0f74dee35bc7b9847e04db4c87e99238cb28ff184ce2bd1f"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.13.0/bond-darwin-x64"
      sha256 "ddc41d3ddf52d857f66bf82a48cb4c8e52126fd2e75585fbf75f15dae8762753"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.13.0/bond-linux-arm64"
      sha256 "d4639c4137c30cf5f2776959dff59e3afd2b1a1dfb9a5312595ec82025a3341f"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.13.0/bond-linux-x64"
      sha256 "c61010bee50237a6a0a784732ca9c438b4c1b221643c5adfe32d44f25097bd4c"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
