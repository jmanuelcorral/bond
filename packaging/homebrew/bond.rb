# Generado por scripts/packaging.mts desde la release v1.17.0 de jmanuelcorral/bond.
class Bond < Formula
  desc "CLI para trabajar con varios agentes de código (pi, Claude Code, Codex, Copilot...) en Herdr"
  homepage "https://github.com/jmanuelcorral/bond"
  version "1.17.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.17.0/bond-darwin-arm64"
      sha256 "32bba3c80e08f3c918da0e10f8b99e6947e003a32a8f8b34158b545390c460b7"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.17.0/bond-darwin-x64"
      sha256 "96677d34be7d467c6a4cd0f56e4956cb879259fc0f98f2ca369c91a0acafdc5d"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.17.0/bond-linux-arm64"
      sha256 "c087492d9aafa32f433e5dfe781fee38e6bda59c6769cfc16395bdcb863dc072"
    end
    on_intel do
      url "https://github.com/jmanuelcorral/bond/releases/download/v1.17.0/bond-linux-x64"
      sha256 "2afe104caf95c9cfc77517470a37ab2c5a36612445785ee6fb6167126222b19c"
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
