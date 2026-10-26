# Generado por scripts/packaging.mts desde la release v1.6.3 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.6.3"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.6.3/bond-darwin-arm64"
      sha256 "6b08a362394d42a0c0f7fc7675f55b33427c075ea2cef270dac709d41fd2a6b5"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.6.3/bond-darwin-x64"
      sha256 "69ba694cedeef9a4a4507b705baf96c97e63fa32ec392e97e88be43c83c5fb0d"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.6.3/bond-linux-arm64"
      sha256 "b512cd56fce34e3a6633633fbdc80da2e456dc89f6f7e23fd24741c49c8535c2"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.6.3/bond-linux-x64"
      sha256 "bcabd517a572a4815e74b0d6ebadfbec37126e23ee8f0decc83489810e3d53e2"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
