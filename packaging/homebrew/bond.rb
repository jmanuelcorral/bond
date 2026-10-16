# Generado por scripts/packaging.mts desde la release v1.0.0 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.0.0"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.0.0/bond-darwin-arm64"
      sha256 "3dc3e2a322de6f0b1e57060ac76abdabc85e975817dde35e079475ae0ad915c7"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.0.0/bond-darwin-x64"
      sha256 "7c2410b4a8447f0e462fdc2caf45e31cc94857a67a574d269f7e0db950319f90"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.0.0/bond-linux-arm64"
      sha256 "473b31a3fd7a150469e463d9c08d010d1997ebaf7fa2eae1fd87586e4d4c29df"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.0.0/bond-linux-x64"
      sha256 "fcf9a597eb9dfe6868533382e9682d67696d466547e51cad9a469b593f88bcdf"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
