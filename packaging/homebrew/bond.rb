# Generado por scripts/packaging.mts desde la release v1.4.0 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.4.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.4.0/bond-darwin-arm64"
      sha256 "876059fde48175a9faeba487af4055193998ef9174dbbdd43fdea2e7c17f26cc"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.4.0/bond-darwin-x64"
      sha256 "8c75c498f03a17a666613bacd94633bffefa618306724288cd943af47d59db6c"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.4.0/bond-linux-arm64"
      sha256 "14f12b0a882bec5012af97f8a7b3e7c6ad6b9afa33035b970816cd44790ae325"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.4.0/bond-linux-x64"
      sha256 "cc20388665b85a73c0b82fa12763176eb0122aec57d079bea5083f6efdf1b265"
    end
  end

  def install
    bin.install Dir["bond-*"].first => "bond"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/bond --version")
  end
end
