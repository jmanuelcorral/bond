# Generado por scripts/packaging.mts desde la release v1.7.0 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.7.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.7.0/bond-darwin-arm64"
      sha256 "bc585728d29c63cb4b40bf0cf2b3d09e080361073c26771a3e33df155e7a2e6a"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.7.0/bond-darwin-x64"
      sha256 "491881ad11c120d4b8b561dd9cf0df88e7710c87642ec4412f13fb8f90200b98"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.7.0/bond-linux-arm64"
      sha256 "fdd11663c0da871e1a7e58a53181787fb1269e192396f28a1de8adff2c72ed89"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.7.0/bond-linux-x64"
      sha256 "c57f2e67effd4645c171436518cfa3f93a49082d4b826f108b877efe11c5ce5f"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
